import { expect, test } from '@playwright/test';

test('@smoke muestra pantalla de autenticacion al abrir la app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Liga360' })).toBeVisible();
  await expect(page.getByText('Visualización pública de torneos, fases y partidos.')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'LIGA360' })).toBeVisible();
  await expect(page.getByText('Inicia sesion o registrate para usar el flujo completo.')).toBeVisible();
});
