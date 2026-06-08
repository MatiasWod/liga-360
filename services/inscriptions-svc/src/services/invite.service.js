/** Lógica de negocio de invitaciones: alta, claim por código, uso (máquina de estados) y accept/reject. */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { ensureInviteUsable, generatePublicInviteCode, generateTargetedInviteToken } from '../domain/invite.js';
import { assertRoleMatchesParticipantType } from '../domain/participantType.js';
import * as inviteRepo from '../repositories/invite.repository.js';
import * as inscriptionRepo from '../repositories/inscription.repository.js';
import * as teamsClient from '../clients/teams.client.js';
import * as tournamentsClient from '../clients/tournaments.client.js';
import * as ownerService from './owner.service.js';
import { badRequest, forbidden, notFound, conflict, translateError } from './serviceErrors.js';

async function generateUniqueInviteToken(type) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const token = type === 'public' ? generatePublicInviteCode() : generateTargetedInviteToken();
    if (!(await inviteRepo.tokenExists(pool, token))) return token;
  }
  throw Object.assign(new Error('INVITE_TOKEN_GENERATION_FAILED'), { statusCode: 500, code: 'INVITE_TOKEN_GENERATION_FAILED' });
}

export async function listInvites({ competitionId, tournamentId }) {
  const invites = competitionId
    ? await inviteRepo.listByCompetition(pool, competitionId)
    : await inviteRepo.listByTournament(pool, tournamentId);
  return { invites };
}

export async function createInvite({ tournamentId, competitionId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, maxUses, expiresAt }) {
  if (type === 'targeted' && targetInscriptionId) {
    const target = await inscriptionRepo.findById(pool, targetInscriptionId);
    if (!target) throw notFound('inscription objetivo no existe');
    if (String(target.tournament_id) !== tournamentId) throw badRequest('inscription objetivo no pertenece al torneo');
    if (competitionId && String(target.competition_id || '') !== competitionId) {
      throw badRequest('inscription objetivo no pertenece a la competicion');
    }
  }
  const token = await generateUniqueInviteToken(type);
  const invite = await inviteRepo.create(pool, {
    token, tournamentId, competitionId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, expiresAt, maxUses, now: nowIso(),
  });
  return { invite };
}

export async function getByToken(token) {
  const invite = await inviteRepo.findByToken(pool, token);
  if (!invite) throw notFound('invite no existe');
  let target = null;
  if (invite.target_inscription_id) {
    target = await inscriptionRepo.findById(pool, invite.target_inscription_id);
  }
  return {
    invite: {
      id: invite.id,
      token: invite.token,
      tournamentId: invite.tournament_id,
      competitionId: invite.competition_id,
      inviteType: invite.type,
      targetInscriptionId: invite.target_inscription_id,
      targetTeamCode: invite.target_team_code,
      targetParticipantUserId: invite.target_participant_user_id,
      status: invite.status,
      responseStatus: invite.invite_response_status,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      usesCount: invite.uses_count,
      target,
    },
  };
}

