/**
 * Utilidades compartidas para scripts de seed (HTTP + GraphQL).
 */
export const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'SeedLiga360!';
export const AUTH_URL = (process.env.AUTH_URL || 'http://localhost:4003').replace(/\/$/, '');
export const TEAMS_URL = (process.env.TEAMS_URL || 'http://localhost:4002').replace(/\/$/, '');
export const INSCRIPTIONS_URL = (process.env.INSCRIPTIONS_URL || 'http://localhost:4004').replace(/\/$/, '');
export const MATCHES_URL = (process.env.MATCHES_URL || 'http://localhost:4006/matches').replace(/\/$/, '');
export const GRAPHQL_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql';

export async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const code = err?.cause?.code || err?.code || '';
    if (code === 'ECONNREFUSED' || String(err?.message || '').includes('fetch failed')) {
      throw new Error(
        `No se pudo conectar a ${url}\n` +
          '  → Levantá el stack antes del seed:\n' +
          '     npm run dev:bootstrap\n' +
          '  o: docker compose up -d && npm run seed:all\n' +
          '  (requiere Docker Desktop corriendo)'
      );
    }
    throw err;
  }
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${url} → ${res.status} (no JSON): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg = json?.error || json?.message || JSON.stringify(json);
    const err = new Error(`${method} ${url} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function login(username) {
  const data = await httpJson(`${AUTH_URL}/login`, {
    method: 'POST',
    body: { username, password: DEFAULT_PASSWORD },
  });
  if (!data?.token) throw new Error(`login sin token: ${username}`);
  return data.token;
}

export async function gql(token, query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

export async function findTournamentIdByName(token, name) {
  const data = await gql(token, `query { tournaments { id name status } }`, {});
  const hit = (data.tournaments || []).find((t) => t.name === name);
  return hit?.id || null;
}

export async function findTournamentByName(token, name) {
  const data = await gql(token, `query { tournaments { id name status } }`, {});
  return (data.tournaments || []).find((t) => t.name === name) || null;
}

export const TOURNAMENT_DETAIL = `
query ($id: ID!) {
  tournament(id: $id) {
    id name status sport season venue participantType
    competitions {
      id name order
      stages {
        id name format order stageStatus
        groups { id name order }
        matches {
          id status round slotIndex fixtureCode groupId matchKind
          homeScore awayScore
          homeAssignedInscription { inscriptionId displayName }
          awayAssignedInscription { inscriptionId displayName }
        }
      }
    }
  }
}`;

export function collectStageMatches(tournament, stageId = null) {
  const rows = [];
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      if (stageId && s.id !== stageId) continue;
      for (const m of s.matches || []) {
        rows.push({ ...m, competitionId: c.id, stageId: s.id, stageName: s.name, stageFormat: s.format });
      }
    }
  }
  return rows;
}

export function countMatches(tournament) {
  return collectStageMatches(tournament).length;
}

export function countFinishedMatches(tournament) {
  return collectStageMatches(tournament).filter((m) => isFinishedStatus(m.status)).length;
}

export function isFinishedStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'finished' || s === 'completed';
}

export function findDirectedResult(homeName, awayName, results) {
  for (const row of results) {
    const [h, a, hs, aws] = row;
    if (h === homeName && a === awayName) return { homeScore: hs, awayScore: aws };
    if (h === awayName && a === homeName) return { homeScore: aws, awayScore: hs };
  }
  return null;
}

export async function finishMatch(token, matchId, homeScore, awayScore) {
  await gql(token, MUT_UPDATE_RESULT, {
    matchId,
    homeScore,
    awayScore,
    status: 'finished',
  });
}

export async function applyDirectedResults(token, matches, results, { skipFinished = true } = {}) {
  let applied = 0;
  let skipped = 0;
  for (const m of matches) {
    const home = m.homeAssignedInscription?.displayName;
    const away = m.awayAssignedInscription?.displayName;
    if (!home || !away) continue;
    const hit = findDirectedResult(home, away, results);
    if (!hit) continue;
    if (
      skipFinished &&
      isFinishedStatus(m.status) &&
      m.homeScore === hit.homeScore &&
      m.awayScore === hit.awayScore
    ) {
      skipped += 1;
      continue;
    }
    await finishMatch(token, m.id, hit.homeScore, hit.awayScore);
    applied += 1;
  }
  return { applied, skipped };
}

export async function finishAllUnfinishedMatches(token, tournament) {
  const pending = collectStageMatches(tournament).filter((m) => !isFinishedStatus(m.status));
  for (const m of pending) {
    await finishMatch(token, m.id, 1, 0);
  }
  return pending.length;
}

export async function markTournamentFinished(token, tournamentId, tournamentMeta) {
  await gql(token, MUT_UPDATE_TOURNAMENT, {
    id: tournamentId,
    name: tournamentMeta.name,
    sport: tournamentMeta.sport || 'fútbol',
    season: tournamentMeta.season || null,
    venue: tournamentMeta.venue || null,
    participantType: tournamentMeta.participantType || 'teams',
    inscriptionMode: 'public',
    status: 'finished',
  });
}

export async function markStagesFinished(token, tournament) {
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      if (String(s.stageStatus || '').toLowerCase() === 'finished') continue;
      await gql(token, MUT_SET_STAGE_STATUS, { stageId: s.id, status: 'finished' });
    }
  }
}

export async function markStagesActive(token, tournament, { formats = null } = {}) {
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      if (formats && !formats.includes(s.format)) continue;
      if (String(s.stageStatus || '').toLowerCase() !== 'finished') continue;
      await gql(token, MUT_SET_STAGE_STATUS, { stageId: s.id, status: 'active' });
    }
  }
}

export async function markTournamentPublished(token, tournamentId, tournamentMeta) {
  await gql(token, MUT_UPDATE_TOURNAMENT, {
    id: tournamentId,
    name: tournamentMeta.name,
    sport: tournamentMeta.sport || 'fútbol',
    season: tournamentMeta.season || null,
    venue: tournamentMeta.venue || null,
    participantType: tournamentMeta.participantType || 'teams',
    inscriptionMode: 'public',
    status: 'published',
  });
}

export async function listTournamentInscriptions(token, tournamentId) {
  const data = await httpJson(`${INSCRIPTIONS_URL}/tournaments/${tournamentId}/inscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.inscriptions || [];
}

