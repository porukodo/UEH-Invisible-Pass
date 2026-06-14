-- UEH Invisible Pass - Database Schema
-- MySQL 8 / MariaDB 10.4+, InnoDB, utf8mb4

CREATE DATABASE IF NOT EXISTS ueh_invisible_pass
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ueh_invisible_pass;

-- ---------------------------------------------------------------
-- users
-- FR01-02 (register/login), FR06 (RBAC)
-- ---------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mssv            VARCHAR(20)  NOT NULL,                 -- student/staff ID
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL,                 -- must be @st.ueh.edu.vn for students
  password_hash   VARCHAR(255) NOT NULL,                 -- bcrypt
  role            ENUM('student','staff','admin') NOT NULL DEFAULT 'student',
  license_plate   VARCHAR(20)  DEFAULT NULL,
  totp_secret     VARCHAR(64)  NOT NULL,                 -- base32 secret, used for FR11-13 dynamic QR
  email_verified_at DATETIME DEFAULT NULL,               -- set after FR03/04 OTP verification
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_mssv (mssv),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- wallets
-- Prepaid balance pool. Underpins FR08/09/15/16/17.
-- ---------------------------------------------------------------
CREATE TABLE wallets (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  balance      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_user (user_id),
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- transactions
-- Ledger of all balance movements (top-up, parking charge, manual
-- adjustment by staff). FR08/09/15/16/17/22/23.
-- ---------------------------------------------------------------
CREATE TABLE transactions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  type          ENUM('topup','charge','adjustment') NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,        -- positive for topup/adjustment-credit, negative for charge
  balance_after DECIMAL(12,2) NOT NULL,
  status        ENUM('pending','success','failed') NOT NULL DEFAULT 'success',
  gateway_ref   VARCHAR(100) DEFAULT NULL,      -- idempotency key from payment gateway webhook (FR09)
  description   VARCHAR(255) DEFAULT NULL,
  created_by    INT UNSIGNED DEFAULT NULL,      -- staff user_id for manual adjustments (FR22)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_gateway_ref (gateway_ref),
  KEY idx_transactions_user (user_id),
  KEY idx_transactions_created_at (created_at),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transactions_staff FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- topup_requests
-- Pending VietQR top-up requests awaiting IPN confirmation.
-- Backs NFR09 retry queue (re-check unconfirmed requests every
-- 15 min for a limited number of attempts).
-- ---------------------------------------------------------------
CREATE TABLE topup_requests (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  gateway_ref  VARCHAR(100) NOT NULL,
  status       ENUM('pending','confirmed','failed','expired') NOT NULL DEFAULT 'pending',
  retry_count  INT UNSIGNED NOT NULL DEFAULT 0,
  last_checked_at DATETIME DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_topup_requests_gateway_ref (gateway_ref),
  KEY idx_topup_requests_status (status),
  CONSTRAINT fk_topup_requests_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- otp_codes
-- Email OTP for FR03/FR04 (student email verification / login 2FA).
-- ---------------------------------------------------------------
CREATE TABLE otp_codes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,           -- bcrypt hash of the 6-digit code
  purpose     ENUM('email_verify','login') NOT NULL,
  expires_at  DATETIME NOT NULL,
  consumed_at DATETIME DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_user (user_id),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- gates
-- Physical entry/exit gates. FR14/18/19/22.
-- ---------------------------------------------------------------
CREATE TABLE gates (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  location    VARCHAR(150) DEFAULT NULL,
  type        ENUM('entry','exit') NOT NULL,
  status      ENUM('online','offline') NOT NULL DEFAULT 'online',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- parking_logs
-- Each successful gate scan -> fee charge. FR15/16/17/18/21/23.
-- ---------------------------------------------------------------
CREATE TABLE parking_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  gate_id        INT UNSIGNED NOT NULL,
  transaction_id BIGINT UNSIGNED DEFAULT NULL,   -- NULL if charge failed (insufficient balance)
  fee            DECIMAL(12,2) NOT NULL,
  result         ENUM('success','insufficient_balance','invalid_token','duplicate_token') NOT NULL,
  scanned_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_parking_logs_user (user_id),
  KEY idx_parking_logs_gate (gate_id),
  KEY idx_parking_logs_scanned_at (scanned_at),
  CONSTRAINT fk_parking_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parking_logs_gate FOREIGN KEY (gate_id) REFERENCES gates(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parking_logs_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- used_qr_tokens
-- DB-backed anti-replay cache for FR13 (a scanned QR token can only
-- be redeemed once). Replaces an in-memory Map so it works across
-- serverless invocations/instances.
-- ---------------------------------------------------------------
CREATE TABLE used_qr_tokens (
  token_hash  CHAR(64) NOT NULL,    -- SHA-256 hex of the QR token
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- gate_events
-- Replaces the Socket.io GATE_OPEN push (FR18/19/22): the Barrier
-- Simulator polls this table for new events per gate.
-- ---------------------------------------------------------------
CREATE TABLE gate_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gate_id    INT UNSIGNED NOT NULL,
  payload    JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gate_events_gate_id (gate_id, id),
  CONSTRAINT fk_gate_events_gate FOREIGN KEY (gate_id) REFERENCES gates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Seed data lives in data.sql (gates only; accounts are registered in-app).
-- After this file, run:  mysql -u root ueh_invisible_pass < data.sql
-- ---------------------------------------------------------------
