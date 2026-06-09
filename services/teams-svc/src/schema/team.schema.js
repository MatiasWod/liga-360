export function validateCreateTeam(body) {
  const errors = [];
  const { name } = body || {};
  if (!name || !String(name).trim()) {
    errors.push({ field: 'name', message: 'name is required' });
  }
  return errors;
}
