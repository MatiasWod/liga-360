import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Adjunta req.user si hay un Bearer token válido; nunca falla (auth opcional). */
export function optionalAuthMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, env.jwtSecret);
  } catch {
    req.user = null;
  }
  return next();
}

/** Exige req.user; si falta, delega al errorHandler con 401 estructurado. */
export function requireAuthMiddleware(req, _res, next) {
  if (!req.user) {
    return next(Object.assign(new Error('token requerido'), { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
  return next();
}
