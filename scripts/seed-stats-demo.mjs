#!/usr/bin/env node
/**
 * Extiende seed:dev con eventos, presencias y un segundo torneo para probar
 * stats por competencia, presencias, perfil y mano a mano / historial.
 *
 * Uso (servicios arriba):
 *   npm run seed:dev && npm run seed:stats-demo
 */
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'SeedLiga360!';
const AUTH_URL = (process.env.AUTH_URL || 'http://localhost:4003').replace(/\/$/, '');
const TEAMS_URL = (process.env.TEAMS_URL || 'http://localhost:4002').replace(/\/$/, '');
const INSCRIPTIONS_URL = (process.env.INSCRIPTIONS_URL || 'http://localhost:4004').replace(/\/$/, '');
const MATCHES_URL = (process.env.MATCHES_URL || 'http://localhost:4006/matches').replace(/\/$/, '');
const GRAPHQL_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql';

const LIGA_DEMO = 'Liga Demo Liga360';
const COPA_DEMO = 'Copa Demo Liga360';

async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
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

async function login(username) {
  const data = await httpJson(`${AUTH_URL}/login`, {
    method: 'POST',
    body: { username, password: DEFAULT_PASSWORD },
  });
  return data.token;
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
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

async function findTournamentId(token, name) {
  const data = await gql(token, `query { tournaments { id name } }`);
  return (data.tournaments || []).find((t) => t.name === name)?.id || null;
}

const TOURNAMENT_DETAIL = `
query ($id: ID!) {
  tournament(id: $id) {
    id name
    competitions {
      id name
      stages {
        id name
        matches {
          id status homeScore awayScore round
          homeAssignedInscription { inscriptionId displayName }
          awayAssignedInscription { inscriptionId displayName }
        }
      }
    }
  }
}`;

function collectMatches(tournament) {
  const rows = [];
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      for (const m of s.matches || []) {
        rows.push({ ...m, competitionId: c.id, competitionName: c.name, stageName: s.name });
      }
    }
  }
  return rows;
}

function parseInsId(side) {
  const raw = side?.inscriptionId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function matchHasInscriptions(m, ids) {
  const h = parseInsId(m.homeAssignedInscription);
  const a = parseInsId(m.awayAssignedInscription);
  const set = new Set(ids);
  return (h != null && set.has(h)) || (a != null && set.has(a));
}

function matchBetween(m, idA, idB) {
  const h = parseInsId(m.homeAssignedInscription);
  const a = parseInsId(m.awayAssignedInscription);
  return (h === idA && a === idB) || (h === idB && a === idA);
}

async function listTeamInscriptions(teamId) {
  const data = await httpJson(`${INSCRIPTIONS_URL}/teams/${teamId}/inscriptions`);
  return data.inscriptions || [];
}

async function listTeamMembers(teamId) {
  const data = await httpJson(`${TEAMS_URL}/teams/${teamId}`);
  return data.members || [];
}

async function createEvent(orgToken, matchId, payload) {
  await httpJson(`${MATCHES_URL}/${encodeURIComponent(matchId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: payload,
  });
}

async function replacePresences(teamToken, matchId, payload) {
  await httpJson(`${MATCHES_URL}/${encodeURIComponent(matchId)}/presences`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teamToken}` },
    body: payload,
  });
}

async function finishMatch(orgToken, matchId, homeScore, awayScore) {
  await gql(orgToken, MUT_UPDATE_RESULT, {
    matchId,
    homeScore,
    awayScore,
    status: 'finished',
  });
}

