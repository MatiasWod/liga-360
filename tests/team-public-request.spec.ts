import { expect, test } from './fixtures';
import {
  createTeamAndOrganizerContext,
  createTournament,
  ensureBackendsHealthy,
  listTournamentInscriptions,
} from './helpers/api';
import { loginFromAuthPage, openTeamTournamentsPage } from './helpers/ui';

test('@critical team solicita inscripción a torneo público', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const ctx = await createTeamAndOrganizerContext(request, 'public_request');
  const tournament = await createTournament(request, ctx.organizer, {
    namePrefix: 'E2E Public Request',
    inscriptionMode: 'public',
  });

  await loginFromAuthPage(
    page,
    ctx.teamSession.credentials.username,
    ctx.teamSession.credentials.password
  );
  await openTeamTournamentsPage(page);

  await page.getByRole('heading', { name: tournament.name }).click();
  await page.getByRole('button', { name: 'Solicitar inscripción' }).click();

  await expect(
    page.getByText('Solicitud enviada al torneo. El organizador ya la puede aprobar o rechazar en gestión general.')
  ).toBeVisible();

  const inscriptions = await listTournamentInscriptions(request, ctx.organizer, tournament.id);
  const created = inscriptions.find(
    (item) => Number(item.linked_team_id) === ctx.team.id && String(item.tournament_id) === tournament.id
  );
  expect(created).toBeTruthy();
});
