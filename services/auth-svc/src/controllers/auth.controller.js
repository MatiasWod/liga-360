import * as authService from '../services/auth.service.js';
import { validateRegisterInput, validateLoginInput } from '../schema/auth.schema.js';
import { logger } from '../logger.js';

export async function register(req, res, next) {
  try {
    const errors = validateRegisterInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors },
      });
    }

    const { mode, username, email, password, name } = req.body;
    logger.info({ mode, username }, 'register request');

    const result = await authService.register({ mode, username, email, password, name });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const errors = validateLoginInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors },
      });
    }

    const { username, password } = req.body;
    logger.info({ username }, 'login request');

    const result = await authService.login({ username, password });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { userid } = req.params;
    const { token } = req.body; // El frontend enviará { "token": "XYZ..." } en el body

    if (!token) {
      return res.status(400).json({ error: 'Token is required', code: 'BAD_REQUEST' });
    }

    const result = await authService.verifyEmail({ userId: userid,token });
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message,
      code: error.code || 'INTERNAL_SERVER_ERROR'
    });
  }
}