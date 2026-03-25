import { expect, test } from '@playwright/test';

test('@smoke muestra pantalla de autenticacion al abrir la app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LIGA360' })).toBeVisible();
  await expect(page.getByText('Inicia sesion o registrate para usar el flujo completo.')).toBeVisible();
});
