import { expect, test } from '@playwright/test';

test('@smoke muestra pantalla de autenticacion al abrir la app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LIGA360' })).toBeVisible();
  // La home muestra la vista pública; el botón de login abre el formulario de auth
  const loginBtn = page.getByRole('button', { name: 'Iniciar sesión' });
  await expect(loginBtn).toBeVisible();
  await loginBtn.click();
  await expect(page.getByText('Inicia sesion o registrate para usar el flujo completo.')).toBeVisible();
});
