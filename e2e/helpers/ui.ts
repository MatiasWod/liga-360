import type { Page } from '@playwright/test';

export async function loginFromAuthPage(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await page.locator('label:has-text("Usuario") input').fill(username);
  await page.locator('label:has-text("Contrasena") input').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

export async function openTeamTournamentsPage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Torneos' }).first().click();
  await page.getByRole('heading', { name: 'Torneos' }).waitFor({ state: 'visible' });
}

export async function openTeamHomePage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Inicio' }).first().click();
  await page.getByText('Invitaciones recibidas').waitFor({ state: 'visible' });
}
