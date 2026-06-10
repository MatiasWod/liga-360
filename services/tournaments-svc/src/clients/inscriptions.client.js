/** Cliente HTTP hacia inscriptions-svc (lookup público por ids). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

/** Map inscriptionId → linked_team_id (number|null). */
export async function lookupLinkedTeamIds(inscriptionIds) {
  const ids = [...new Set(inscriptionIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return new Map();
  const qs = ids.map((id) => `ids=${encodeURIComponent(String(id))}`).join('&');
  try {
    const json = await svcGet(env.inscriptionsSvcUrl, `/inscriptions/lookup?${qs}`);
    const rows = json?.inscriptions ?? [];
    const map = new Map();
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      map.set(String(id), row.linked_team_id != null ? Number(row.linked_team_id) : null);
    }
    return map;
  } catch {
    return new Map();
  }
}
