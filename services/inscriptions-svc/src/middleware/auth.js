import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function unauthorized() {
  return Object.assign(new Error('token requerido'), { statusCode: 401, code: 'UNAUTHORIZED' });
}

function forbidden(message) {
  return Object.assign(new Error(message), { statusCode: 403, code: 'FORBIDDEN' });
}

/** Adjunta req.user si hay un Bearer token válido; nunca falla. */
export function optionalAuthMiddleware(req, _res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(auth.slice('Bearer '.length), env.jwtSecret);
  } catch {
    req.user = null;
  }
  return next();
}

export function requireAuthMiddleware(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function requireOrganizer(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.type !== 'organizer') return next(forbidden('organizer requerido'));
  return next();
}

export function requireTeamUser(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.type !== 'team') return next(forbidden('usuario team requerido'));
  return next();
}

export function requireParticipantUser(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.type !== 'participant') return next(forbidden('usuario participant requerido'));
  return next();
}
