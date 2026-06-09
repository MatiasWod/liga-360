import * as statsService from '../services/stats.service.js';
import { sanitizeEventForViewer } from '../domain/matchEvent.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

export async function scorers(req, res, next) {
  try {
    const { tournamentId } = req.params;
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    const { competitionId, limit } = req.query;
    res.json(await statsService.getScorers({ tournamentId, competitionId: competitionId || null, limit }));
  } catch (e) {
    next(e);
  }
}

export async function cards(req, res, next) {
  try {
    const { tournamentId } = req.params;
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    const { competitionId } = req.query;
    res.json(await statsService.getCards({ tournamentId, competitionId: competitionId || null }));
  } catch (e) {
    next(e);
  }
}

export async function teams(req, res, next) {
  try {
    const { tournamentId } = req.params;
    if (!tournamentId) return validationError(res, 'tournamentId requerido');
    const { competitionId } = req.query;
    res.json(await statsService.getTeamStats({ tournamentId, competitionId: competitionId || null }));
  } catch (e) {
    next(e);
  }
}

export async function eventsByInscription(req, res, next) {
  try {
    const { tournamentId } = req.params;
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
