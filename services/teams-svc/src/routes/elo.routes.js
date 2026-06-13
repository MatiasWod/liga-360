import { Router } from 'express';
import { requireServiceToken } from '../middleware/auth.js';
import * as eloController from '../controllers/elo.controller.js';

const router = Router();

// PUT /matches/:matchId/elo — el ELO es un sub-recurso del partido. Idempotente:
// re-procesar el mismo matchId no duplica ajustes de ELO (ver elo.integration.test.js).
router.put('/:matchId/elo', requireServiceToken, eloController.processMatch);

export default router;
