import { Router } from 'express';
import {
  requireAuthMiddleware,
  requireOrganizer,
  requireTeamUser,
  requireParticipantUser,
  requireServiceToken,
} from '../middleware/auth.js';
import * as inscription from '../controllers/inscription.controller.js';
import * as invite from '../controllers/invite.controller.js';
import * as teamInvite from '../controllers/teamInvite.controller.js';
import * as participantInvite from '../controllers/participantInvite.controller.js';
import {verifyToken, requireRole, ROLES} from '@liga360/shared';

export function createRouter() {
  const router = Router();

  // Inscriptions (rutas literales antes de /:id para evitar que "lookup" matchee como id)
  router.post('/inscriptions', verifyToken, inscription.create);
  router.get('/inscriptions/lookup', inscription.lookupByIds);
  router.patch('/internal/inscriptions/:id/tournament-rating', requireServiceToken, inscription.updateTournamentRating);
  router.patch('/inscriptions/:id/status', verifyToken, requireRole([ROLES.ORGANIZER]), inscription.updateStatus);
  router.patch('/inscriptions/:id/competition', verifyToken, requireRole([ROLES.ORGANIZER]), inscription.moveCompetition);
  router.patch('/inscriptions/:id/weight', verifyToken, requireRole([ROLES.ORGANIZER]), inscription.updateWeight);
  router.post('/inscriptions/:id/associate', verifyToken, requireRole([ROLES.TEAM,ROLES.PARTICIPANT]), inscription.associate);
  // Endpoint interno service-to-service (matchevents-svc resuelve inscription → linked_team_id)
  router.get('/inscriptions/:id', requireServiceToken, inscription.getById);
  router.get('/tournaments/:id/inscriptions', verifyToken, inscription.listByTournament);
  router.get('/competitions/:id/inscriptions', verifyToken, inscription.listByCompetition);

  // Invites (rutas específicas antes de /:token)
  router.get('/invites', verifyToken, requireRole([ROLES.ORGANIZER]), invite.list);
  router.post('/invites', verifyToken, requireRole([ROLES.ORGANIZER]), invite.create);
  router.post('/invites/claims', verifyToken, invite.claimByCode);
  router.get('/invites/:token', invite.getByToken);
  router.post('/invites/:token/use', verifyToken, invite.use);

  // Team inscriptions (historial cross-torneo, público — antes de /teams/me/*)
  router.get('/teams/:teamId/inscriptions', inscription.listByTeam);

  // Team invites
  router.get('/teams/me/invites', verifyToken, requireRole([ROLES.TEAM]), teamInvite.list);
  router.post('/teams/me/invites/:id/accept', verifyToken, requireRole([ROLES.TEAM]), teamInvite.accept);
  router.post('/teams/me/invites/:id/reject', verifyToken, requireRole([ROLES.TEAM]), teamInvite.reject);

  // Participant invites
  router.get('/participants/me/invites', verifyToken, requireRole(ROLES.PARTICIPANT), participantInvite.list);
  router.post('/participants/me/invites/:id/accept', verifyToken, requireRole(ROLES.PARTICIPANT), participantInvite.accept);
  router.post('/participants/me/invites/:id/reject', verifyToken, requireRole(ROLES.PARTICIPANT), participantInvite.reject);

  return router;
}
