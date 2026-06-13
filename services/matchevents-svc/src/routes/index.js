import { Router } from 'express';
import { requireAuthMiddleware, requireOrganizer } from '../middleware/auth.js';
import * as matchEvent from '../controllers/matchEvent.controller.js';
import * as stats from '../controllers/stats.controller.js';
import * as presence from '../controllers/presence.controller.js';
import {verifyToken, requireRole, ROLES} from '@liga360/shared';

export function createRouter() {
  const router = Router();

  router.post('/matches/:matchId/events', verifyToken, requireRole([ROLES.ORGANIZER]), matchEvent.create);
  // Lectura pública: mismos datos que las tablas de estadísticas; `notes` solo organizador
  router.get('/matches/:matchId/events', matchEvent.list);
  router.patch('/matches/:matchId/events/:eventId', verifyToken, requireRole([ROLES.ORGANIZER]), matchEvent.update);
  router.delete('/matches/:matchId/events/:eventId', verifyToken, requireRole([ROLES.ORGANIZER]), matchEvent.remove);

  // Presencias por partido (ADR-0002): lectura pública; escritura solo dueño del equipo
  // (la matriz de autorización vive en presence.service, no alcanza con el rol del token)
  router.get('/matches/:matchId/presences', presence.list);
  router.put('/matches/:matchId/presences', verifyToken, requireRole([ROLES.TEAM,ROLES.ORGANIZER]), presence.replace);
  router.delete('/matches/:matchId/presences/:presenceId', verifyToken, requireRole([ROLES.TEAM,ROLES.ORGANIZER]), presence.remove);

  // Estadísticas agregadas (públicas, ADR-0001): recursos propios bajo /stats, filtrados
  // por query param (los prefijos /tournaments y /participants pertenecen a otros servicios).
  router.get('/stats/scorers', stats.scorers); // ?tournamentId=X | ?tournamentIds=a,b (+competitionId, limit)
  router.get('/stats/cards', stats.cards); // ?tournamentId=X (+competitionId)
  router.get('/stats/teams', stats.teams); // ?tournamentId=X (+competitionId)
  // Stats por jugador (perfil del participante): goles/tarjetas/presencias por torneo
  router.get('/stats/participants/:memberId', verifyToken, stats.participantStats);

  // Log de eventos crudos de una inscripción en un torneo (historial de un equipo).
  // Bare /stats (distinto de /stats/scorers|cards|teams, que son agregados).
  router.get('/stats', stats.eventsByInscription); // ?tournamentId=X&inscriptionId=Y

  return router;
}