export async function createApprovedManualInscription(token, { tournamentId, competitionId, displayName }) {
  const created = await httpJson(`${INSCRIPTIONS_URL}/inscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      tournamentId,
      competitionId,
      displayName,
      source: 'manual',
    },
  });
  const id = Number(created?.inscription?.id);
  if (!Number.isFinite(id)) throw new Error(`sin id de inscripción para ${displayName}`);
  await httpJson(`${INSCRIPTIONS_URL}/inscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: { status: 'ACEPTADO' },
  });
  return id;
}

function inscriptionDisplayName(row) {
  return String(row?.displayName || row?.display_name || '').trim();
}

export async function ensureInscriptionMap(token, { tournamentId, competitionId, teamNames }) {
  const existing = await listTournamentInscriptions(token, tournamentId);
  const map = new Map();
  for (const row of existing) {
    const label = inscriptionDisplayName(row);
    if (String(row.status || '').toUpperCase() === 'ACEPTADO' && label) {
      map.set(label, Number(row.id));
    }
  }
  for (const name of teamNames) {
    if (map.has(name)) continue;
    try {
      const id = await createApprovedManualInscription(token, { tournamentId, competitionId, displayName: name });
      map.set(name, id);
      console.log(`    inscripción creada: ${name}`);
    } catch (err) {
      if (err.status !== 409) throw err;
      const refreshed = await listTournamentInscriptions(token, tournamentId);
      const hit = refreshed.find(
        (row) =>
          String(row.status || '').toUpperCase() === 'ACEPTADO' &&
          inscriptionDisplayName(row).toLowerCase() === name.toLowerCase()
      );
      if (!hit?.id) throw err;
      map.set(name, Number(hit.id));
    }
  }
  return map;
}

const MUT_UPDATE_RESULT = `
mutation ($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
  updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
    id status homeScore awayScore
  }
}`;

const MUT_UPDATE_TOURNAMENT = `
mutation ($id: ID!, $name: String!, $sport: String!, $season: String, $venue: String, $participantType: String, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
  updateTournament(id: $id, name: $name, sport: $sport, season: $season, venue: $venue, participantType: $participantType, inscriptionMode: $inscriptionMode, status: $status) {
    id name status
  }
}`;

const MUT_SET_STAGE_STATUS = `
mutation ($stageId: ID!, $status: String!) {
  setStageStatus(stageId: $stageId, status: $status) { id stageStatus }
}`;
