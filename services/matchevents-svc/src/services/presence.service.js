/**
 * Presencias por partido (ADR-0002): lectura pública, escritura solo del dueño
 * del equipo. La propiedad se resuelve cross-service: inscription_id →
 * linked_team_id (inscriptions-svc) → owner_user_id (teams-svc), con token de
 * servicio. Si un servicio no responde, la escritura falla con 503 (nunca se
 * degrada a permitir).
 */
import { pool } from '../config/db.js';
import * as presenceRepo from '../repositories/presence.repository.js';
import * as inscriptionsClient from '../clients/inscriptions.client.js';
import * as teamsClient from '../clients/teams.client.js';
import { evaluatePresenceWriteAccess } from '../domain/presence.js';
import { notFound } from './serviceErrors.js';

function accessError(verdict) {
  return Object.assign(new Error(verdict.message), { statusCode: verdict.statusCode, code: verdict.code });
}

/** Resuelve y verifica que `user` sea dueño del equipo de la inscripción. Devuelve la inscripción. */
async function assertTeamOwner({ user, inscriptionId }) {
  // Corte temprano sin red: solo usuarios `team` pueden ser dueños
  const preVerdict = evaluatePresenceWriteAccess({ user, inscription: undefined, team: undefined });
  if (!preVerdict.ok && user?.type !== 'team') throw accessError(preVerdict);

  const inscription = await inscriptionsClient.getInscription(inscriptionId);
  const team = inscription?.linked_team_id ? await teamsClient.getTeam(inscription.linked_team_id) : null;
  const verdict = evaluatePresenceWriteAccess({ user, inscription, team });
  if (!verdict.ok) throw accessError(verdict);
  return inscription;
}

export async function listByMatch(matchId) {
  return presenceRepo.listByMatch(pool, matchId);
}

export async function replaceForInscription({ user, matchId, tournamentId, competitionId, inscriptionId, entries }) {
  const inscription = await assertTeamOwner({ user, inscriptionId });
  return presenceRepo.replaceForInscription(pool, {
    matchId,
    tournamentId: String(tournamentId),
    competitionId: competitionId != null ? String(competitionId) : inscription.competition_id ?? null,
    inscriptionId,
    entries,
    createdByUserId: user?.sub ?? null,
  });
}

export async function remove({ user, matchId, presenceId }) {
  const presence = await presenceRepo.findByIdInMatch(pool, presenceId, matchId);
  if (!presence) throw notFound('presencia no encontrada');
  await assertTeamOwner({ user, inscriptionId: presence.inscription_id });
  await presenceRepo.deleteByIdInMatch(pool, presenceId, matchId);
  return { ok: true };
}
