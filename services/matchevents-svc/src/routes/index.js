import { Router } from 'express';
import { requireAuthMiddleware, requireOrganizer } from '../middleware/auth.js';
import * as matchEvent from '../controllers/matchEvent.controller.js';

export function createRouter() {
  const router = Router();

  router.post('/matches/:matchId/events', requireOrganizer, matchEvent.create);
  router.get('/matches/:matchId/events', requireAuthMiddleware, matchEvent.list);
  router.patch('/matches/:matchId/events/:eventId', requireOrganizer, matchEvent.update);
  router.delete('/matches/:matchId/events/:eventId', requireOrganizer, matchEvent.remove);

  return router;
}
