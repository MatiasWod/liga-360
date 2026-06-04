import { expect, test } from './fixtures';
import {
  createParticipantAndOrganizerContext,
  createPublicInvite,
  createTournament,
  ensureBackendsHealthy,
  listTournamentInscriptions,
} from './helpers/api';
import { loginFromAuthPage, openParticipantTournamentsPage } from './helpers/ui';

test('@critical participant usa código de invitación pública', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const ctx = await createParticipantAndOrganizerContext(request, 'participant_code_claim');
  const tournament = await createTournament(request, ctx.organizer, {
    namePrefix: 'E2E Participant Code Claim',
    inscriptionMode: 'public',
  });
  const inviteCode = await createPublicInvite(request, ctx.organizer, tournament.id);

  await loginFromAuthPage(
    page,
    ctx.participantSession.credentials.username,
    ctx.participantSession.credentials.password
  );
  await openParticipantTournamentsPage(page);

  await page.getByPlaceholder('Ej: A7K2P9QX').fill(inviteCode);
  await page.getByRole('button', { name: 'Usar código' }).click();

  await expect(
    page.getByText('Inscripción enviada por código. Queda pendiente de aprobación del organizador.')
  ).toBeVisible();

  const inscriptions = await listTournamentInscriptions(request, ctx.organizer, tournament.id);
  const created = inscriptions.find(
    (item) =>
      Number(item.linked_participant_user_id) === Number(ctx.participantSession.user.id) &&
      String(item.tournament_id) === tournament.id
  );
  expect(created).toBeTruthy();
});
