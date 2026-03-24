import { expect, test } from './fixtures';
import {
  createTargetedInvite,
  createTeamAndOrganizerContext,
  createTournament,
  ensureBackendsHealthy,
  listTeamInvites,
} from './helpers/api';
import { loginFromAuthPage, openTeamHomePage } from './helpers/ui';

test('@critical team acepta y rechaza invitaciones desde Home', async ({ page, request }) => {
  await ensureBackendsHealthy(request);
  const ctx = await createTeamAndOrganizerContext(request, 'home_invites');
  const tournament = await createTournament(request, ctx.organizer, {
    namePrefix: 'E2E Team Home Invites',
    inscriptionMode: 'invitation',
  });

  await createTargetedInvite(request, ctx.organizer, tournament.id, ctx.team.inviteCode);
  await createTargetedInvite(request, ctx.organizer, tournament.id, ctx.team.inviteCode);

  await loginFromAuthPage(
    page,
    ctx.teamSession.credentials.username,
    ctx.teamSession.credentials.password
  );
  await openTeamHomePage(page);

  await page.getByRole('button', { name: 'Aceptar' }).first().click();
  await expect(page.getByText('Aceptada')).toBeVisible();

  await page.getByRole('button', { name: 'Rechazar' }).first().click();
  await expect(page.getByText('Rechazada')).toBeVisible();

  const invites = await listTeamInvites(request, ctx.teamSession);
  const statuses = invites.map((invite) => String(invite.invite_response_status || 'pending'));
  expect(statuses).toContain('accepted');
  expect(statuses).toContain('rejected');
});
