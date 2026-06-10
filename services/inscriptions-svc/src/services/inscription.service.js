/** Lógica de negocio de inscripciones: alta, cambio de estado/competencia, asociación y listados. */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { normalizeCompetitionId } from '../domain/competition.js';
import { assertRoleMatchesParticipantType } from '../domain/participantType.js';
import * as inscriptionRepo from '../repositories/inscription.repository.js';
import * as teamsClient from '../clients/teams.client.js';
import * as tournamentsClient from '../clients/tournaments.client.js';
import * as ownerService from './owner.service.js';
import { conflict, notFound, translateError, badRequest } from './serviceErrors.js';
import { logger } from '../logger.js';

const normalizeTeamName = (s) => String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');

/** Regla anti-duplicado por equipo/participante/nombre en el torneo (con advisory lock). */
async function assertNoTournamentDuplicateInscription(client, { tournamentId, linkedTeamId = null, linkedParticipantUserId = null, displayName = '', excludeInscriptionId = null }) {
  const tid = String(tournamentId || '').trim();
  if (!tid) return;

  if (linkedTeamId) {
    await inscriptionRepo.acquireAdvisoryLock(client, `dup:${tid}:team:${Number(linkedTeamId)}`);
    if (await inscriptionRepo.existsActiveByTeam(client, tid, linkedTeamId, excludeInscriptionId)) {
      throw new Error('DUPLICATE_TEAM_IN_TOURNAMENT');
    }
    return;
  }
  if (linkedParticipantUserId) {
    await inscriptionRepo.acquireAdvisoryLock(client, `dup:${tid}:participant:${Number(linkedParticipantUserId)}`);
    if (await inscriptionRepo.existsActiveByParticipant(client, tid, linkedParticipantUserId, excludeInscriptionId)) {
      throw new Error('DUPLICATE_PARTICIPANT_IN_TOURNAMENT');
    }
    return;
  }
  const name = String(displayName || '').trim();
  if (!name) return;
  await inscriptionRepo.acquireAdvisoryLock(client, `dup:${tid}:name:${name.toLowerCase()}`);
  if (await inscriptionRepo.existsActiveByName(client, tid, name, excludeInscriptionId)) {
    throw new Error('DUPLICATE_TEAM_IN_TOURNAMENT');
  }
}

/** Un usuario team no puede asociarse a dos equipos distintos en el mismo torneo. */
async function assertSingleTeamAssociationRule(client, tournamentId, userId, teamId, excludeInscriptionId) {
  const rows = await inscriptionRepo.distinctTeamLinksByCreator(client, tournamentId, userId, excludeInscriptionId);
  if (rows.length === 0) return;
  const hasSame = rows.some((row) => Number(row.linked_team_id) === Number(teamId));
  if (!hasSame) {
    throw new Error('FORBIDDEN: tu usuario team ya esta asociado a otro equipo en este torneo');
  }
}

export async function createInscription({ tournamentId, competitionId, displayName, source, linkedTeamId, competitorKind, linkedParticipantUserId, user }) {
  try {
    let finalDisplayName = displayName;
    if (source === 'public') {
      const { mode, participantType } = await tournamentsClient.resolveTournamentAccessConfig(tournamentId);
      if (mode !== 'public') {
        throw new Error('FORBIDDEN: torneo privado, solo se admite inscripción por invitación');
      }
      if (user?.type === 'team' || user?.type === 'participant') {
        assertRoleMatchesParticipantType(user.type, participantType);
      }
    }
    if (linkedTeamId) {
      const team = await teamsClient.getTeamById(linkedTeamId);
      if (team && String(team.name || '').trim()) finalDisplayName = String(team.name).trim();
    }
    if (competitorKind === 'participant' && user?.type === 'participant') {
      const participant = await ownerService.getOwnedParticipantForUser(user.sub);
      finalDisplayName = participant.displayName || finalDisplayName;
    }
    // El monolito no envuelve esto en transacción (el advisory lock es por statement; el
    // constraint único es el backstop real ante concurrencia). Se preserva el comportamiento.
    await assertNoTournamentDuplicateInscription(pool, { tournamentId, linkedTeamId, linkedParticipantUserId, displayName: finalDisplayName });
    const inscription = await inscriptionRepo.insert(pool, {
      tournamentId,
      competitionId,
      competitorKind,
      displayName: finalDisplayName,
      linkedTeamId,
      linkedParticipantUserId,
      status: 'PENDIENTE',
      source,
      createdByUserId: user?.sub || null,
      now: nowIso(),
    });
    return { inscription };
  } catch (e) {
    throw translateError(e);
  }
}

