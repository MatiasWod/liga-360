import { Router } from 'express';
import { requireAuthMiddleware } from '../middleware/auth.js';
import * as teamController from '../controllers/team.controller.js';
import * as membershipController from '../controllers/membership.controller.js';
import {verifyToken, requireRole, ROLES} from '@liga360/shared';

const router = Router();

// Rutas específicas antes de /:id para que no las capture el parámetro.
// GET / acepta filtros de lookup (?ownerUserId, ?ids, ?names, ?inviteCode) o lista del usuario
// (?mine, exige token); el control de auth vive en el controller.
router.get('/', teamController.list);
router.post('/', verifyToken, requireRole([ROLES.TEAM,ROLES.ORGANIZER]), teamController.create);
router.get('/me/invite-code', verifyToken, requireRole[ROLES.TEAM], teamController.getMyInviteCode);
router.post('/:id/access-code/rotate', verifyToken, requireRole[ROLES.TEAM], teamController.rotateAccessCode);
router.post('/:id/members', verifyToken, requireRole([ROLES.TEAM,ROLES.PARTICIPANT]), membershipController.add);
router.delete('/:id/members/:participantId', verifyToken, requireRole([ROLES.TEAM,ROLES.PARTICIPANT]), membershipController.remove);
router.get('/:id', teamController.getById);
router.patch('/:id', verifyToken, requireRole([ROLES.TEAM, ROLES.PARTICIPANT]), teamController.update);

export default router;
