import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';

/**
 * SePay's own setup instructions tell users to type "Apikey <key>" into the
 * dashboard's auth field, but SePay *also* prepends "Apikey " when sending
 * the webhook - so depending on how the key was entered on either side, the
 * header can end up with 0, 1, or 2 "Apikey " prefixes. Strip them all so the
 * comparison is based on the raw key only.
 */
function stripApikeyPrefix(value) {
  let result = value.trim();
  for (let i = 0; i < 2; i++) {
    const stripped = result.replace(/^apikey\s+/i, '');
    if (stripped === result) break;
    result = stripped.trim();
  }
  return result;
}

/** FR09: verify SePay's webhook "Authorization: Apikey <key>" header before processing IPNs. */
export function requireSepayApiKey(req, res, next) {
  if (!env.sepayApiKey) return next(new ApiError(500, 'SePay API key not configured'));

  const actualHeader = String(req.headers.authorization || '');
  const expected = Buffer.from(stripApikeyPrefix(env.sepayApiKey));
  const actual = Buffer.from(stripApikeyPrefix(actualHeader));

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return next(new ApiError(401, 'Invalid SePay API key'));
  }
  next();
}
