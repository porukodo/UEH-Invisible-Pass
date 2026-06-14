import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';

/** FR09: verify SePay's webhook "Authorization: Apikey <key>" header before processing IPNs. */
export function requireSepayApiKey(req, res, next) {
  if (!env.sepayApiKey) return next(new ApiError(500, 'SePay API key not configured'));

  const expected = Buffer.from(`Apikey ${env.sepayApiKey}`);
  const actual = Buffer.from(String(req.headers.authorization || ''));

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return next(new ApiError(401, 'Invalid SePay API key'));
  }
  next();
}
