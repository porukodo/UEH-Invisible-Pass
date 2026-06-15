export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  // Only ApiError carries a message meant for the client; anything else
  // (DB driver errors, etc.) might contain internal details, so log it
  // server-side but return a generic message.
  const message = err instanceof ApiError ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
