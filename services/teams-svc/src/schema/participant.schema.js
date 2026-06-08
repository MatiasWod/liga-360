import { normalizeDni } from '../domain/dni.js';

export function validateCreateParticipant(body) {
  const errors = [];
  const { firstName, lastName, dni } = body || {};
  if (!firstName || !String(firstName).trim()) {
    errors.push({ field: 'firstName', message: 'firstName is required' });
  }
  if (!lastName || !String(lastName).trim()) {
    errors.push({ field: 'lastName', message: 'lastName is required' });
  }
  if (dni && !normalizeDni(dni)) {
    errors.push({ field: 'dni', message: 'invalid dni (AR expected 7-8 digits)' });
  }
  return errors;
}

export function validateUpdateParticipant(body) {
  const errors = [];
  const { teamId, dni } = body || {};
  if (!teamId) {
    errors.push({ field: 'teamId', message: 'teamId required for participant update' });
  }
  if (dni !== undefined && dni !== '' && !normalizeDni(dni)) {
    errors.push({ field: 'dni', message: 'invalid dni (AR expected 7-8 digits)' });
  }
  return errors;
}
