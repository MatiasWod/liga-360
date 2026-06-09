import { Router } from 'express';
import { requireAuthMiddleware, requireServiceToken } from '../middleware/auth.js';
import * as profileController from '../controllers/profile.controller.js';

const router = Router();

router.get('/me', requireAuthMiddleware, profileController.getMe);
router.post('/me/claims', requireAuthMiddleware, profileController.claimByDni);
router.delete('/me/participants/:id', requireAuthMiddleware, profileController.unlink);
// Lookup service-to-service (?dni|?userId): solo con token de servicio, no público.
router.get('/', requireServiceToken, profileController.lookup);

export default router;
