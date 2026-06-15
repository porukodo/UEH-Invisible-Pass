import { createApp } from '../src/app.js';

const app = createApp();

// Vercel's catch-all rewrite (`/(.*) -> /api/index`) can hand the function an
// empty `req.url` when the original request was for the bare root `/`, which
// crashes Express's router. Normalize it back to `/` before delegating.
export default function handler(req, res) {
  if (!req.url) req.url = '/';
  return app(req, res);
}
