import { Router } from 'express';
import { requireOrganizer } from '../middleware/auth.js';
import * as matchEvent from '../controllers/matchEvent.controller.js';
import * as stats from '../controllers/stats.controller.js';

export function createRouter() {
  const router = Router();

  router.post('/matches/:matchId/events', requireOrganizer, matchEvent.create);
  // Lectura pública: mismos datos que las tablas de estadísticas; `notes` solo organizador
  router.get('/matches/:matchId/events', matchEvent.list);
  router.patch('/matches/:matchId/events/:eventId', requireOrganizer, matchEvent.update);
  router.delete('/matches/:matchId/events/:eventId', requireOrganizer, matchEvent.remove);

  // Estadísticas agregadas por Competencia/Torneo (públicas, ADR-0001)
  router.get('/tournaments/:tournamentId/stats/scorers', stats.scorers);
  router.get('/tournaments/:tournamentId/stats/cards', stats.cards);
  router.get('/tournaments/:tournamentId/stats/teams', stats.teams);
  router.get('/tournaments/:tournamentId/events', stats.eventsByInscription);

  return router;
}
