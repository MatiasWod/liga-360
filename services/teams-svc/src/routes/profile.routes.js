import { Router } from 'express';
import { requireAuthMiddleware, requireServiceToken } from '../middleware/auth.js';
import * as profileController from '../controllers/profile.controller.js';
import {verifyToken} from '@liga360/shared';

const router = Router();

router.get('/me', verifyToken, profileController.getMe);
router.post('/me/claims', verifyToken, profileController.claimByDni);
router.delete('/me/participants/:id', verifyToken, profileController.unlink);
// Lookup service-to-service (?dni|?userId): solo con token de servicio, no público.
router.get('/', requireServiceToken, profileController.lookup);

export default router;
