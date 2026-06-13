/** Validación de etiqueta de categoría del torneo (modalidad demográfica, no competencia). */

export const MAX_CATEGORY_LABEL_LENGTH = 30;

const ALLOWED_PATTERN = /^[\p{L}\p{N}+\- ]+$/u;

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

/** Normaliza un label opcional; null si vacío. */
export function normalizeCategoryLabel(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const trimmed = String(raw).trim();
  if (trimmed.length > MAX_CATEGORY_LABEL_LENGTH) {
    throw validationError(`VALIDATION: categoryLabel supera ${MAX_CATEGORY_LABEL_LENGTH} caracteres`);
  }
  if (!ALLOWED_PATTERN.test(trimmed)) {
    throw validationError('VALIDATION: categoryLabel contiene caracteres no permitidos');
  }
  return trimmed;
}
