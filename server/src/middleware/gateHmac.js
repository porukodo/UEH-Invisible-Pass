import { verifyGateSignature } from '../utils/crypto.js';
import { ApiError } from './errorHandler.js';

/** NFR03: gate scanners sign their requests with a shared HMAC secret. */
export function requireGateSignature(req, res, next) {
  const signature = req.headers['x-gate-signature'];
  if (!signature) return next(new ApiError(401, 'Missing gate signature'));

  const payload = JSON.stringify(req.body);
  if (!verifyGateSignature(payload, signature)) {
    return next(new ApiError(401, 'Invalid gate signature'));
  }
  next();
}
