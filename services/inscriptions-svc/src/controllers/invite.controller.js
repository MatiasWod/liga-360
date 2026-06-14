import * as inviteService from '../services/invite.service.js';
import { normalizeCompetitionId } from '../domain/competition.js';
import { validateCreateInvite } from '../schema/invite.schema.js';
import { parsePagination } from '@liga360/shared';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

export async function list(req, res, next) {
  try {
    const competitionId = String(req.query?.competitionId || '').trim();
    const tournamentId = String(req.query?.tournamentId || '').trim();
    if (!competitionId && !tournamentId) {
      return validationError(res, [{ field: 'query', message: 'competitionId o tournamentId requerido' }]);
    }
    const { limit, offset } = parsePagination(req.query);
    res.json(await inviteService.listInvites({ competitionId, tournamentId, limit, offset }));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const tournamentId = String(req.body?.tournamentId || '').trim();
    const competitionId = normalizeCompetitionId(req.body?.competitionId);
    const type = String(req.body?.type || '').trim().toLowerCase();
    const targetInscriptionId = req.body?.targetInscriptionId ? Number(req.body.targetInscriptionId) : null;
    const targetTeamCode = req.body?.targetTeamCode ? String(req.body.targetTeamCode).trim().toUpperCase() : null;
    const targetParticipantUserId = req.body?.targetParticipantUserId ? Number(req.body.targetParticipantUserId) : null;
    const maxUsesRaw = req.body?.maxUses;
    const expiresAt = req.body?.expiresAt || null;
    const maxUses = maxUsesRaw == null ? null : Number(maxUsesRaw);

    const errors = validateCreateInvite({ tournamentId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, maxUses });
    if (errors.length > 0) return validationError(res, errors);

    res.status(201).json(await inviteService.createInvite({
      tournamentId, competitionId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, maxUses, expiresAt,
    }));
  } catch (e) {
    next(e);
  }
}

export async function claimByCode(req, res, next) {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return validationError(res, [{ field: 'code', message: 'code requerido' }]);
    res.status(201).json(await inviteService.claimByCode({ code, user: req.user }));
  } catch (e) {
    next(e);
  }
}

export async function getByToken(req, res, next) {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return validationError(res, [{ field: 'token', message: 'token requerido' }]);
    res.json(await inviteService.getByToken(token));
  } catch (e) {
    next(e);
  }
}

export async function use(req, res, next) {
  try {
    const token = String(req.params.token || '').trim();
    const displayName = String(req.body?.displayName || '').trim();
    if (!token) return validationError(res, [{ field: 'token', message: 'token requerido' }]);
    res.status(201).json(await inviteService.useInvite({ token, displayName, user: req.user }));
  } catch (e) {
    next(e);
  }
}
