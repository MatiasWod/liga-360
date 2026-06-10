import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as userRepository from '../repositories/user.repository.js';
import * as teamsClient from '../clients/teams.client.js';
import { logger } from '../logger.js';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '1d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, type: user.type },
    env.jwtSecret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export async function register({ mode, username, password, name, firstName, lastName, nickname, dni }) {
  const existing = await userRepository.findByUsername(username);
  if (existing) {
    throw Object.assign(new Error('username already exists'), { statusCode: 409, code: 'CONFLICT' });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  // Se guarda el username tal como lo escribió el usuario (p. ej. "FIFA"): la unicidad
  // y el login son case-insensitive (índice único sobre LOWER(username) + lookup LOWER=LOWER).
  const user = await userRepository.create({
    username: username.trim(),
    password: hashedPassword,
    type: mode,
  });

  const token = signToken(user);

  if (mode === 'team') {
    try {
      await teamsClient.createTeam({ name: name.trim(), token });
    } catch (err) {
      logger.error({ err: err.message, userId: user.id }, 'failed to create team in teams-svc, rolling back user');
      await userRepository.deleteById(user.id);
      throw Object.assign(new Error('failed to create team profile'), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
    }
  }

  if (mode === 'participant') {
    try {
      await teamsClient.createParticipant({ name: name.trim(), firstName, lastName, nickname, dni, token });
    } catch (err) {
      logger.error({ err: err.message, userId: user.id }, 'failed to create participant in teams-svc, rolling back user');
      await userRepository.deleteById(user.id);
      throw Object.assign(new Error('failed to create participant profile'), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
    }
  }

  return {
    token,
    user: { id: user.id, username: user.username, type: user.type },
  };
}

export async function login({ username, password }) {
  const user = await userRepository.findByUsername(username);
  if (!user) {
    throw Object.assign(new Error('invalid credentials'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw Object.assign(new Error('invalid credentials'), { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const token = signToken(user);

  return {
    token,
    user: { id: user.id, username: user.username, type: user.type },
  };
}
