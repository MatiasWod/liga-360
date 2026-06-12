/** Cliente HTTP hacia inscriptions-svc (lookup, listado y creación con JWT organizador). */
import { env } from '../config/env.js';
import { svcGet, userPatch, userPost } from './http.js';

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

/** Lookup completo por ids (incluye weight, competition_id, display_name, status). */
export async function lookupInscriptionsByIds(inscriptionIds) {
  const ids = [...new Set(inscriptionIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return new Map();
  const qs = ids.map((id) => `ids=${encodeURIComponent(String(id))}`).join('&');
  try {
    const json = await svcGet(env.inscriptionsSvcUrl, `/inscriptions/lookup?${qs}`);
    const rows = json?.inscriptions ?? [];
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.id), row);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function listTournamentInscriptions(tournamentId) {
  const json = await svcGet(env.inscriptionsSvcUrl, `/tournaments/${encodeURIComponent(tournamentId)}/inscriptions`);
  return json?.inscriptions ?? [];
}

export async function createAcceptedTeamInscription(
  {
    tournamentId,
    competitionId,
    displayName,
    linkedTeamId,
    weight,
  },
  authHeader
) {
  const created = await userPost(
    env.inscriptionsSvcUrl,
    '/inscriptions',
    {
      tournamentId,
      competitionId,
      displayName,
      source: 'manual',
      linkedTeamId: linkedTeamId ?? null,
      competitorKind: 'team',
    },
    authHeader
  );
  const inscription = created?.inscription;
  if (!inscription?.id) throw new Error('DOWNSTREAM_ERROR: no se pudo crear inscripción');

  await userPatch(
    env.inscriptionsSvcUrl,
    `/inscriptions/${inscription.id}/status`,
    { status: 'ACEPTADO' },
    authHeader
  );

  if (weight != null && weight !== '') {
    const n = Number(weight);
    if (Number.isInteger(n) && n >= 1 && n <= 10) {
      await userPatch(
        env.inscriptionsSvcUrl,
        `/inscriptions/${inscription.id}/weight`,
        { weight: n },
        authHeader
      );
    }
  }

  return inscription;
}
