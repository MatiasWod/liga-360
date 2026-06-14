import * as statsService from '../services/stats.service.js';
import { sanitizeEventForViewer } from '../domain/matchEvent.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

/**
 * GET /stats/scorers — un solo recurso con filtros:
 * ?tournamentId=X[&competitionId][&limit] (por torneo) o ?tournamentIds=t1,t2[&limit] (cross-torneo).
 */
export async function scorers(req, res, next) {
  try {
    const multiRaw = String(req.query?.tournamentIds || '').trim();
    if (multiRaw) {
      const tournamentIds = multiRaw.split(',').map((s) => s.trim()).filter(Boolean);
      const { limit } = req.query;
      return res.json(await statsService.getScorersMulti({ tournamentIds, limit }));
    }
    const tournamentId = String(req.query?.tournamentId || '').trim();
    if (!tournamentId) return validationError(res, 'tournamentId o tournamentIds requerido');
    const { competitionId, limit } = req.query;
    res.json(await statsService.getScorers({ tournamentId, competitionId: competitionId || null, limit }));
  } catch (e) {
    next(e);
  }
}

export async function cards(req, res, next) {
  try {
    const tournamentId = String(req.query?.tournamentId || '').trim();
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    const { competitionId } = req.query;
    res.json(await statsService.getCards({ tournamentId, competitionId: competitionId || null }));
  } catch (e) {
    next(e);
  }
}

export async function teams(req, res, next) {
  try {
    const tournamentId = String(req.query?.tournamentId || '').trim();
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    const { competitionId } = req.query;
    res.json(await statsService.getTeamStats({ tournamentId, competitionId: competitionId || null }));
  } catch (e) {
    next(e);
  }
}

export async function participantStats(req, res, next) {
  try {
    const memberId = Number(req.params.memberId);
    if (!memberId) return validationError(res, 'memberId invalido');
    const teamIdRaw = req.query?.teamId;
    const teamId = teamIdRaw != null && String(teamIdRaw).trim() !== '' ? Number(teamIdRaw) : null;
    res.json(await statsService.getParticipantStats({ memberId, teamId: Number.isFinite(teamId) && teamId > 0 ? teamId : null }));
  } catch (e) {
    next(e);
  }
}

export async function eventsByInscription(req, res, next) {
  try {
    const tournamentId = String(req.query?.tournamentId || '').trim();
    const { inscriptionId } = req.query;
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    if (!inscriptionId) return validationError(res, 'inscriptionId requerido');
    const events = await statsService.getEventsByInscription({ tournamentId, inscriptionId });
    const isOrganizer = req.user?.type === 'organizer';
    res.json(events.map((ev) => sanitizeEventForViewer(ev, isOrganizer)));
  } catch (e) {
    next(e);
  }
}
