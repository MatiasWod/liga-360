import { expect, test } from './fixtures';
import {
  createParticipantAndOrganizerContext,
  createTournament,
  ensureBackendsHealthy,
  listTournamentInscriptions,
} from './helpers/api';
import { loginFromAuthPage, openParticipantTournamentsPage } from './helpers/ui';

test('@critical participant solicita inscripción a torneo público', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const ctx = await createParticipantAndOrganizerContext(request, 'participant_public_request');
  const tournament = await createTournament(request, ctx.organizer, {
    namePrefix: 'E2E Participant Public Request',
    inscriptionMode: 'public',
  });

  await loginFromAuthPage(
    page,
    ctx.participantSession.credentials.username,
    ctx.participantSession.credentials.password
  );
  await openParticipantTournamentsPage(page);

  await page.getByRole('heading', { name: tournament.name }).click();
  await page.getByRole('button', { name: 'Solicitar inscripción' }).click();

  await expect(
    page.getByText('Solicitud enviada al torneo. El organizador ya la puede aprobar o rechazar en gestión general.')
  ).toBeVisible();

  const inscriptions = await listTournamentInscriptions(request, ctx.organizer, tournament.id);
  const created = inscriptions.find(
    (item) =>
      Number(item.linked_participant_user_id) === Number(ctx.participantSession.user.id) &&
      String(item.tournament_id) === tournament.id
  );
  expect(created).toBeTruthy();
});
