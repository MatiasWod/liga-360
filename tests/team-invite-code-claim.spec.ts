import { expect, test } from './fixtures';
import {
  createPublicInvite,
  createTeamAndOrganizerContext,
  createTournament,
  ensureBackendsHealthy,
  listTournamentInscriptions,
} from './helpers/api';
import { loginFromAuthPage, openTeamTournamentsPage } from './helpers/ui';

test('@critical team usa código de invitación (válido e inválido)', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const ctx = await createTeamAndOrganizerContext(request, 'claim_code');
  const tournament = await createTournament(request, ctx.organizer, {
    namePrefix: 'E2E Claim Code',
    inscriptionMode: 'public',
  });
  const validCode = await createPublicInvite(request, ctx.organizer, tournament.id);

  await loginFromAuthPage(
    page,
    ctx.teamSession.credentials.username,
    ctx.teamSession.credentials.password
  );
  await openTeamTournamentsPage(page);

  await page.getByPlaceholder('Ej: A7K2P9QX').fill('INVALID01');
  await page.getByRole('button', { name: 'Usar código' }).click();
  await expect(page.getByText('codigo de invitacion no existe')).toBeVisible();

  await page.getByPlaceholder('Ej: A7K2P9QX').fill(validCode);
  await page.getByRole('button', { name: 'Usar código' }).click();

  await expect(
    page.getByText('Inscripción enviada por código. Queda pendiente de aprobación del organizador.')
  ).toBeVisible();

  const inscriptions = await listTournamentInscriptions(request, ctx.organizer, tournament.id);
  const created = inscriptions.find(
    (item) => Number(item.linked_team_id) === ctx.team.id && String(item.tournament_id) === tournament.id
  );
  expect(created).toBeTruthy();
});
