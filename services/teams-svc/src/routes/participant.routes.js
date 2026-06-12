import { Router } from 'express';
import * as participantController from '../controllers/participant.controller.js';
import {verifyToken, requireRole, ROLES} from '@liga360/shared';

const router = Router();

router.post('/', verifyToken, requireRole([ROLES.TEAM,ROLES.PARTICIPANT]), participantController.create);
router.get('/', participantController.listByProfile);            // ?personProfileId= (consumido por inscriptions-svc)
router.patch('/:id', verifyToken, requireRole([ROLES.TEAM,ROLES.PARTICIPANT]), participantController.update);

export default router;
