import { Router } from 'express';
import * as participantController from '../controllers/participant.controller.js';

const router = Router();

router.post('/', participantController.create);
router.get('/', participantController.listByProfile);            // ?personProfileId=
router.patch('/', participantController.linkByDni);              // ?dni= , body { personProfileId }
router.delete('/:id/person-profile', participantController.unlink); // body { personProfileId }
router.patch('/:id', participantController.update);

export default router;
