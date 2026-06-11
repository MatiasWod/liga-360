export const badRequest = (message, code = 'VALIDATION_ERROR') => Object.assign(new Error(message), { statusCode: 400, code });

export function translateError(e) {
  if (e && e.statusCode) return e;
  return e;
}
