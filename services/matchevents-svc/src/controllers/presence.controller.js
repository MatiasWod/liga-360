import * as presenceService from '../services/presence.service.js';
import { normalizePresenceEntries } from '../domain/presence.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

export async function list(req, res, next) {
  try {
    const { matchId } = req.params;
    if (!matchId) return validationError(res, 'matchId requerido');
    res.json(await presenceService.listByMatch(matchId));
  } catch (e) {
    next(e);
  }
}

/** PUT bulk: reemplaza las presencias de UNA inscripción en el partido (solo dueño del equipo). */
export async function replace(req, res, next) {
  try {
    const { matchId } = req.params;
    const { inscription_id, tournament_id, competition_id, entries } = req.body || {};
    if (!matchId) return validationError(res, 'matchId requerido');
    if (!inscription_id) return validationError(res, 'inscription_id requerido');
    if (!tournament_id) return validationError(res, 'tournament_id requerido');
    const normalized = normalizePresenceEntries(entries);
    if (!normalized.ok) return validationError(res, normalized.error);
    const presences = await presenceService.replaceForInscription({
      user: req.user,
      matchId,
      tournamentId: tournament_id,
      competitionId: competition_id,
      inscriptionId: Number(inscription_id),
      entries: normalized.entries,
    });
    res.json(presences);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { matchId, presenceId } = req.params;
    if (!matchId || !presenceId) return validationError(res, 'matchId y presenceId requeridos');
    res.json(await presenceService.remove({ user: req.user, matchId, presenceId: Number(presenceId) }));
  } catch (e) {
    next(e);
  }
}
