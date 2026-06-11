/** Cliente HTTP hacia teams-svc (ELO interno). */
import { env } from '../config/env.js';
import { svcPost } from './http.js';
import { logger } from '../logger.js';

export async function processEloMatch(payload) {
  try {
    return await svcPost(env.teamsSvcUrl, '/internal/elo/process-match', payload);
  } catch (err) {
    logger.warn({ err: err?.message, matchId: payload?.matchId }, 'elo process-match falló');
    return null;
  }
}
