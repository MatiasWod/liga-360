import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as userRepository from '../repositories/user.repository.js';
import * as teamsClient from '../clients/teams.client.js';
import { logger } from '../logger.js';
import {sendVerificationEmail} from "../middleware/mailer.js";
import {PUBLIC_ROLES} from "@liga360/shared/constants/constants.js";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '1d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, type: user.type },
    env.jwtSecret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export async function register({ mode, username, email, password, name }) {
  if (!PUBLIC_ROLES.includes(mode)) {
    throw Object.assign(new Error('Invalid user role requested'), { statusCode: 400, code: 'INVALID_ROLE' });
  }
  const existing = await userRepository.findByUsername(username);
  if (existing) {
    throw Object.assign(new Error('username already exists'), { statusCode: 409, code: 'CONFLICT' });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userRepository.create({
    email: email.trim().toLowerCase(),
    username: username.trim().toLowerCase(),
    password: hashedPassword,
    type: mode,
    isVerified: false
  });

  const verificationToken = jwt.sign(
      { userId: user.id, purpose: 'email_verification', name: name.trim(), mode },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
  );

  const verificationUrl = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;

  try {
    await sendVerificationEmail(user.username, name, verificationUrl);
  } catch (err) {
    logger.error({ err: err.message, userId: user.id }, 'failed to send verification email');
  }

  return {
    user: { id: user.id, username: user.username, type: user.type, isVerified: false },
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


export async function verifyEmail({ userId, token }) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired verification token'), { statusCode: 400, code: 'INVALID_TOKEN' });
  }

  if (decoded.purpose !== 'email_verification') {
    throw Object.assign(new Error('Invalid token purpose'), { statusCode: 400, code: 'INVALID_TOKEN' });
  }

  // Validar que el ID de la URL coincida con el ID dentro del token
  if (decoded.userId !== userId) {
    throw Object.assign(new Error('Token does not match the requested user'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  const user = await userRepository.findById(decoded.userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (user.isVerified) {
    throw Object.assign(new Error('User is already verified'), { statusCode: 400, code: 'ALREADY_VERIFIED' });
  }

  await userRepository.update(user.id, { isVerified: true });

  const { mode, name } = decoded;
  const authToken = signToken(user); // Generamos el token de sesión real

  if (mode === 'team') {
    try {
      await teamsClient.createTeam({ name, token: authToken });
    } catch (err) {
      logger.error({ err: err.message, userId: user.id }, 'failed to create team in teams-svc during verification, rolling back');
      await userRepository.deleteById(user.id);
      throw Object.assign(new Error('failed to create team profile'), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
    }
  }

  if (mode === 'participant') {
    try {
      await teamsClient.createParticipant({ name, token: authToken });
    } catch (err) {
      logger.error({ err: err.message, userId: user.id }, 'failed to create participant in teams-svc during verification, rolling back');
      await userRepository.deleteById(user.id);
      throw Object.assign(new Error('failed to create participant profile'), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
    }
  }

  return {
    token: authToken,
    user: { id: user.id, username: user.username, type: user.type, isVerified: true },
  };
}