export async function claimByCode({ code, user }) {
  try {
    return await withTransaction(async (client) => {
      const invite = await inviteRepo.findByTokenForUpdate(client, code);
      if (!invite) throw notFound('codigo de invitacion no existe');
      if (invite.type !== 'public') throw badRequest('codigo no corresponde a invitacion publica');
      const { mode, participantType } = await tournamentsClient.resolveTournamentAccessConfig(String(invite.tournament_id));
      if (mode !== 'public') throw forbidden('torneo privado, solo se admite inscripción por invitación dirigida');
      assertRoleMatchesParticipantType(user.type, participantType);
      ensureInviteUsable(invite);

      if (user.type === 'team') {
        const ownedTeam = await ownerService.getOwnedTeamForUser(user.sub);
        if (await inscriptionRepo.findActiveByTeamForUpdate(client, invite.tournament_id, ownedTeam.id)) {
          throw conflict('tu equipo ya tiene una inscripcion activa en esta competicion');
        }
        const created = await inscriptionRepo.insert(client, {
          tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'team',
          displayName: ownedTeam.name, linkedTeamId: ownedTeam.id, status: 'PENDIENTE', source: 'public', createdByUserId: user.sub, now: nowIso(),
        });
        await inviteRepo.incrementUses(client, invite.id);
        return { inscription: created };
      }
      if (user.type === 'participant') {
        const participant = await ownerService.getOwnedParticipantForUser(user.sub);
        if (await inscriptionRepo.findActiveByParticipantForUpdate(client, invite.tournament_id, user.sub)) {
          throw conflict('ya tenes una inscripción activa en este torneo como participante');
        }
        const created = await inscriptionRepo.insert(client, {
          tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'participant',
          displayName: participant.displayName, linkedParticipantUserId: user.sub, status: 'PENDIENTE', source: 'public', createdByUserId: user.sub, now: nowIso(),
        });
        await inviteRepo.incrementUses(client, invite.id);
        return { inscription: created };
      }
      throw forbidden('solo team o participant pueden usar este flujo');
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function useInvite({ token, displayName, user }) {
  try {
    return await withTransaction(async (client) => {
      const invite = await inviteRepo.findByTokenForUpdate(client, token);
      if (!invite) throw notFound('invite no existe');
      ensureInviteUsable(invite);

      let inscription = null;
      if (invite.type === 'public') {
        const { mode, participantType } = await tournamentsClient.resolveTournamentAccessConfig(String(invite.tournament_id));
        if (mode !== 'public') throw forbidden('torneo privado, solo se admite inscripción por invitación dirigida');
        if (user?.type === 'team' || user?.type === 'participant') assertRoleMatchesParticipantType(user.type, participantType);
        if (!displayName) throw badRequest('displayName requerido para invitacion publica');
        inscription = await inscriptionRepo.insert(client, {
          tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'team',
          displayName, status: 'PENDIENTE', source: 'invitation', createdByUserId: user?.sub || null, now: nowIso(),
        });
      } else if (!invite.target_inscription_id && !invite.target_team_code && !invite.target_participant_user_id) {
        throw badRequest('invite targeted sin target');
      } else if (!invite.target_inscription_id && invite.target_team_code) {
        if (!user || user.type !== 'team') throw forbidden('invite por codigo requiere usuario team');
        const ownedTeams = await teamsClient.listOwnedTeamsByUser(user.sub);
        if (ownedTeams.length === 0) throw forbidden('no tenes equipo asociado a la cuenta');
        const team = ownedTeams[0];
        const inviteCode = String(team.invite_code || '').toUpperCase();
        if (!inviteCode || inviteCode !== String(invite.target_team_code).toUpperCase()) throw forbidden('esta invitacion no pertenece a tu equipo');
        const existing = await inscriptionRepo.findActiveByTeamForUpdate(client, invite.tournament_id, team.id);
        inscription = existing || await inscriptionRepo.insert(client, {
          tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'team',
          displayName: team.name, linkedTeamId: team.id, status: 'ACEPTADO', source: 'invitation', createdByUserId: user.sub, reviewedByUserId: user.sub, now: nowIso(),
        });
      } else if (!invite.target_inscription_id && invite.target_participant_user_id) {
        if (!user || user.type !== 'participant') throw forbidden('invite de participante requiere usuario participant');
        if (Number(invite.target_participant_user_id) !== Number(user.sub)) throw forbidden('esta invitacion no pertenece a tu usuario');
        const participant = await ownerService.getOwnedParticipantForUser(user.sub);
        const existing = await inscriptionRepo.findActiveByParticipantForUpdate(client, invite.tournament_id, user.sub);
        inscription = existing || await inscriptionRepo.insert(client, {
          tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'participant',
          displayName: participant.displayName, linkedParticipantUserId: user.sub, status: 'ACEPTADO', source: 'invitation', createdByUserId: user.sub, reviewedByUserId: user.sub, now: nowIso(),
        });
      } else {
        const target = await inscriptionRepo.findByIdForUpdate(client, invite.target_inscription_id);
        if (!target) throw notFound('inscription objetivo no existe');
        if (String(target.tournament_id) !== String(invite.tournament_id)) throw badRequest('inscription objetivo no pertenece al torneo del invite');
        if (String(target.competition_id || '') !== String(invite.competition_id || '')) throw badRequest('inscription objetivo no pertenece a la competicion del invite');
        if (target.status !== 'PENDIENTE') throw conflict('solo se puede completar una inscription PENDIENTE');
        inscription = await inscriptionRepo.completeTargetFromInvite(client, invite.target_inscription_id, displayName, user?.sub || null, nowIso());
      }

      if (invite.type === 'targeted') await inviteRepo.revokeAccepted(client, invite.id);
      else await inviteRepo.incrementUses(client, invite.id);

      return {
        inscription,
        invite: {
          id: invite.id,
          token: invite.token,
          tournament_id: invite.tournament_id,
          competition_id: invite.competition_id,
          type: invite.type,
          target_team_code: invite.target_team_code || null,
          target_participant_user_id: invite.target_participant_user_id || null,
        },
      };
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function getTeamInvites({ user }) {
  const ownedTeams = await teamsClient.listOwnedTeamsByUser(user.sub);
  if (ownedTeams.length === 0) return { invites: [] };
  const team = ownedTeams[0];
  if (!team.invite_code) return { invites: [] };
  const invites = await inviteRepo.listTargetedByTeamCode(pool, String(team.invite_code));
  return { team: { id: team.id, name: team.name, inviteCode: team.invite_code }, invites };
}

export async function acceptTeamInvite({ inviteId, user }) {
  try {
    return await withTransaction(async (client) => {
      const ownedTeams = await teamsClient.listOwnedTeamsByUser(user.sub);
      if (ownedTeams.length === 0) throw forbidden('no tenes equipo para aceptar invitaciones');
      const team = ownedTeams[0];
      const invite = await inviteRepo.findByIdForUpdate(client, inviteId);
      if (!invite) throw notFound('invite no existe');
      if (invite.status !== 'active') throw conflict('invite no activa');
      if (String(invite.type) !== 'targeted') throw badRequest('invite no corresponde a flujo por codigo');
      if (String(invite.target_team_code || '').toUpperCase() !== String(team.invite_code || '').toUpperCase()) {
        throw forbidden('invitacion no pertenece a tu equipo');
      }
      const existing = await inscriptionRepo.findActiveByTeamForUpdate(client, invite.tournament_id, team.id);
      const inscription = existing
        ? await inscriptionRepo.updateStatus(client, existing.id, 'ACEPTADO', user.sub, nowIso())
        : await inscriptionRepo.insert(client, {
            tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'team',
            displayName: team.name, linkedTeamId: team.id, status: 'ACEPTADO', source: 'invitation', createdByUserId: user.sub, reviewedByUserId: user.sub, now: nowIso(),
          });
      await inviteRepo.revokeAccepted(client, invite.id);
      return { inscription };
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function rejectTeamInvite({ inviteId, user }) {
  const ownedTeams = await teamsClient.listOwnedTeamsByUser(user.sub);
  if (ownedTeams.length === 0) throw forbidden('sin equipo owner', 'FORBIDDEN');
  const inviteCode = String(ownedTeams[0].invite_code || '').toUpperCase();
  if (!(await inviteRepo.rejectByTeamCode(pool, inviteId, inviteCode))) {
    throw notFound('invite no encontrada para tu equipo');
  }
  return { ok: true };
}

export async function getParticipantInvites({ user }) {
  const invites = await inviteRepo.listTargetedByParticipant(pool, user.sub);
  return { invites };
}

export async function acceptParticipantInvite({ inviteId, user }) {
  try {
    return await withTransaction(async (client) => {
      const participant = await ownerService.getOwnedParticipantForUser(user.sub);
      const invite = await inviteRepo.findByIdForUpdate(client, inviteId);
      if (!invite) throw notFound('invite no existe');
      if (invite.status !== 'active') throw conflict('invite no activa');
      if (String(invite.type) !== 'targeted') throw badRequest('invite no corresponde a flujo por usuario participant');
      if (Number(invite.target_participant_user_id || 0) !== Number(user.sub)) throw forbidden('invitacion no pertenece a tu usuario');
      const existing = await inscriptionRepo.findActiveByParticipantForUpdate(client, invite.tournament_id, user.sub);
      const inscription = existing
        ? await inscriptionRepo.updateStatus(client, existing.id, 'ACEPTADO', user.sub, nowIso())
        : await inscriptionRepo.insert(client, {
            tournamentId: invite.tournament_id, competitionId: invite.competition_id, competitorKind: 'participant',
            displayName: participant.displayName, linkedParticipantUserId: user.sub, status: 'ACEPTADO', source: 'invitation', createdByUserId: user.sub, reviewedByUserId: user.sub, now: nowIso(),
          });
      await inviteRepo.revokeAccepted(client, invite.id);
      return { inscription };
    });
  } catch (e) {
    throw translateError(e);
  }
}

export async function rejectParticipantInvite({ inviteId, user }) {
  if (!(await inviteRepo.rejectByParticipant(pool, inviteId, user.sub))) {
    throw notFound('invite no encontrada para tu usuario');
  }
  return { ok: true };
}
