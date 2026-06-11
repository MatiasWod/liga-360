#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Carga datos de demo en auth, teams-svc y tournaments (GraphQL vía gateway).
 *
 * Uso:
 *   npm run seed:dev
 *   node scripts/seed-dev-data.mjs --help
 *
 * Requiere servicios arriba (por defecto URLs locales / Docker):
 *   AUTH_URL, TEAMS_URL, GRAPHQL_URL
 *
 * Contraseña única para todos los usuarios demo: SEED_PASSWORD (default SeedLiga360!)
 */

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'SeedLiga360!';
const AUTH_URL = (process.env.AUTH_URL || 'http://localhost:4003').replace(/\/$/, '');
const TEAMS_URL = (process.env.TEAMS_URL || 'http://localhost:4002').replace(/\/$/, '');
const INSCRIPTIONS_URL = (process.env.INSCRIPTIONS_URL || 'http://localhost:4004').replace(/\/$/, '');
const GRAPHQL_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SEED_TEAM_TOURNAMENT = 'Liga Demo Liga360';
const SEED_ACTIVE_TEAM_TOURNAMENT = 'Liga Activos Demo Liga360';
const SEED_INDIV_TOURNAMENT = 'Torneo individual demo';

const USERS = [
  { mode: 'organizer', username: 'organizador', name: 'Organizador Demo' },
  { mode: 'team', username: 'equipo_alpha', name: 'Equipo Alpha' },
  { mode: 'team', username: 'equipo_beta', name: 'Equipo Beta' },
  { mode: 'team', username: 'equipo_gamma', name: 'Equipo Gamma' },
  { mode: 'team', username: 'equipo_delta', name: 'Equipo Delta' },
  { mode: 'participant', username: 'participante_ana', name: 'Ana García' },
  { mode: 'participant', username: 'participante_luis', name: 'Luis Pérez' },
  { mode: 'participant', username: 'participante_mia', name: 'Mia Rodríguez' },
];

async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
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

async function registerOrSkip({ mode, username, name }) {
  try {
    await httpJson(`${AUTH_URL}/register`, {
      method: 'POST',
      body: { mode, username, password: DEFAULT_PASSWORD, name },
    });
    console.log(`  registro: ${username} (${mode})`);
  } catch (e) {
    if (e.status === 409) {
      console.log(`  ya existe: ${username}`);
    } else {
      throw e;
    }
  }
}

async function login(username) {
  const data = await httpJson(`${AUTH_URL}/login`, {
    method: 'POST',
    body: { username, password: DEFAULT_PASSWORD },
  });
  if (!data?.token) throw new Error(`login sin token: ${username}`);
  return data.token;
}

/** Devuelve token JWT y `user` (incluye type_id para participantes). */
async function loginWithUser(username) {
  const data = await httpJson(`${AUTH_URL}/login`, {
    method: 'POST',
    body: { username, password: DEFAULT_PASSWORD },
  });
  if (!data?.token) throw new Error(`login sin token: ${username}`);
  return { token: data.token, user: data.user };
}

