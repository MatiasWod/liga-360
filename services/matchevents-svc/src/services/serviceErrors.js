/** Helpers de error estructurado { error: { code, message } }. */
export const badRequest = (message, code = 'VALIDATION_ERROR') => Object.assign(new Error(message), { statusCode: 400, code });
export const forbidden = (message, code = 'FORBIDDEN') => Object.assign(new Error(message), { statusCode: 403, code });
export const notFound = (message, code = 'NOT_FOUND') => Object.assign(new Error(message), { statusCode: 404, code });
export const conflict = (message, code = 'CONFLICT') => Object.assign(new Error(message), { statusCode: 409, code });
