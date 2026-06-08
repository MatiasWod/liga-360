/** Normaliza un DNI argentino: solo dígitos, 7-8 de longitud; null si inválido. */
export function normalizeDni(rawDni) {
  if (rawDni == null) return null;
  const digits = String(rawDni).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}
