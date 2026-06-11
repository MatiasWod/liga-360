import { Router } from 'express';
import { requireAuthMiddleware, requireOrganizer } from '../middleware/auth.js';
import * as matchEvent from '../controllers/matchEvent.controller.js';
import * as stats from '../controllers/stats.controller.js';
import * as presence from '../controllers/presence.controller.js';
import {verifyToken, requireRole, ROLES} from '@liga360/shared';

export function createRouter() {
  const router = Router();

  router.post('/matches/:matchId/events', verifyToken, requireRole[ROLES.ORGANIZER], matchEvent.create);
  // Lectura pública: mismos datos que las tablas de estadísticas; `notes` solo organizador
  router.get('/matches/:matchId/events', matchEvent.list);
  router.patch('/matches/:matchId/events/:eventId', verifyToken, requireRole[ROLES.ORGANIZER], matchEvent.update);
  router.delete('/matches/:matchId/events/:eventId', verifyToken, requireRole[ROLES.ORGANIZER], matchEvent.remove);

  // Presencias por partido (ADR-0002): lectura pública; escritura solo dueño del equipo
  // (la matriz de autorización vive en presence.service, no alcanza con el rol del token)
  router.get('/matches/:matchId/presences', presence.list);
  router.put('/matches/:matchId/presences', verifyToken, requireRole([ROLES.TEAM,ROLES.ORGANIZER]), presence.replace);
  router.delete('/matches/:matchId/presences/:presenceId', verifyToken, requireRole([ROLES.TEAM,ROLES.ORGANIZER]), presence.remove);

  // Estadísticas agregadas por Competencia/Torneo (públicas, ADR-0001)
  router.get('/tournaments/:tournamentId/stats/scorers', stats.scorers);
  router.get('/tournaments/:tournamentId/stats/cards', stats.cards);
  router.get('/tournaments/:tournamentId/stats/teams', stats.teams);
  router.get('/tournaments/:tournamentId/events', stats.eventsByInscription);

  // Stats por jugador (perfil del participante): goles/tarjetas/presencias por torneo
  router.get('/participants/:memberId/stats', verifyToken, stats.participantStats);

  return router;
}
