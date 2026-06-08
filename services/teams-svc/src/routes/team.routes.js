import { Router } from 'express';
import { requireAuthMiddleware } from '../middleware/auth.js';
import * as teamController from '../controllers/team.controller.js';
import * as membershipController from '../controllers/membership.controller.js';

const router = Router();

// Rutas específicas antes de /:id para que no las capture el parámetro.
// GET / acepta filtros de lookup (?ownerUserId, ?personProfileId, ?ids, ?names) sin auth,
// o lista del usuario (?mine) que exige token; el control de auth vive en el controller.
router.get('/', teamController.list);
router.post('/', requireAuthMiddleware, teamController.create);
router.get('/me/invite-code', requireAuthMiddleware, teamController.getMyInviteCode);
router.get('/resolve-by-invite-code/:code', requireAuthMiddleware, teamController.resolveByInviteCode);
router.post('/:id/access-code/rotate', requireAuthMiddleware, teamController.rotateAccessCode);
router.post('/:id/members', membershipController.add);
router.delete('/:id/members/:participantId', membershipController.remove);
router.get('/:id', teamController.getById);
router.patch('/:id', teamController.update);

export default router;