export async function updateStatus({ inscriptionId, newStatus, reviewedByUserId }) {
  try {
    return await withTransaction(async (client) => {
      const current = await inscriptionRepo.findByIdForUpdate(client, inscriptionId);
      if (!current) throw notFound('inscription no existe');
      if (current.status !== 'PENDIENTE') {
        throw conflict(`transicion invalida: ${current.status} -> ${newStatus}. Solo se permite PENDIENTE -> ACEPTADO/RECHAZADO`);
      }
      if (newStatus === 'ACEPTADO') {
        const competitionId = normalizeCompetitionId(current.competition_id);
        if (competitionId) {
          await inscriptionRepo.acquireAdvisoryLock(client, competitionId);
          const maxSlots = await tournamentsClient.resolveCompetitionMaxSlots(competitionId);
          const acceptedCount = await inscriptionRepo.countAcceptedByCompetition(client, competitionId);
          if (acceptedCount >= maxSlots) throw conflict(`CUPO_LLENO: ${acceptedCount}/${maxSlots}`, 'CUPO_LLENO');
        }
      }
      const updated = await inscriptionRepo.updateStatus(client, inscriptionId, newStatus, reviewedByUserId, nowIso());
      return { inscription: updated };
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function moveCompetition({ inscriptionId, competitionId, authorization }) {
  try {
    return await withTransaction(async (client) => {
      const current = await inscriptionRepo.findByIdForUpdate(client, inscriptionId);
      if (!current) throw notFound('inscription no existe');
      if (!['PENDIENTE', 'ACEPTADO'].includes(String(current.status || ''))) {
        throw conflict('solo se puede mover inscription en estado PENDIENTE o ACEPTADO');
      }
      if (String(current.competition_id || '') === competitionId) {
        return { inscription: current };
      }
      await tournamentsClient.clearTournamentInitialAssignments({
        tournamentId: String(current.tournament_id),
        inscriptionId,
        authorization,
      });
      let finalDisplayName = null;
      if (current.linked_team_id) {
        const team = await teamsClient.getTeamById(current.linked_team_id);
        const name = String(team?.name || '').trim();
        if (name) finalDisplayName = name;
      }
      const updated = await inscriptionRepo.updateCompetition(client, inscriptionId, competitionId, finalDisplayName, nowIso());
      return { inscription: updated };
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function associate({ inscriptionId, user }) {
  try {
    return await withTransaction(async (client) => {
      const inscription = await inscriptionRepo.findByIdForUpdate(client, inscriptionId);
      if (!inscription) throw notFound('inscription no existe');
      const ownedTeam = await ownerService.getOwnedTeamForUser(user.sub);
      await assertSingleTeamAssociationRule(client, String(inscription.tournament_id), user.sub, Number(ownedTeam.id), inscriptionId);
      if (inscription.linked_team_id && Number(inscription.linked_team_id) !== Number(ownedTeam.id)) {
        throw conflict('inscription ya asociada a otro equipo');
      }
      const updated = await inscriptionRepo.associateTeam(client, inscriptionId, ownedTeam.id, ownedTeam.name, nowIso());
      return { inscription: updated };
    });
  } catch (e) {
    throw translateError(e);
  }
}

async function hydrateInscriptionsWithTeams(rows) {
  const ids = [...new Set(rows.map((r) => r.linked_team_id).filter((v) => v != null))];
  const names = [...new Set(rows.map((r) => r.display_name).filter(Boolean))];
  if (ids.length === 0 && names.length === 0) {
    return rows.map((r) => ({ ...r, team_badge_url: null }));
  }
  // Degradación elegante: si teams-svc no responde, devolvemos el listado SIN enriquecer
  // (nombre/escudo del equipo) en lugar de fallar toda la petición con 502.
  let teams;
  try {
    teams = await teamsClient.resolveTeams(ids, names);
  } catch (err) {
    logger.warn({ err: err.message }, 'teams-svc no disponible: inscripciones sin enriquecer con equipo');
    return rows.map((r) => ({ ...r, team_badge_url: null }));
  }
  const byId = {};
  const byName = {};
  for (const t of teams) {
    byId[t.id] = t;
    if (t.normalizedName) byName[t.normalizedName] = t;
  }
  return rows.map((r) => {
    const team = r.linked_team_id != null ? byId[r.linked_team_id] : null;
    const display_name = team && team.name ? team.name : r.display_name;
    const fallback = byName[normalizeTeamName(r.display_name)];
    const team_badge_url = team && team.badge_url != null ? team.badge_url : (fallback?.badge_url ?? null);
    return { ...r, display_name, team_badge_url };
  });
}

export async function listByTournament({ tournamentId, competitionId }) {
  const rows = await inscriptionRepo.listByTournament(pool, tournamentId, competitionId || null);
  return { tournamentId, competitionId: competitionId || null, inscriptions: await hydrateInscriptionsWithTeams(rows) };
}

export async function listByCompetition({ competitionId }) {
  const rows = await inscriptionRepo.listByCompetition(pool, competitionId);
  return { competitionId, inscriptions: await hydrateInscriptionsWithTeams(rows) };
}

/** Lookup interno por id (endpoint service-to-service, sin hidratación de equipos). */
export async function getById({ inscriptionId }) {
  const row = await inscriptionRepo.findById(pool, inscriptionId);
  if (!row) throw notFound('inscripcion no encontrada');
  return { inscription: row };
}

/** Historial cross-torneo de un equipo (público). Incluye rechazadas. */
export async function listByTeam({ teamId }) {
  const tid = Number(teamId);
  if (!tid) throw badRequest('teamId invalido');
  const rows = await inscriptionRepo.listByTeam(pool, tid);
  return { teamId: tid, inscriptions: rows };
}

/** Lookup público por ids (para resolver rival en mano a mano). */
export async function lookupByIds({ ids }) {
  const rows = await inscriptionRepo.findByIds(pool, ids);
  return { inscriptions: rows };
}