async function seedEventsAndPresences(orgToken, alphaToken, tournament, alphaInsId, alphaTeamId) {
  const matches = collectMatches(tournament);
  const members = await listTeamMembers(alphaTeamId);
  const member = members[0];
  if (!member) {
    console.log('  sin miembros en Equipo Alpha — omitiendo presencias');
  }

  let eventsAdded = 0;
  let presencesAdded = 0;
  for (const m of matches) {
    if (String(m.status).toLowerCase() !== 'finished') continue;
    if (!matchHasInscriptions(m, [alphaInsId])) continue;

    const myHome = parseInsId(m.homeAssignedInscription) === alphaInsId;
    const myIns = alphaInsId;
    const mySide = myHome ? m.homeAssignedInscription : m.awayAssignedInscription;
    const display = mySide?.displayName || 'Equipo Alpha';

    try {
      await createEvent(orgToken, m.id, {
        tournament_id: tournament.id,
        competition_id: m.competitionId,
        event_type: 'goal',
        inscription_id: myIns,
        linked_member_id: member ? Number(member.id) : null,
        display_name: member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || display : display,
        minute: 23,
      });
      eventsAdded += 1;
      await createEvent(orgToken, m.id, {
        tournament_id: tournament.id,
        competition_id: m.competitionId,
        event_type: 'yellow_card',
        inscription_id: myIns,
        display_name: 'Jugador demo',
        minute: 67,
      });
      eventsAdded += 1;
    } catch (e) {
      console.log(`  eventos ya cargados o error en ${m.id}: ${e.message}`);
    }

    if (member && alphaToken) {
      try {
        await replacePresences(alphaToken, m.id, {
          inscription_id: myIns,
          tournament_id: tournament.id,
          competition_id: m.competitionId,
          entries: [
            {
              linked_member_id: Number(member.id),
              display_name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Jugador',
              is_guest: false,
            },
          ],
        });
        presencesAdded += 1;
      } catch (e) {
        console.log(`  presencias ${m.id}: ${e.message}`);
      }
    }
  }
  console.log(`  ${tournament.name}: ${eventsAdded} eventos, ${presencesAdded} presencias`);
}

async function ensureCopaDemo(orgToken, teamNameToTeamId) {
  const existingId = await findTournamentId(orgToken, COPA_DEMO);
  if (existingId) {
    console.log(`  ${COPA_DEMO} ya existe (${existingId})`);
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: existingId });
    return detail.tournament;
  }

  const alphaId = teamNameToTeamId.get('Equipo Alpha');
  const betaId = teamNameToTeamId.get('Equipo Beta');
  if (!alphaId || !betaId) throw new Error('Faltan Equipo Alpha/Beta en teams-svc');

  const d1 = await gql(orgToken, MUT_CREATE_TOURNAMENT, {
    name: COPA_DEMO,
    sport: 'fútbol',
    season: '2026',
    venue: 'Estadio Demo Sur',
    participantType: 'teams',
    maxSlots: 8,
    inscriptionMode: 'public',
    status: 'published',
  });
  const tournamentId = d1.t.id;
  const comp = await gql(orgToken, MUT_CREATE_COMPETITION, {
    tournamentId,
    name: 'Eliminatoria',
    order: 1,
    maxSlots: 8,
  });
  const stage = await gql(orgToken, MUT_ADD_STAGE_LEAGUE, {
    competitionId: comp.c.id,
    name: 'Semifinal única',
    order: 1,
    configJson: '{"numParticipants":2}',
  });
  const stageId = stage.s.id;

  const alphaIns = await createApprovedTeamInscription(orgToken, {
    tournamentId,
    competitionId: comp.c.id,
    linkedTeamId: alphaId,
    displayName: 'Equipo Alpha',
  });
  const betaIns = await createApprovedTeamInscription(orgToken, {
    tournamentId,
    competitionId: comp.c.id,
    linkedTeamId: betaId,
    displayName: 'Equipo Beta',
  });
  await gql(orgToken, MUT_ASSIGN_INSCRIPTION, {
    stageId,
    inscriptionId: String(alphaIns),
    tournamentId,
    displayName: 'Equipo Alpha',
  });
  await gql(orgToken, MUT_ASSIGN_INSCRIPTION, {
    stageId,
    inscriptionId: String(betaIns),
    tournamentId,
    displayName: 'Equipo Beta',
  });
  const gen = await gql(orgToken, MUT_GEN_RR, { stageId, doubleRound: false });
  const h2h = (gen.matches || [])[0];
  if (h2h) {
    await finishMatch(orgToken, h2h.id, 3, 1);
    console.log(`  ${COPA_DEMO}: partido Alpha vs Beta finalizado (${h2h.id})`);
  }
  const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  return detail.tournament;
}

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
  const id = Number(created?.inscription?.id);
  await httpJson(`${INSCRIPTIONS_URL}/inscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${orgToken}` },
    body: { status: 'ACEPTADO' },
  });
  return id;
}

