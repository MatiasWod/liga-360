import * as tennisScoreService from '../services/tennisScore.service.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

/** PUT bulk: reemplaza sets de tenis y sincroniza sets ganados en tournaments-svc. */
export async function replace(req, res, next) {
  try {
    const { matchId } = req.params;
    const { tournament_id, competition_id, status, sets } = req.body || {};
    if (!matchId) return validationError(res, 'matchId requerido');
    if (!tournament_id) return validationError(res, 'tournament_id requerido');
    if (!status) return validationError(res, 'status requerido');
    if (!Array.isArray(sets)) return validationError(res, 'sets requerido');

    const authorization = req.headers.authorization || req.headers.Authorization;
    const result = await tennisScoreService.replaceTennisScore({
      authorization,
      matchId,
      tournamentId: tournament_id,
      competitionId: competition_id ?? null,
      status,
      sets,
      createdByUserId: req.user?.sub ?? null,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}
