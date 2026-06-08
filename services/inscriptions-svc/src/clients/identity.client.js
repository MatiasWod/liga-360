/** Cliente HTTP hacia identity-svc (dueño de Person_Profile). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

const BASE = env.identitySvcUrl;

export async function getProfileIdByUser(userId) {
  const body = await svcGet(BASE, `/profiles?userId=${encodeURIComponent(userId)}`);
  return body?.profile?.id ?? null;
}