/** Resuelve Participant.id creado al registrarse (auth → teams-svc). Solo dev local con Docker. */
function participantIdForUserId(userId) {
  try {
    const out = execSync(
      `docker compose exec -T postgres psql -U liga -d liga360_teams -tAc 'SELECT id FROM "Participant" WHERE created_by_user_id = ${Number(userId)} ORDER BY id LIMIT 1'`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    const id = Number(out);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function setParticipantDni(participantId, dni) {
  execSync(
    `docker compose exec -T postgres psql -U liga -d liga360_teams -c "UPDATE \\"Participant\\" SET dni = '${String(dni).replace(/'/g, "''")}' WHERE id = ${Number(participantId)}"`,
    { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

async function claimParticipantProfile(token, { dni, firstName, lastName }) {
  await httpJson(`${TEAMS_URL}/profiles/me/claims`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { dni, firstName, lastName },
  });
}

async function addTeamMember(ownerToken, teamId, participantId) {
  await httpJson(`${TEAMS_URL}/teams/${teamId}/members`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: { participantId: Number(participantId) },
  });
}

async function listTeamMemberIds(teamId) {
  const data = await httpJson(`${TEAMS_URL}/teams/${teamId}`);
  return (data.members || []).map((m) => Number(m.id));
}

async function listMyTeams(token) {
  const data = await httpJson(`${TEAMS_URL}/teams?mine=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data?.teams || [];
}

async function createTeam(token, name) {
  const data = await httpJson(`${TEAMS_URL}/teams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name },
  });
  return data?.team;
}

async function gql(token, query, variables = {}) {
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

async function findTournamentIdByName(token, name) {
  const data = await gql(
    token,
    `query { tournaments { id name } }`,
    {}
  );
  const hit = (data.tournaments || []).find((t) => t.name === name);
  return hit?.id || null;
}

/** Inscripción manual (organizer) + aprobación, para alinear Neo4j con Postgres. */
async function createApprovedTeamInscription(orgToken, { tournamentId, competitionId, linkedTeamId, displayName }) {
  const created = await httpJson(`${INSCRIPTIONS_URL}/inscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: {
      tournamentId,
      competitionId,
      displayName,
      source: 'manual',
      linkedTeamId,
    },
  });
  const row = created?.inscription;
  const id = Number(row?.id);
  if (!Number.isFinite(id)) throw new Error('createApprovedTeamInscription: sin id de inscripción');
  await httpJson(`${INSCRIPTIONS_URL}/inscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: { status: 'ACEPTADO' },
  });
  return id;
}

async function createApprovedParticipantInscription(orgToken, { tournamentId, competitionId, linkedParticipantUserId, displayName }) {
  const created = await httpJson(`${INSCRIPTIONS_URL}/inscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: {
      tournamentId,
      competitionId,
      displayName,
      source: 'manual',
      competitorKind: 'participant',
      linkedParticipantUserId,
    },
  });
  const row = created?.inscription;
  const id = Number(row?.id);
  if (!Number.isFinite(id)) throw new Error('createApprovedParticipantInscription: sin id de inscripción');
  await httpJson(`${INSCRIPTIONS_URL}/inscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: { status: 'ACEPTADO' },
  });
  return id;
}

async function seedTeamsTournament(orgToken, teamNameToTeamId) {
  const existingId = await findTournamentIdByName(orgToken, SEED_TEAM_TOURNAMENT);
  if (existingId && inscriptionCountForTournament(existingId) > 0) {
    console.log(`  torneo equipos ya existe: ${existingId} — omitiendo creación`);
    return;
  }
  if (existingId) {
    console.log(`  torneo en Neo4j sin inscripciones Postgres (${existingId}) — completando fixture`);
    await populateTeamsTournament(orgToken, teamNameToTeamId, existingId);
    return;
  }

  const d1 = await gql(orgToken, MUT_CREATE_TOURNAMENT, {
    name: SEED_TEAM_TOURNAMENT,
    sport: 'fútbol',
    season: '2026',
    venue: 'Cancha sintética Norte',
    participantType: 'teams',
    maxSlots: 16,
    inscriptionMode: 'public',
    status: 'published',
  });
  const tournamentId = d1.t.id;
  console.log(`  torneo equipos: ${tournamentId} (${d1.t.name})`);
  await populateTeamsTournament(orgToken, teamNameToTeamId, tournamentId);
}

function inscriptionCountForTournament(tournamentId) {
  try {
    const out = execSync(
      `docker compose exec -T postgres psql -U liga -d liga360_inscriptions -tAc "SELECT COUNT(*) FROM \\"Inscription\\" WHERE tournament_id = '${String(tournamentId).replace(/'/g, "''")}'"`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

const TOURNAMENT_DETAIL = `
query ($id: ID!) {
  tournament(id: $id) {
    id name
    competitions {
      id name order
      stages {
        id name format order
        matches { id status round }
      }
    }
  }
}`;

function countStageMatches(tournament) {
  let n = 0;
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      n += (s.matches || []).length;
    }
  }
  return n;
}

async function populateTeamsTournament(orgToken, teamNameToTeamId, tournamentId) {
  const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const tournament = detail.tournament;

  let competitionId;
  let stageId;
  const existingComp = (tournament?.competitions || []).find((c) => c.name === 'Primera división');
  if (existingComp) {
    competitionId = existingComp.id;
    const existingStage = (existingComp.stages || []).find(
      (s) => s.name === 'Fase regular' || s.format === 'league'
    );
    stageId = existingStage?.id;
    console.log(`  reutilizando competición ${competitionId}${stageId ? `, etapa ${stageId}` : ''}`);
  }

  if (!competitionId) {
    const comp = await gql(orgToken, MUT_CREATE_COMPETITION, {
      tournamentId,
      name: 'Primera división',
      order: 1,
      maxSlots: 16,
    });
    competitionId = comp.c.id;
  }

  if (!stageId) {
    const stage = await gql(orgToken, MUT_ADD_STAGE_LEAGUE, {
      competitionId,
      name: 'Fase regular',
      order: 1,
      configJson: '{"numParticipants":4}',
    });
    stageId = stage.s.id;
    console.log(`  etapa liga: ${stageId}`);
  }

  const existingCount = inscriptionCountForTournament(tournamentId);
  if (existingCount >= 4) {
    console.log(`  inscripciones ya existen (${existingCount}) — omitiendo alta`);
  } else {
    const teamSeedRows = [
      { name: 'Equipo Alpha', display: 'Equipo Alpha' },
      { name: 'Equipo Beta', display: 'Equipo Beta' },
      { name: 'Equipo Gamma', display: 'Equipo Gamma' },
      { name: 'Equipo Delta', display: 'Equipo Delta' },
    ];
    for (const row of teamSeedRows) {
      const linkedTeamId = teamNameToTeamId.get(row.name);
      if (linkedTeamId == null) {
        throw new Error(`seed: no hay teamId en teams-svc para "${row.name}" (¿faltó crear equipos?)`);
      }
      const inscriptionId = await createApprovedTeamInscription(orgToken, {
        tournamentId,
        competitionId,
        linkedTeamId,
        displayName: row.display,
      });
      await gql(orgToken, MUT_ASSIGN_INSCRIPTION, {
        stageId,
        inscriptionId: String(inscriptionId),
        tournamentId,
        displayName: row.display,
      });
    }
    console.log('  inscripciones Postgres + asignación a etapa (4 equipos)');
  }

  const afterDetail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  let matches = [];
  if (countStageMatches(afterDetail.tournament) > 0) {
    console.log(`  fixture ya generado (${countStageMatches(afterDetail.tournament)} partidos)`);
    for (const c of afterDetail.tournament?.competitions || []) {
      for (const s of c.stages || []) {
        matches.push(...(s.matches || []));
      }
    }
  } else {
    const gen = await gql(orgToken, MUT_GEN_RR, { stageId, doubleRound: false });
    matches = gen.matches || [];
    console.log(`  partidos generados: ${matches.length}`);
  }

  const unfinished = matches.filter((m) => {
    const s = String(m.status || '').toLowerCase();
    return s !== 'finished' && s !== 'completed';
  });
  if (unfinished.length === 0) {
    console.log(`  todos los partidos ya tienen resultado (${matches.length}) — omitiendo`);
    return;
  }
  const toFinish = unfinished.slice(0, 3);
  for (const m of toFinish) {
    await gql(orgToken, MUT_UPDATE_RESULT, {
      matchId: m.id,
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
    });
  }
  console.log(`  resultados cargados: ${toFinish.length} partidos (${unfinished.length - toFinish.length} pendientes para seed:stats-demo)`);
}

function isFinishedMatchStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'finished' || s === 'completed';
}

const TOURNAMENT_DETAIL_ACTIVE = `
query ($id: ID!) {
  tournament(id: $id) {
    id name status
    competitions {
      id name order
      stages {
        id name format order stageStatus
        matches { id status round leg }
      }
    }
  }
}`;

/** Torneo de equipos publicado, etapa activa y fecha 2+ pendiente (Agenda participante Ana: Alpha + Delta). */
async function seedActiveTeamsTournament(orgToken, teamNameToTeamId) {
  const existingId = await findTournamentIdByName(orgToken, SEED_ACTIVE_TEAM_TOURNAMENT);
  if (existingId) {
    console.log(`  torneo activo equipos ya existe: ${existingId} — verificando fixture`);
    await populateActiveTeamsTournament(orgToken, teamNameToTeamId, existingId);
    return;
  }

  const created = await gql(orgToken, MUT_CREATE_TOURNAMENT, {
    name: SEED_ACTIVE_TEAM_TOURNAMENT,
    sport: 'fútbol',
    season: '2026',
    venue: 'Polideportivo Centro',
    participantType: 'teams',
    maxSlots: 16,
    inscriptionMode: 'public',
    status: 'published',
  });
  const tournamentId = created.t.id;
  console.log(`  torneo activo equipos: ${tournamentId} (${created.t.name})`);
  await populateActiveTeamsTournament(orgToken, teamNameToTeamId, tournamentId);
}

async function populateActiveTeamsTournament(orgToken, teamNameToTeamId, tournamentId) {
  const detail = await gql(orgToken, TOURNAMENT_DETAIL_ACTIVE, { id: tournamentId });
  const tournament = detail.tournament;

  let competitionId;
  let stageId;
  const existingComp = (tournament?.competitions || []).find((c) => c.name === 'Primera división');
  if (existingComp) {
    competitionId = existingComp.id;
    const existingStage = (existingComp.stages || []).find(
      (s) => s.name === 'Fase regular' || s.format === 'league'
    );
    stageId = existingStage?.id;
  }

  if (!competitionId) {
    const comp = await gql(orgToken, MUT_CREATE_COMPETITION, {
      tournamentId,
      name: 'Primera división',
      order: 1,
      maxSlots: 16,
    });
    competitionId = comp.c.id;
  }

  if (!stageId) {
    const stage = await gql(orgToken, MUT_ADD_STAGE_LEAGUE, {
      competitionId,
      name: 'Fase regular',
      order: 1,
      configJson: '{"numParticipants":4}',
    });
    stageId = stage.s.id;
    console.log(`  etapa liga activa: ${stageId}`);
  }

  const existingCount = inscriptionCountForTournament(tournamentId);
  if (existingCount >= 4) {
    console.log(`  inscripciones activas ya existen (${existingCount})`);
  } else {
    const teamSeedRows = [
      { name: 'Equipo Alpha', display: 'Equipo Alpha' },
      { name: 'Equipo Beta', display: 'Equipo Beta' },
      { name: 'Equipo Gamma', display: 'Equipo Gamma' },
      { name: 'Equipo Delta', display: 'Equipo Delta' },
    ];
    for (const row of teamSeedRows) {
      const linkedTeamId = teamNameToTeamId.get(row.name);
      if (linkedTeamId == null) {
        throw new Error(`seed activo: no hay teamId para "${row.name}"`);
      }
      const inscriptionId = await createApprovedTeamInscription(orgToken, {
        tournamentId,
        competitionId,
        linkedTeamId,
        displayName: row.display,
      });
      await gql(orgToken, MUT_ASSIGN_INSCRIPTION, {
        stageId,
        inscriptionId: String(inscriptionId),
        tournamentId,
        displayName: row.display,
      });
    }
    console.log('  inscripciones activas: Alpha, Beta, Gamma, Delta');
  }

  const afterDetail = await gql(orgToken, TOURNAMENT_DETAIL_ACTIVE, { id: tournamentId });
  let matches = [];
  if (countStageMatches(afterDetail.tournament) > 0) {
    for (const c of afterDetail.tournament?.competitions || []) {
      for (const s of c.stages || []) {
        matches.push(...(s.matches || []));
      }
    }
  } else {
    const gen = await gql(orgToken, MUT_GEN_RR, { stageId, doubleRound: false });
    matches = gen.matches || [];
    console.log(`  fixture activo generado: ${matches.length} partidos`);
  }

  const roundOnePending = matches.filter(
    (m) => (m.round ?? 0) === 1 && !isFinishedMatchStatus(m.status)
  );
  for (const m of roundOnePending) {
    await gql(orgToken, MUT_UPDATE_RESULT, {
      matchId: m.id,
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
    });
  }
  if (roundOnePending.length > 0) {
    console.log(`  fecha 1 cerrada: ${roundOnePending.length} partido(s)`);
  }

  const stageRow = (afterDetail.tournament?.competitions || [])
    .flatMap((c) => c.stages || [])
    .find((s) => s.id === stageId);
  if (String(stageRow?.stageStatus || '').toLowerCase() !== 'active') {
    await gql(orgToken, MUT_SET_STAGE_STATUS, { stageId, status: 'active' });
    console.log('  etapa marcada como active');
  }

  const finalDetail = await gql(orgToken, TOURNAMENT_DETAIL_ACTIVE, { id: tournamentId });
  const finalMatches = (finalDetail.tournament?.competitions || []).flatMap((c) =>
    (c.stages || []).flatMap((s) => s.matches || [])
  );
  const stillPending = finalMatches.filter((m) => !isFinishedMatchStatus(m.status));
  const minPendingRound =
    stillPending.length > 0 ? Math.min(...stillPending.map((m) => m.round ?? 99)) : null;
  console.log(
    `  torneo activo listo: ${stillPending.length} partido(s) pendiente(s)${
      minPendingRound != null ? `, próxima fecha ${minPendingRound}` : ''
    }`
  );
}

/** Corrige seeds viejos que guardaron Participant.id en vez de auth user.id. */
function repairIndividualInscriptionAuthUserIds(tournamentId, participants) {
  for (const p of participants) {
    const authUserId = Number(p.linkedParticipantUserId);
    const displayName = String(p.displayName || '').replace(/'/g, "''");
    const tid = String(tournamentId).replace(/'/g, "''");
    if (!Number.isFinite(authUserId) || authUserId <= 0 || !displayName) continue;
    try {
      execSync(
        `docker compose exec -T postgres psql -U liga -d liga360_inscriptions -c "UPDATE \\"Inscription\\" SET linked_participant_user_id = ${authUserId} WHERE tournament_id = '${tid}' AND display_name = '${displayName}' AND competitor_kind = 'participant'"`,
        { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch {
      // Sin Docker local: el alta nueva ya usa auth user.id.
    }
  }
}

/**
 * @param {Array<{ linkedParticipantUserId: number; displayName: string }>} participants
 */
async function seedIndividualsTournament(orgToken, participants) {
  const existingId = await findTournamentIdByName(orgToken, SEED_INDIV_TOURNAMENT);
  if (existingId) {
    console.log(`  torneo individual ya existe: ${existingId} — reparando vínculos de usuario`);
    repairIndividualInscriptionAuthUserIds(existingId, participants);
    return;
  }

  const indiv = await gql(orgToken, MUT_CREATE_TOURNAMENT, {
    name: SEED_INDIV_TOURNAMENT,
    sport: 'tenis de mesa',
    season: '2026',
    venue: 'Club Social',
    participantType: 'individuals',
    maxSlots: 8,
    inscriptionMode: 'public',
    status: 'published',
  });
  const tid2 = indiv.t.id;

  const comp2 = await gql(orgToken, MUT_CREATE_COMPETITION, {
    tournamentId: tid2,
    name: 'Cuadro principal',
    order: 1,
    maxSlots: 8,
  });

  const stage2 = await gql(orgToken, MUT_ADD_STAGE_LEAGUE, {
    competitionId: comp2.c.id,
    name: 'Liga round robin',
    order: 1,
    configJson: '{"numParticipants":3}',
  });
  const sid2 = stage2.s.id;

  for (const p of participants) {
    const inscriptionId = await createApprovedParticipantInscription(orgToken, {
      tournamentId: tid2,
      competitionId: comp2.c.id,
      linkedParticipantUserId: p.linkedParticipantUserId,
      displayName: p.displayName,
    });
    await gql(orgToken, MUT_ASSIGN_INSCRIPTION, {
      stageId: sid2,
      inscriptionId: String(inscriptionId),
      tournamentId: tid2,
      displayName: p.displayName,
    });
  }
  await gql(orgToken, MUT_GEN_RR, { stageId: sid2, doubleRound: false });
  repairIndividualInscriptionAuthUserIds(tid2, participants);
  console.log(`  torneo individual: ${tid2} (3 jugadores, fixture generado)`);
}

const MUT_CREATE_TOURNAMENT = `
mutation CreateT(
  $name: String!
  $sport: String!
  $season: String
  $venue: String
  $participantType: String
  $maxSlots: Int
  $inscriptionMode: InscriptionMode!
  $status: TournamentStatus!
) {
  t: createTournament(
    name: $name
    sport: $sport
    season: $season
    venue: $venue
    participantType: $participantType
    maxSlots: $maxSlots
    inscriptionMode: $inscriptionMode
    status: $status
  ) { id name organizer status }
}`;

const MUT_CREATE_COMPETITION = `
mutation ($tournamentId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
  c: createCompetition(tournamentId: $tournamentId, name: $name, order: $order, maxSlots: $maxSlots) {
    id name order
  }
}`;

const MUT_ADD_STAGE_LEAGUE = `
mutation ($competitionId: ID!, $name: String!, $order: Int!, $configJson: String) {
  s: addStage(
    competitionId: $competitionId
    name: $name
    order: $order
    format: league
    configJson: $configJson
    childrenJson: null
  ) { id name format }
}`;

const MUT_ASSIGN_INSCRIPTION = `
mutation ($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
  assignInscriptionToStage(
    stageId: $stageId
    inscriptionId: $inscriptionId
    tournamentId: $tournamentId
    displayName: $displayName
  )
}`;

const MUT_GEN_RR = `
mutation ($stageId: ID!, $doubleRound: Boolean!) {
  matches: generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound) {
    id
    round
    slotIndex
  }
}`;

const MUT_UPDATE_RESULT = `
mutation ($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
  updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
    id status
  }
}`;

const MUT_SET_STAGE_STATUS = `
mutation ($stageId: ID!, $status: String!) {
  setStageStatus(stageId: $stageId, status: $status) { id stageStatus }
}`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Seed de datos de desarrollo (organizador, equipos, participantes, torneos).

Variables de entorno:
  AUTH_URL           default http://localhost:4003
  TEAMS_URL          default http://localhost:4002
  INSCRIPTIONS_URL   default http://localhost:4004
  GRAPHQL_URL        default http://localhost:4000/graphql
  SEED_PASSWORD     default ${DEFAULT_PASSWORD}

Ejemplo:
  ./run_project.sh --no-build
  npm run seed:dev
`);
    process.exit(0);
  }

  console.log('Seed Liga360 — URLs:', { AUTH_URL, TEAMS_URL, INSCRIPTIONS_URL, GRAPHQL_URL });

  console.log('\n1) Usuarios (auth)...');
  for (const u of USERS) {
    await registerOrSkip(u);
  }

  console.log('\n2) Equipos en teams-svc (usuarios tipo team)...');
  const teamUsers = USERS.filter((u) => u.mode === 'team');
  /** @type {{ username: string; name: string; token: string; teamId: number }[]} */
  const teamRows = [];
  for (const { username, name } of teamUsers) {
    const token = await login(username);
    const mine = await listMyTeams(token);
    let teamId;
    let row = mine.find((t) => t.name === name);
    if (row) {
      teamId = Number(row.id);
      console.log(`  ya tiene equipo "${name}" (${username})`);
    } else {
      const created = await createTeam(token, name);
      teamId = Number(created.id);
      console.log(`  team creado: ${name} (${username})`);
    }
    teamRows.push({ username, name, token, teamId });
  }

  console.log('\n2b) Jugadores (participantes como miembros de equipo)...');
  const participantUsernames = ['participante_ana', 'participante_luis', 'participante_mia'];
  const PARTICIPANT_PROFILES = [
    { username: 'participante_ana', dni: '30123456', firstName: 'Ana', lastName: 'García' },
    { username: 'participante_luis', dni: '31234567', firstName: 'Luis', lastName: 'Pérez' },
    { username: 'participante_mia', dni: '32345678', firstName: 'Mia', lastName: 'Rodríguez' },
  ];
  /** Participant.id en teams-svc (miembros de plantilla). */
  const participantRosterIds = [];
  /** User.id en auth-svc (linked_participant_user_id en inscripciones). */
  const participantAuthUserIds = [];
  for (const pu of participantUsernames) {
    const { user } = await loginWithUser(pu);
    if (user?.type !== 'participant') {
      throw new Error(`usuario ${pu} no es participante`);
    }
    const pid = participantIdForUserId(user.id);
    if (pid == null) {
      throw new Error(`usuario ${pu} sin Participant en teams-svc (¿Docker/Postgres arriba?)`);
    }
    participantRosterIds.push(pid);
    participantAuthUserIds.push(Number(user.id));
  }
  const assignCycle = [participantRosterIds[0], participantRosterIds[1], participantRosterIds[2], participantRosterIds[0]];
  for (let i = 0; i < teamRows.length; i += 1) {
    const { token, teamId, name } = teamRows[i];
    const pid = assignCycle[i];
    const existing = await listTeamMemberIds(teamId);
    if (existing.includes(pid)) {
      console.log(`  "${name}" ya incluye participant_id=${pid}`);
    } else {
      await addTeamMember(token, teamId, pid);
      console.log(`  miembro agregado a "${name}" (participant_id=${pid})`);
    }
  }

  console.log('\n2c) Perfiles participantes (DNI + claim para Mis stats)...');
  for (const profile of PARTICIPANT_PROFILES) {
    const { user } = await loginWithUser(profile.username);
    const pid = participantIdForUserId(user.id);
    if (pid == null) {
      throw new Error(`seed: sin Participant para ${profile.username}`);
    }
    setParticipantDni(pid, profile.dni);
    const token = await login(profile.username);
    try {
      await claimParticipantProfile(token, profile);
      console.log(`  perfil reclamado: ${profile.username} (DNI ${profile.dni})`);
    } catch (e) {
      if (e.status === 409) {
        console.log(`  perfil ya reclamado: ${profile.username}`);
      } else {
        throw e;
      }
    }
  }

  console.log('\n3) Torneos (GraphQL + inscripciones)...');
  const orgToken = await login('organizador');
  const teamNameToTeamId = new Map(teamRows.map((r) => [r.name, r.teamId]));
  await seedTeamsTournament(orgToken, teamNameToTeamId);
  await seedActiveTeamsTournament(orgToken, teamNameToTeamId);
  const indivParticipants = [
    { linkedParticipantUserId: participantAuthUserIds[0], displayName: 'Ana García' },
    { linkedParticipantUserId: participantAuthUserIds[1], displayName: 'Luis Pérez' },
    { linkedParticipantUserId: participantAuthUserIds[2], displayName: 'Mia Rodríguez' },
  ];
  await seedIndividualsTournament(orgToken, indivParticipants);

  console.log('\nListo. Credenciales (todos misma clave):');
  console.log(`  SEED_PASSWORD / default: ${DEFAULT_PASSWORD}`);
  console.log('  Organizador UI "Mis torneos": usuario organizador');
  console.log('  Equipos para login tipo equipo: equipo_alpha … equipo_delta');
  console.log('  Participantes: participante_ana, participante_luis, participante_mia');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
