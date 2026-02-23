import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

export function requireOrganizerFromAuthHeader(authorizationHeader) {
  const authHeader = authorizationHeader || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    throw new Error('UNAUTHORIZED: token requerido');
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error('UNAUTHORIZED: token inválido');
  }

  if (payload?.type !== 'organizer') {
    throw new Error('FORBIDDEN: solo organizador puede crear torneos');
  }

  return payload;
}

