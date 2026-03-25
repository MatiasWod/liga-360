import { test as base, expect } from '@playwright/test';
import { ensureBackendsHealthy } from './helpers/api';

export const test = base.extend({
  // Reserved for future fixture composition.
});

export { expect };

export async function requireCriticalBackend(testInfo: { title: string }, request: Parameters<typeof ensureBackendsHealthy>[0]) {
  await ensureBackendsHealthy(request);
  testInfo.title = testInfo.title;
}
