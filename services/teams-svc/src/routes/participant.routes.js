import { Router } from 'express';
import * as participantController from '../controllers/participant.controller.js';

const router = Router();

router.post('/', participantController.create);
router.get('/', participantController.listByProfile);            // ?personProfileId= (consumido por inscriptions-svc)
router.patch('/:id', participantController.update);

export default router;
