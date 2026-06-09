import { Router } from 'express';
import {
  requireAuthMiddleware,
  requireOrganizer,
  requireTeamUser,
  requireParticipantUser,
} from '../middleware/auth.js';
import * as inscription from '../controllers/inscription.controller.js';
import * as invite from '../controllers/invite.controller.js';
import * as teamInvite from '../controllers/teamInvite.controller.js';
import * as participantInvite from '../controllers/participantInvite.controller.js';

export function createRouter() {
  const router = Router();

  // Inscriptions
  router.post('/inscriptions', inscription.create);
  router.patch('/inscriptions/:id/status', requireOrganizer, inscription.updateStatus);
  router.patch('/inscriptions/:id/competition', requireOrganizer, inscription.moveCompetition);
  router.post('/inscriptions/:id/associate', requireTeamUser, inscription.associate);
  router.get('/tournaments/:id/inscriptions', requireAuthMiddleware, inscription.listByTournament);
  router.get('/competitions/:id/inscriptions', requireAuthMiddleware, inscription.listByCompetition);

  // Invites (rutas específicas antes de /:token)
  router.get('/invites', requireOrganizer, invite.list);
  router.post('/invites', requireOrganizer, invite.create);
  router.post('/invites/claims', requireAuthMiddleware, invite.claimByCode);
  router.get('/invites/:token', invite.getByToken);
  router.post('/invites/:token/use', invite.use);

  // Team invites
  router.get('/teams/me/invites', requireTeamUser, teamInvite.list);
  router.post('/teams/me/invites/:id/accept', requireTeamUser, teamInvite.accept);
  router.post('/teams/me/invites/:id/reject', requireTeamUser, teamInvite.reject);

  // Participant invites
  router.get('/participants/me/invites', requireParticipantUser, participantInvite.list);
  router.post('/participants/me/invites/:id/accept', requireParticipantUser, participantInvite.accept);
  router.post('/participants/me/invites/:id/reject', requireParticipantUser, participantInvite.reject);

  return router;
}
