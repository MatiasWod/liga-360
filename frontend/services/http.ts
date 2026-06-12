/**
 * Headers comunes para todas las llamadas a backends: JSON + Bearer si hay sesión.
 * Único punto que lee el token (los routers del backend deciden si lo exigen).
 */
export function getToken() {
  return localStorage.getItem('liga360:token');
}

export function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
