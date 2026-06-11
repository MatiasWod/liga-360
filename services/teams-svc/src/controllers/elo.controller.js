import * as eloService from '../services/elo.service.js';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

export async function processMatch(req, res, next) {
  try {
    const matchId = String(req.body?.matchId || '').trim();
    const tournamentId = String(req.body?.tournamentId || '').trim();
    const tournamentStatus = String(req.body?.tournamentStatus || '').trim();
    const homeInscriptionId = String(req.body?.homeInscriptionId || '').trim();
    const awayInscriptionId = String(req.body?.awayInscriptionId || '').trim();
    const homeScore = req.body?.homeScore;
    const awayScore = req.body?.awayScore;
    if (!matchId) return validationError(res, [{ field: 'matchId', message: 'matchId requerido' }]);
    if (!tournamentId) return validationError(res, [{ field: 'tournamentId', message: 'tournamentId requerido' }]);
    res.json(
      await eloService.processMatch({
        matchId,
        tournamentId,
        tournamentStatus,
        homeInscriptionId,
        awayInscriptionId,
        homeScore,
        awayScore,
      })
    );
  } catch (e) {
    next(e);
  }
}
