import { Router } from 'express';
import { requireServiceToken } from '../middleware/auth.js';
import * as eloController from '../controllers/elo.controller.js';

const router = Router();

router.post('/process-match', requireServiceToken, eloController.processMatch);

export default router;
