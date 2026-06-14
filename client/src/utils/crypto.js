// Client-side mirror of server/src/utils/crypto.js - lets the QR
// screen generate a valid encrypted TOTP payload entirely offline
// (FR11/FR12), using the Web Crypto API (AES-256-CBC + HMAC-SHA256).

const AES_KEY_HEX = import.meta.env.VITE_QR_AES_KEY;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 8;

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getAesKey() {
  return crypto.subtle.importKey('raw', hexToBytes(AES_KEY_HEX), 'AES-CBC', false, ['encrypt']);
}

/** AES-256-CBC encrypt a JSON payload -> "base64(iv).base64(ciphertext)" (matches server decryptPayload). */
export async function encryptPayload(payload) {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

async function hmacSha256(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

/** RFC6238-style TOTP using HMAC-SHA256, truncated to TOTP_DIGITS (matches server generateTotp). */
export async function generateTotp(secretHex, step = 0, timeSeconds = Date.now() / 1000) {
  const counter = Math.floor(timeSeconds / TOTP_STEP_SECONDS) + step;
  const counterBuf = new ArrayBuffer(8);
  new DataView(counterBuf).setBigUint64(0, BigInt(counter), false);

  const hmac = await hmacSha256(hexToBytes(secretHex), new Uint8Array(counterBuf));

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

export const TOTP_STEP = TOTP_STEP_SECONDS;

/** Build the encrypted QR payload for the current TOTP window (FR11/12). */
export async function buildQrToken(mssv, totpSecret) {
  const totp = await generateTotp(totpSecret);
  return encryptPayload({ mssv, totp, iat: Date.now() });
}

export function signGatePayload(payload) {
  // Same HMAC-SHA256 the server uses to verify gate requests (NFR03).
  return hmacSha256Hex(import.meta.env.VITE_GATE_HMAC_SECRET, payload);
}

async function hmacSha256Hex(secret, message) {
  const sig = await hmacSha256(new TextEncoder().encode(secret), new TextEncoder().encode(message));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}
