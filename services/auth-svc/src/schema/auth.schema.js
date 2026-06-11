const VALID_MODES = ['team', 'participant', 'organizer'];

export function validateRegisterInput(body) {
  const errors = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const { mode, username, email, password, name } = body || {};

  if (!mode || !VALID_MODES.includes(mode)) {
    errors.push({ field: 'mode', message: `mode must be one of: ${VALID_MODES.join(', ')}` });
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push({ field: 'username', message: 'username must be at least 3 characters' });
  }
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    errors.push({ field: 'email', message: 'email must be a valid email address' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push({ field: 'password', message: 'password must be at least 6 characters' });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required' });
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