const MUT_CREATE_TOURNAMENT = `
mutation CreateT($name: String!, $sport: String!, $season: String, $venue: String, $participantType: String, $maxSlots: Int, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
  t: createTournament(name: $name, sport: $sport, season: $season, venue: $venue, participantType: $participantType, maxSlots: $maxSlots, inscriptionMode: $inscriptionMode, status: $status) { id name }
}`;

const MUT_CREATE_COMPETITION = `
mutation ($tournamentId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
  c: createCompetition(tournamentId: $tournamentId, name: $name, order: $order, maxSlots: $maxSlots) { id name }
}`;

const MUT_ADD_STAGE_LEAGUE = `
mutation ($competitionId: ID!, $name: String!, $order: Int!, $configJson: String) {
  s: addStage(competitionId: $competitionId, name: $name, order: $order, format: league, configJson: $configJson, childrenJson: null) { id name }
}`;

const MUT_ASSIGN_INSCRIPTION = `
mutation ($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
  assignInscriptionToStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
}`;

const MUT_GEN_RR = `
mutation ($stageId: ID!, $doubleRound: Boolean!) {
  matches: generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound) { id round }
}`;

const MUT_UPDATE_RESULT = `
mutation ($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
  updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) { id status }
}`;

async function main() {
  console.log('Seed stats demo — requiere npm run seed:dev previo\n');

  const orgToken = await login('organizador');
  const alphaToken = await login('equipo_alpha');

  const alphaTeams = await httpJson(`${TEAMS_URL}/teams?mine=true`, {
    headers: { Authorization: `Bearer ${alphaToken}` },
  });
  const alphaTeam = (alphaTeams.teams || [])[0];
  if (!alphaTeam) throw new Error('equipo_alpha sin equipo — corré seed:dev primero');
  const alphaTeamId = Number(alphaTeam.id);

  const teamUsers = ['equipo_alpha', 'equipo_beta', 'equipo_gamma', 'equipo_delta'];
  const teamNameToTeamId = new Map();
  for (const u of teamUsers) {
    const token = await login(u);
    const mine = await httpJson(`${TEAMS_URL}/teams?mine=true`, { headers: { Authorization: `Bearer ${token}` } });
    const t = (mine.teams || [])[0];
    if (t) teamNameToTeamId.set(t.name, Number(t.id));
  }

  const ligaId = await findTournamentId(orgToken, LIGA_DEMO);
  if (!ligaId) {
    throw new Error(`No existe "${LIGA_DEMO}". Ejecutá: npm run seed:dev`);
  }

  const alphaInsRows = await listTeamInscriptions(alphaTeamId);
  const ligaAlphaIns = alphaInsRows.find((r) => r.tournament_id === ligaId);
  const alphaInsId = ligaAlphaIns ? Number(ligaAlphaIns.id) : null;
  if (!alphaInsId) throw new Error('Equipo Alpha sin inscripción en Liga Demo');

  console.log('1) Eventos y presencias en Liga Demo...');
  const ligaDetail = await gql(orgToken, TOURNAMENT_DETAIL, { id: ligaId });
  await seedEventsAndPresences(orgToken, alphaToken, ligaDetail.tournament, alphaInsId, alphaTeamId);

  console.log('\n2) Copa Demo (segundo torneo Alpha vs Beta para historial / H2H)...');
  const copa = await ensureCopaDemo(orgToken, teamNameToTeamId);
  const copaAlphaIns = alphaInsRows.find((r) => r.tournament_id === copa.id) || (await listTeamInscriptions(alphaTeamId)).find((r) => r.tournament_id === copa.id);
  const copaAlphaInsId = copaAlphaIns ? Number(copaAlphaIns.id) : null;
  if (copaAlphaInsId) {
    await seedEventsAndPresences(orgToken, alphaToken, copa, copaAlphaInsId, alphaTeamId);
  }

  console.log('\nListo para probar:');
  console.log('  Login equipo: equipo_alpha /', DEFAULT_PASSWORD);
  console.log('  Home equipo → Historia (2 torneos) + Mano a mano vs Equipo Beta');
  console.log('  Torneo "Liga Demo Liga360" → stats competencia + presencias');
  console.log('  Perfil participante_ana → Mis stats');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
