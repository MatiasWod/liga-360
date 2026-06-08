export function validateCreateInscription({ tournamentId, displayName, source }) {
  const errors = [];
  if (!tournamentId) errors.push({ field: 'tournamentId', message: 'tournamentId requerido' });
  if (!displayName) errors.push({ field: 'displayName', message: 'displayName requerido' });
  if (!['public', 'manual'].includes(source)) {
    errors.push({ field: 'source', message: 'source invalido. Usar public o manual' });
  }
  return errors;
}
