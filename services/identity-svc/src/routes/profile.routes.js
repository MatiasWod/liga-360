import { Router } from 'express';
import { requireAuthMiddleware } from '../middleware/auth.js';
import * as profileController from '../controllers/profile.controller.js';

const router = Router();

// Perfil propio (autenticado).
router.get('/me', requireAuthMiddleware, profileController.getMe);
router.post('/me/claim-by-dni', requireAuthMiddleware, profileController.claimByDni);
router.delete('/me/participants/:id/unlink', requireAuthMiddleware, profileController.unlink);

// Búsqueda de perfil por filtro (?dni= / ?userId=) — lookup service-to-service.
router.get('/', profileController.lookup);

export default router;
