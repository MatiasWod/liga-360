import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
// Puerto dedicado a E2E para no chocar con `vite preview` (4173) ni servidores colgados.
const e2ePort = process.env.E2E_PORT || '4174';
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;
// Solo reutilizar servidor si lo pedís explícito (más rápido al iterar; pre-push arranca limpio).
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === '1';
// Headless por defecto (pre-push, CI). Para ver el navegador: PWHEADED=1 npm run test:e2e:smoke
const headed = process.env.PWHEADED === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: isCI,
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  outputDir: 'test-results/playwright',
  use: {
    baseURL: e2eOrigin,
    trace: 'on-first-retry',
    headless: !headed,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eOrigin,
    timeout: 120 * 1000,
    reuseExistingServer,
  },
  projects: [
    {
      name: 'critical',
      grep: /@critical/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
