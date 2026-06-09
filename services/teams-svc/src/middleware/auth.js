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

/**
 * Exige un token de servicio (type === 'service') para endpoints service-to-service
 * (p. ej. el lookup `GET /profiles?dni|userId`). Evita que un cliente público anónimo o un
 * usuario final enumere perfiles por DNI. inscriptions-svc firma ese token con el JWT_SECRET
 * compartido. No expuesto al frontend.
 */
export function requireServiceToken(req, _res, next) {
  if (!req.user) {
    return next(Object.assign(new Error('token requerido'), { statusCode: 401, code: 'UNAUTHORIZED' }));
  }
  if (req.user.type !== 'service') {
    return next(Object.assign(new Error('endpoint interno'), { statusCode: 403, code: 'FORBIDDEN' }));
  }
  return next();
}
