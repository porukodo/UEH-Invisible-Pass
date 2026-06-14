-- UEH Invisible Pass - Seed/demo data
-- Run AFTER schema.sql:
--   mysql -u root ueh_invisible_pass < database/data.sql
--
-- Demo accounts (password for all: 123456):
--   Student : svdemo@st.ueh.edu.vn    (MSSV 31221012345, wallet 100,000d)
--   Staff   : staffdemo@st.ueh.edu.vn (MSSV STAFF001)
--   Admin   : admindemo@st.ueh.edu.vn (MSSV ADMIN001)
--
-- This is the same data produced by `npm run seed` (server/src/seed.js)
-- plus the 4 demo gates - provided here so a fresh DB can be populated
-- in one step without running the seed script.

USE ueh_invisible_pass;

INSERT INTO gates (id, name, location, type, status) VALUES
  (1, 'Cong A - Vao', 'Co so A', 'entry', 'online'),
  (2, 'Cong A - Ra', 'Co so A', 'exit', 'online'),
  (3, 'Cong B - Vao', 'Co so B', 'entry', 'online'),
  (4, 'Cong B - Ra', 'Co so B', 'exit', 'online');

INSERT INTO users (id, mssv, full_name, email, password_hash, role, license_plate, totp_secret, email_verified_at, status) VALUES
  (1, '31221012345', 'Nguyen Van Sinh Vien', 'svdemo@st.ueh.edu.vn', '$2a$10$zAT1iBjjY9po807NSG1b5Oh6eTnmLQN8UPyuK.iytXuhK/1IqLqr2', 'student', '59-X1 123.45', 'b717c3b386ac795d70860a89d4589317e6b5e140', '2026-06-14 09:40:54', 'active'),
  (2, 'STAFF001', 'Tran Thi Nhan Vien', 'staffdemo@st.ueh.edu.vn', '$2a$10$zAT1iBjjY9po807NSG1b5Oh6eTnmLQN8UPyuK.iytXuhK/1IqLqr2', 'staff', NULL, 'e50293e63278b90a28b0b5cef99c87d42dcbed78', '2026-06-14 09:40:54', 'active'),
  (3, 'ADMIN001', 'Le Van Quan Tri', 'admindemo@st.ueh.edu.vn', '$2a$10$zAT1iBjjY9po807NSG1b5Oh6eTnmLQN8UPyuK.iytXuhK/1IqLqr2', 'admin', NULL, '3488ec740312686dcf3146288b1ec4ee6eb96d93', '2026-06-14 09:40:54', 'active');

INSERT INTO wallets (id, user_id, balance) VALUES
  (1, 1, 100000.00),
  (2, 2, 0.00),
  (3, 3, 0.00);

INSERT INTO transactions (id, user_id, type, amount, balance_after, status, gateway_ref, description, created_by, created_at) VALUES
  (1, 1, 'topup', 100000.00, 100000.00, 'success', 'SEED11781404854007', 'Seed demo balance', NULL, '2026-06-14 09:40:54');
