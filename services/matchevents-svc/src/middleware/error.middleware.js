import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 ? 'internal_error' : err.message;

  if (statusCode >= 500) {
    logger.error({ err, reqId: req.id }, 'unhandled error');
  } else {
    logger.warn({ err, reqId: req.id, statusCode }, 'handled error');
  }

  res.status(statusCode).json({
    error: { code, message },
  });
}
