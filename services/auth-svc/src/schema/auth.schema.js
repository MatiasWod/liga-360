const VALID_MODES = ['team', 'participant', 'organizer'];

export function validateRegisterInput(body) {
  const errors = [];
  const { mode, username, password, name } = body || {};

  if (!mode || !VALID_MODES.includes(mode)) {
    errors.push({ field: 'mode', message: `mode must be one of: ${VALID_MODES.join(', ')}` });
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push({ field: 'username', message: 'username must be at least 3 characters' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push({ field: 'password', message: 'password must be at least 6 characters' });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required' });
  }
  // Campos opcionales del registro de participante (se persisten en teams-svc).
  const { firstName, lastName, nickname, dni } = body || {};
  for (const [field, value] of [['firstName', firstName], ['lastName', lastName], ['nickname', nickname]]) {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
    }
  }
  if (dni !== undefined && dni !== null && dni !== '' && !/^\d{7,8}$/.test(String(dni).replace(/\D/g, ''))) {
    errors.push({ field: 'dni', message: 'dni must have 7-8 digits' });
  }
  return errors;
}

export function validateLoginInput(body) {
  const errors = [];
  const { username, password } = body || {};
  if (!username) errors.push({ field: 'username', message: 'username is required' });
  if (!password) errors.push({ field: 'password', message: 'password is required' });
  return errors;
}
