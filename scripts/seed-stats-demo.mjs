#!/usr/bin/env node
/**
 * Extiende seed:dev con eventos, presencias, torneos finalizados y Copa Demo
 * para probar stats, presencias, perfil, historial y pestaña Histórico.
 *
 * Uso (servicios arriba):
 *   npm run seed:dev && npm run seed:stats-demo
 */
import {
  DEFAULT_PASSWORD,
  MATCHES_URL,
  TEAMS_URL,
  INSCRIPTIONS_URL,
  TOURNAMENT_DETAIL,
  collectStageMatches,
  finishAllUnfinishedMatches,
  finishMatch,
  gql,
  httpJson,
  isFinishedStatus,
  login,
  markStagesFinished,
  markTournamentFinished,
  findTournamentIdByName,
} from './seed-lib.mjs';

const LIGA_DEMO = 'Liga Demo Liga360';
const COPA_DEMO = 'Copa Demo Liga360';

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
  const data = await httpJson(`${INSCRIPTIONS_URL}/inscriptions?teamId=${teamId}`);
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

async function listMatchEvents(matchId) {
  try {
    const data = await httpJson(`${MATCHES_URL}/${encodeURIComponent(matchId)}/events`);
    return data.events || [];
  } catch {
    return [];
  }
}

async function seedEventsAndPresences(orgToken, alphaToken, tournament, alphaInsId, alphaTeamId) {
  const matches = collectStageMatches(tournament);
  const members = await listTeamMembers(alphaTeamId);
  const member = members[0];
  if (!member) {
    console.log('  sin miembros en Equipo Alpha — omitiendo presencias');
  }

  let eventsAdded = 0;
  let presencesAdded = 0;
  let skippedEvents = 0;
  for (const m of matches) {
    if (!isFinishedStatus(m.status)) continue;
    if (!matchHasInscriptions(m, [alphaInsId])) continue;

    const existingEvents = await listMatchEvents(m.id);
    if (existingEvents.length > 0) {
      skippedEvents += 1;
      continue;
    }

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
  console.log(`  ${tournament.name}: ${eventsAdded} eventos, ${presencesAdded} presencias${skippedEvents ? ` (${skippedEvents} partidos ya tenían eventos)` : ''}`);
}

async function ensureDemoFinished(orgToken, tournament) {
  const pending = collectStageMatches(tournament).filter((m) => !isFinishedStatus(m.status)).length;
  if (pending > 0) {
    const n = await finishAllUnfinishedMatches(orgToken, tournament);
    console.log(`  ${tournament.name}: ${n} partidos finalizados`);
    const refreshed = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournament.id });
    tournament = refreshed.tournament;
  } else {
    console.log(`  ${tournament.name}: todos los partidos ya finalizados`);
  }
  await markStagesFinished(orgToken, tournament);
  if (String(tournament.status).toLowerCase() !== 'finished') {
    await markTournamentFinished(orgToken, tournament.id, tournament);
    console.log(`  ${tournament.name}: marcado como finalizado`);
  } else {
    console.log(`  ${tournament.name}: ya estaba finalizado`);
  }
  return (await gql(orgToken, TOURNAMENT_DETAIL, { id: tournament.id })).tournament;
}

async function ensureCopaDemo(orgToken, teamNameToTeamId) {
  const existingId = await findTournamentIdByName(orgToken, COPA_DEMO);
  if (existingId) {
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: existingId });
    const matches = collectStageMatches(detail.tournament);
    const finished = matches.filter((m) => isFinishedStatus(m.status)).length;
    if (matches.length > 0 && finished === matches.length) {
      console.log(`  ${COPA_DEMO} ya existe y está completa (${existingId})`);
      return detail.tournament;
    }
    if (matches.length > 0) {
      console.log(`  ${COPA_DEMO} existente incompleta — finalizando partidos pendientes`);
      return detail.tournament;
    }
    console.log(`  ${COPA_DEMO} existente sin fixture — completando estructura`);
    return await populateCopaDemo(orgToken, teamNameToTeamId, existingId);
  }

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
  return populateCopaDemo(orgToken, teamNameToTeamId, d1.t.id);
}

async function populateCopaDemo(orgToken, teamNameToTeamId, tournamentId) {
  const alphaId = teamNameToTeamId.get('Equipo Alpha');
  const betaId = teamNameToTeamId.get('Equipo Beta');
  if (!alphaId || !betaId) throw new Error('Faltan Equipo Alpha/Beta en teams-svc');

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

  const ligaId = await findTournamentIdByName(orgToken, LIGA_DEMO);
  if (!ligaId) {
    throw new Error(`No existe "${LIGA_DEMO}". Ejecutá: npm run seed:dev`);
  }

  const alphaInsRows = await listTeamInscriptions(alphaTeamId);
  const ligaAlphaIns = alphaInsRows.find((r) => r.tournament_id === ligaId);
  const alphaInsId = ligaAlphaIns ? Number(ligaAlphaIns.id) : null;
  if (!alphaInsId) throw new Error('Equipo Alpha sin inscripción en Liga Demo');

  console.log('1) Completar y finalizar Liga Demo...');
  let ligaDetail = await gql(orgToken, TOURNAMENT_DETAIL, { id: ligaId });
  ligaDetail.tournament = await ensureDemoFinished(orgToken, ligaDetail.tournament);

  console.log('\n2) Eventos y presencias en Liga Demo...');
  await seedEventsAndPresences(orgToken, alphaToken, ligaDetail.tournament, alphaInsId, alphaTeamId);

  console.log('\n3) Copa Demo (segundo torneo Alpha vs Beta para historial / H2H)...');
  let copa = await ensureCopaDemo(orgToken, teamNameToTeamId);
  copa = await ensureDemoFinished(orgToken, copa);
  const copaAlphaIns = alphaInsRows.find((r) => r.tournament_id === copa.id) || (await listTeamInscriptions(alphaTeamId)).find((r) => r.tournament_id === copa.id);
  const copaAlphaInsId = copaAlphaIns ? Number(copaAlphaIns.id) : null;
  if (copaAlphaInsId) {
    await seedEventsAndPresences(orgToken, alphaToken, copa, copaAlphaInsId, alphaTeamId);
  }

  console.log('\nListo para probar:');
  console.log('  Login equipo: equipo_alpha /', DEFAULT_PASSWORD);
  console.log('  Home equipo → Historia (2 torneos finalizados) + Mano a mano vs Equipo Beta');
  console.log('  Torneo "Liga Demo Liga360" → stats + presencias + pestaña Histórico');
  console.log('  Torneo "Copa Demo Liga360" → finalizado (campeón Alpha)');
  console.log('  Perfil participante_ana → Mis stats');
  console.log('  Opcional: npm run seed:world-cup-2022 → Mundial Qatar 2022 finalizado');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
