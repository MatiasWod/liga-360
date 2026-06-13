/** Cliente HTTP hacia teams-svc (ELO, service-to-service). */
import { env } from '../config/env.js';
import { svcPut } from './http.js';
import { logger } from '../logger.js';

export async function processEloMatch({ matchId, ...payload }) {
  try {
    // PUT idempotente: el ELO es un sub-recurso del partido, identificado por matchId.
    return await svcPut(env.teamsSvcUrl, `/matches/${encodeURIComponent(String(matchId))}/elo`, payload);
  } catch (err) {
    logger.warn({ err: err?.message, matchId }, 'elo process-match falló');
    return null;
  }
}
