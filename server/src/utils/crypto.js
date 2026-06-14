import crypto from 'crypto';
import { env } from '../config/env.js';

const AES_KEY = Buffer.from(env.qrAesKey, 'hex'); // 32 bytes -> AES-256
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 8;

/**
 * AES-256-CBC encrypt a JSON-serializable payload.
 * Output format: base64(iv) + '.' + base64(ciphertext)
 */
export function encryptPayload(payload) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${encrypted.toString('base64')}`;
}

/**
 * Decrypt a payload produced by encryptPayload(). Throws on tampering
 * or malformed input.
 */
export function decryptPayload(token) {
  const [ivB64, dataB64] = String(token).split('.');
  if (!ivB64 || !dataB64) throw new Error('Malformed QR payload');

  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/** Generate a random base32 TOTP secret for a new user. */
export function generateTotpSecret() {
  return crypto.randomBytes(20).toString('hex'); // 40-char hex secret
}

/**
 * RFC 6238-style TOTP using HMAC-SHA256, truncated to TOTP_DIGITS.
 * `step` lets the caller compute codes for adjacent windows.
 */
export function generateTotp(secretHex, step = 0, timeSeconds = Date.now() / 1000) {
  const counter = Math.floor(timeSeconds / TOTP_STEP_SECONDS) + step;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const key = Buffer.from(secretHex, 'hex');
  const hmac = crypto.createHmac('sha256', key).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code allowing +/- `window` steps of clock drift
 * (default: current step plus the previous one, since gate scans
 * happen slightly after the QR was generated).
 */
export function verifyTotp(secretHex, code, window = 1) {
  for (let step = -window; step <= 0; step++) {
    if (generateTotp(secretHex, step) === code) return true;
  }
  return false;
}

/** HMAC-SHA256 signature for gate <-> server API requests (NFR03). */
export function signGatePayload(payload) {
  return crypto.createHmac('sha256', env.gateHmacSecret).update(payload).digest('hex');
}

export function verifyGateSignature(payload, signature) {
  const expected = signGatePayload(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const TOTP_STEP = TOTP_STEP_SECONDS;
