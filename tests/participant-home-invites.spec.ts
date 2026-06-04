import { expect, test } from './fixtures';
import {
  createParticipantAndOrganizerContext,
  createTargetedInvite,
  createTournament,
  ensureBackendsHealthy,
  listParticipantInvites,
  listTournamentInscriptions,
} from './helpers/api';
import { loginFromAuthPage, openParticipantTournamentsPage } from './helpers/ui';

test('@critical participant acepta y rechaza invitaciones dirigidas', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const acceptCtx = await createParticipantAndOrganizerContext(request, 'participant_invites_accept');
  const acceptTournament = await createTournament(request, acceptCtx.organizer, {
    namePrefix: 'E2E Participant Invite Accept',
    inscriptionMode: 'invitation',
  });
  await createTargetedInvite(
    request,
    acceptCtx.organizer,
    acceptTournament.id,
    null,
    Number(acceptCtx.participantSession.user.id)
  );

  await loginFromAuthPage(
    page,
    acceptCtx.participantSession.credentials.username,
    acceptCtx.participantSession.credentials.password
  );
  await openParticipantTournamentsPage(page);
  await page.getByRole('button', { name: 'Mis invitaciones' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).first().click();

  const acceptedInvites = await listParticipantInvites(request, acceptCtx.participantSession);
  const acceptedInvite = acceptedInvites.find((invite) => String(invite.tournament_id) === String(acceptTournament.id));
  expect(String(acceptedInvite?.invite_response_status || '').toLowerCase()).toBe('accepted');
  const acceptedInscriptions = await listTournamentInscriptions(request, acceptCtx.organizer, acceptTournament.id);
  const acceptedInscription = acceptedInscriptions.find(
    (item) =>
      Number(item.linked_participant_user_id) === Number(acceptCtx.participantSession.user.id) &&
      String(item.status) === 'ACEPTADO'
  );
  expect(acceptedInscription).toBeTruthy();

  const rejectCtx = await createParticipantAndOrganizerContext(request, 'participant_invites_reject');
  const rejectTournament = await createTournament(request, rejectCtx.organizer, {
    namePrefix: 'E2E Participant Invite Reject',
    inscriptionMode: 'invitation',
  });
  await createTargetedInvite(
    request,
    rejectCtx.organizer,
    rejectTournament.id,
    null,
    Number(rejectCtx.participantSession.user.id)
  );

  await loginFromAuthPage(
    page,
    rejectCtx.participantSession.credentials.username,
    rejectCtx.participantSession.credentials.password
  );
  await openParticipantTournamentsPage(page);
  await page.getByRole('button', { name: 'Mis invitaciones' }).click();
  await page.getByRole('button', { name: 'Rechazar' }).first().click();

  const rejectedInvites = await listParticipantInvites(request, rejectCtx.participantSession);
  const rejectedInvite = rejectedInvites.find((invite) => String(invite.tournament_id) === String(rejectTournament.id));
  expect(String(rejectedInvite?.invite_response_status || '').toLowerCase()).toBe('rejected');
});
