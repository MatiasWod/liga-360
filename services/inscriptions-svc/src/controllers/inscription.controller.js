import * as inscriptionService from '../services/inscription.service.js';
import { normalizeCompetitionId } from '../domain/competition.js';
import { validateCreateInscription } from '../schema/inscription.schema.js';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

export async function create(req, res, next) {
  try {
    const tournamentId = String(req.body?.tournamentId || '').trim();
    const competitionId = normalizeCompetitionId(req.body?.competitionId);
    const displayName = String(req.body?.displayName || '').trim();
    const source = String(req.body?.source || 'public').trim().toLowerCase();
    const linkedTeamId = req.body?.linkedTeamId ? Number(req.body.linkedTeamId) : null;
    const competitorKindRaw = String(req.body?.competitorKind || '').trim().toLowerCase();
    const competitorKind = competitorKindRaw === 'participant' ? 'participant' : 'team';
    const linkedParticipantUserIdRaw = req.body?.linkedParticipantUserId;
    const linkedParticipantUserIdFromBody =
      linkedParticipantUserIdRaw == null ? null : Number(linkedParticipantUserIdRaw) || null;
    const linkedParticipantUserId =
      competitorKind === 'participant'
        ? (req.user?.type === 'participant' ? Number(req.user?.sub || 0) || null : linkedParticipantUserIdFromBody)
        : null;

    const errors = validateCreateInscription({ tournamentId, displayName, source });
    if (errors.length > 0) return validationError(res, errors);
    if (source === 'manual' && (!req.user || req.user.type !== 'organizer')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'manual requiere organizer autenticado' } });
    }

    const result = await inscriptionService.createInscription({
      tournamentId, competitionId, displayName, source, linkedTeamId, competitorKind, linkedParticipantUserId, user: req.user,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const inscriptionId = Number(req.params.id);
    const newStatus = String(req.body?.status || '').trim().toUpperCase();
    if (!inscriptionId) return validationError(res, [{ field: 'id', message: 'inscriptionId invalido' }]);
    if (!['ACEPTADO', 'RECHAZADO'].includes(newStatus)) {
      return validationError(res, [{ field: 'status', message: 'status invalido. Usar ACEPTADO o RECHAZADO' }]);
    }
    res.json(await inscriptionService.updateStatus({ inscriptionId, newStatus, reviewedByUserId: req.user.sub }));
  } catch (e) {
    next(e);
  }
}

export async function moveCompetition(req, res, next) {
  try {
    const inscriptionId = Number(req.params.id);
    const competitionId = String(req.body?.competitionId || '').trim();
    if (!inscriptionId) return validationError(res, [{ field: 'id', message: 'inscriptionId invalido' }]);
    if (!competitionId) return validationError(res, [{ field: 'competitionId', message: 'competitionId requerido' }]);
    res.json(await inscriptionService.moveCompetition({ inscriptionId, competitionId, authorization: req.headers.authorization || '' }));
  } catch (e) {
    next(e);
  }
}

export async function associate(req, res, next) {
  try {
    const inscriptionId = Number(req.params.id);
    if (!inscriptionId) return validationError(res, [{ field: 'id', message: 'inscriptionId invalido' }]);
    res.json(await inscriptionService.associate({ inscriptionId, user: req.user }));
  } catch (e) {
    next(e);
  }
}

export async function listByTournament(req, res, next) {
  try {
    const tournamentId = String(req.params.id || '').trim();
    const competitionId = String(req.query?.competitionId || '').trim();
    if (!tournamentId) return validationError(res, [{ field: 'id', message: 'tournamentId requerido' }]);
    res.json(await inscriptionService.listByTournament({ tournamentId, competitionId }));
  } catch (e) {
    next(e);
  }
}

export async function listByCompetition(req, res, next) {
  try {
    const competitionId = String(req.params.id || '').trim();
    if (!competitionId) return validationError(res, [{ field: 'id', message: 'competitionId requerido' }]);
    res.json(await inscriptionService.listByCompetition({ competitionId }));
  } catch (e) {
    next(e);
  }
}
