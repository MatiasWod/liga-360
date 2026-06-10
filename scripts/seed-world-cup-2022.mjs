#!/usr/bin/env node
/**
 * Carga idempotente del Mundial Qatar 2022 (grupos + eliminatorias + campeón Argentina).
 *
 * Uso (servicios arriba):
 *   npm run seed:world-cup-2022
 */
import {
  ALL_TEAMS,
  COMPETITION_NAME,
  GROUP_MATCH_RESULTS,
  GROUPS,
  KNOCKOUT_MATCH_RESULTS,
  KNOCKOUT_TEAMS,
  TOURNAMENT_NAME,
} from './data/world-cup-2022.mjs';
import {
  TOURNAMENT_DETAIL,
  applyDirectedResults,
  collectStageMatches,
  countFinishedMatches,
  countMatches,
  ensureInscriptionMap,
  findDirectedResult,
  findTournamentByName,
  finishMatch,
  gql,
  isFinishedStatus,
  login,
  markStagesFinished,
  markStagesActive,
  markTournamentPublished,
  markTournamentFinished,
} from './seed-lib.mjs';

const EXPECTED_MATCHES = 64;
const SERIES_SLUG = 'mundial-fifa';
const SERIES_NAME = 'Mundial FIFA';
const EDITION_LABEL = '2022';

const Q_SERIES_BY_SLUG = `
query SeriesBySlug($slug: String!) {
  competitionSeries(slug: $slug) { id slug name }
}`;

const MUT_CREATE_SERIES = `
mutation CreateSeries($name: String!, $slug: String!, $sport: String!) {
  createCompetitionSeries(name: $name, slug: $slug, sport: $sport) { id slug name }
}`;

const MUT_LINK_TOURNAMENT_SERIES = `
mutation LinkSeries(
  $id: ID!
  $name: String!
  $sport: String!
  $season: String
  $venue: String
  $participantType: String
  $inscriptionMode: InscriptionMode!
  $status: TournamentStatus!
  $seriesId: ID
  $editionLabel: String
) {
  updateTournament(
    id: $id
    name: $name
    sport: $sport
    season: $season
    venue: $venue
    participantType: $participantType
    inscriptionMode: $inscriptionMode
    status: $status
    seriesId: $seriesId
    editionLabel: $editionLabel
  ) { id seriesId editionLabel }
}`;

/**
 * Vincula el torneo a la serie `mundial-fifa` (editionLabel "2022").
 * Para agregar una segunda edición demo (ej. 2026): crear otro torneo finished,
 * repetir create/link con editionLabel "2026" sobre la misma serie.
 */
async function ensureWorldCupSeries(orgToken, tournamentId, tournament) {
  if (String(tournament?.seriesId || '').trim() && String(tournament?.editionLabel || '').trim() === EDITION_LABEL) {
    console.log(`  serie "${SERIES_SLUG}" ya vinculada (edición ${EDITION_LABEL})`);
    return;
  }

  let series = (await gql(orgToken, Q_SERIES_BY_SLUG, { slug: SERIES_SLUG }))?.competitionSeries;
  if (!series?.id) {
    const created = await gql(orgToken, MUT_CREATE_SERIES, {
      name: SERIES_NAME,
      slug: SERIES_SLUG,
      sport: 'football',
    });
    series = created?.createCompetitionSeries;
    console.log(`  serie creada: ${series?.name} (${series?.slug})`);
  }

  await gql(orgToken, MUT_LINK_TOURNAMENT_SERIES, {
    id: tournamentId,
    name: tournament.name,
    sport: tournament.sport || 'football',
    season: tournament.season || '2022',
    venue: tournament.venue || 'Qatar',
    participantType: tournament.participantType || 'teams',
    inscriptionMode: tournament.inscriptionMode || 'public',
    status: tournament.status || 'finished',
    seriesId: series.id,
    editionLabel: EDITION_LABEL,
  });
  console.log(`  torneo vinculado a serie "${SERIES_SLUG}" como edición ${EDITION_LABEL}`);
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
  ) { id name status }
}`;

const MUT_CREATE_COMPETITION = `
mutation ($tournamentId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
  c: createCompetition(tournamentId: $tournamentId, name: $name, order: $order, maxSlots: $maxSlots) {
    id name order
  }
}`;

const MUT_ADD_STAGE = `
mutation ($competitionId: ID!, $name: String!, $order: Int!, $format: StageFormat!, $configJson: String) {
  s: addStage(
    competitionId: $competitionId
    name: $name
    order: $order
    format: $format
    configJson: $configJson
    childrenJson: null
  ) { id name format order }
}`;

const MUT_SYNC_GROUPS = `
mutation ($stageId: ID!, $totalGroups: Int!) {
  syncStageGroups(stageId: $stageId, totalGroups: $totalGroups) { id name order }
}`;

const MUT_ASSIGN_GROUP = `
mutation ($stageId: ID!, $groupId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
  assignInscriptionToGroup(
    stageId: $stageId
    groupId: $groupId
    inscriptionId: $inscriptionId
    tournamentId: $tournamentId
    displayName: $displayName
  )
}`;

const MUT_ASSIGN_STAGE = `
mutation ($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!, $seedOrder: Int) {
  assignInscriptionToStage(
    stageId: $stageId
    inscriptionId: $inscriptionId
    tournamentId: $tournamentId
    displayName: $displayName
    seedOrder: $seedOrder
  )
}`;

const MUT_GEN_GROUPS_RR = `
mutation ($stageId: ID!, $doubleRound: Boolean!) {
  generateGroupsStageRoundRobin(stageId: $stageId, doubleRound: $doubleRound) { id }
}`;

const MUT_GEN_ELIMINATION = `
mutation ($stageId: ID!, $doubleRound: Boolean!) {
  generateSingleEliminationBracket(stageId: $stageId, doubleRound: $doubleRound) { id }
}`;

function findCompetition(tournament) {
  return (tournament?.competitions || []).find((c) => c.name === COMPETITION_NAME) || tournament?.competitions?.[0];
}

function findStageByFormat(competition, format) {
  return (competition?.stages || []).find((s) => s.format === format);
}

function countAssignedInGroupStage(stage) {
  const ids = new Set();
  for (const m of stage?.matches || []) {
    const h = m.homeAssignedInscription?.inscriptionId;
    const a = m.awayAssignedInscription?.inscriptionId;
    if (h) ids.add(String(h));
    if (a) ids.add(String(a));
  }
  if (ids.size > 0) return ids.size;
  return (stage?.groups || []).length > 0 ? -1 : 0;
}

async function ensureStructure(orgToken) {
  let tournamentId;
  let tournament;

  const existing = await findTournamentByName(orgToken, TOURNAMENT_NAME);
  if (existing) {
    tournamentId = existing.id;
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
    tournament = detail.tournament;
    console.log(`  torneo existente: ${tournamentId}`);
  } else {
    const created = await gql(orgToken, MUT_CREATE_TOURNAMENT, {
      name: TOURNAMENT_NAME,
      sport: 'fútbol',
      season: '2022',
      venue: 'Qatar',
      participantType: 'teams',
      maxSlots: 32,
      inscriptionMode: 'public',
      status: 'published',
    });
    tournamentId = created.t.id;
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
    tournament = detail.tournament;
    console.log(`  torneo creado: ${tournamentId}`);
  }

  let competition = findCompetition(tournament);
  let competitionId = competition?.id;
  if (!competitionId) {
    const comp = await gql(orgToken, MUT_CREATE_COMPETITION, {
      tournamentId,
      name: COMPETITION_NAME,
      order: 1,
      maxSlots: 32,
    });
    competitionId = comp.c.id;
    console.log(`  competición creada: ${competitionId}`);
  }

  tournament = (await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId })).tournament;
  competition = findCompetition(tournament);

  let groupsStage = findStageByFormat(competition, 'groups');
  if (!groupsStage) {
    const stage = await gql(orgToken, MUT_ADD_STAGE, {
      competitionId,
      name: 'Fase de grupos',
      order: 1,
      format: 'groups',
      configJson: JSON.stringify({ numGroups: 8, teamsPerGroup: 4 }),
    });
    groupsStage = stage.s;
    console.log(`  etapa grupos creada: ${groupsStage.id}`);
  }

  let eliminationStage = findStageByFormat(competition, 'elimination');
  if (!eliminationStage) {
    const stage = await gql(orgToken, MUT_ADD_STAGE, {
      competitionId,
      name: 'Eliminatorias',
      order: 2,
      format: 'elimination',
      configJson: JSON.stringify({ numParticipants: 16, thirdPlace: 'yes' }),
    });
    eliminationStage = stage.s;
    console.log(`  etapa eliminatorias creada: ${eliminationStage.id}`);
  }

  return { tournamentId, competitionId, groupsStageId: groupsStage.id, eliminationStageId: eliminationStage.id };
}

async function ensureGroups(orgToken, { tournamentId, competitionId, groupsStageId }) {
  const sync = await gql(orgToken, MUT_SYNC_GROUPS, { stageId: groupsStageId, totalGroups: 8 });
  const neoGroups = [...(sync.syncStageGroups || [])].sort((a, b) => a.order - b.order);
  console.log(`  ${neoGroups.length} grupos sincronizados`);

  const nameToId = await ensureInscriptionMap(orgToken, {
    tournamentId,
    competitionId,
    teamNames: ALL_TEAMS,
  });

  const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const groupsStage = findStageByFormat(findCompetition(detail.tournament), 'groups');
  const assignedCount = countAssignedInGroupStage(groupsStage);

  if (assignedCount === 32) {
    console.log('  equipos ya asignados a grupos — omitiendo');
  } else {
    for (let i = 0; i < GROUPS.length; i += 1) {
      const groupId = neoGroups[i]?.id;
      if (!groupId) continue;
      for (const team of GROUPS[i]) {
        const inscriptionId = nameToId.get(team);
        if (!inscriptionId) throw new Error(`sin inscripción para ${team}`);
        try {
          await gql(orgToken, MUT_ASSIGN_GROUP, {
            stageId: groupsStageId,
            groupId,
            inscriptionId: String(inscriptionId),
            tournamentId,
            displayName: team,
          });
        } catch (e) {
          if (!String(e.message).includes('ya')) throw e;
        }
      }
    }
    console.log('  32 equipos asignados a grupos');
  }

  const after = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const stage = findStageByFormat(findCompetition(after.tournament), 'groups');
  const groupMatches = collectStageMatches(after.tournament, groupsStageId);
  if (groupMatches.length === 0) {
    await gql(orgToken, MUT_GEN_GROUPS_RR, { stageId: groupsStageId, doubleRound: false });
    console.log('  fixture de grupos generado');
  } else {
    console.log(`  fixture de grupos ya existe (${groupMatches.length} partidos)`);
  }

  const withMatches = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const gm = collectStageMatches(withMatches.tournament, groupsStageId);
  const { applied, skipped } = await applyDirectedResults(orgToken, gm, GROUP_MATCH_RESULTS);
  console.log(`  resultados grupos: ${applied} aplicados, ${skipped} ya cargados`);
}

function knockoutSeedRank(teamName) {
  const idx = KNOCKOUT_TEAMS.indexOf(teamName);
  return idx >= 0 ? idx : 999;
}

function scoreForKnockoutMatch(home, away) {
  if (home === 'Argentina' && away === 'Francia') return { homeScore: 4, awayScore: 2 };
  if (home === 'Francia' && away === 'Argentina') return { homeScore: 2, awayScore: 4 };
  if (home === 'Croacia' && away === 'Marruecos') return { homeScore: 2, awayScore: 1 };
  if (home === 'Marruecos' && away === 'Croacia') return { homeScore: 1, awayScore: 2 };

  const directed = findDirectedResult(home, away, KNOCKOUT_MATCH_RESULTS);
  if (directed) return directed;

  const homeRank = knockoutSeedRank(home);
  const awayRank = knockoutSeedRank(away);
  if (homeRank < awayRank) return { homeScore: 2, awayScore: 1 };
  if (awayRank < homeRank) return { homeScore: 1, awayScore: 2 };
  return { homeScore: 2, awayScore: 1 };
}

async function simulateEliminationByRounds(orgToken, tournamentId, stageId) {
  let applied = 0;
  for (let pass = 0; pass < 12; pass += 1) {
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
    const pending = collectStageMatches(detail.tournament, stageId).filter((m) => {
      const home = m.homeAssignedInscription?.displayName;
      const away = m.awayAssignedInscription?.displayName;
      return home && away && !isFinishedStatus(m.status);
    });
    if (pending.length === 0) break;
    for (const m of pending) {
      const home = m.homeAssignedInscription.displayName;
      const away = m.awayAssignedInscription.displayName;
      const hit = scoreForKnockoutMatch(home, away);
      await finishMatch(orgToken, m.id, hit.homeScore, hit.awayScore);
      applied += 1;
    }
  }
  return applied;
}

async function ensureKnockout(orgToken, { tournamentId, competitionId, eliminationStageId }) {
  const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const nameToId = await ensureInscriptionMap(orgToken, {
    tournamentId,
    competitionId,
    teamNames: ALL_TEAMS,
  });

  const elimStage = findStageByFormat(findCompetition(detail.tournament), 'elimination');
  const assigned = new Set();
  for (const m of elimStage?.matches || []) {
    const h = m.homeAssignedInscription?.inscriptionId;
    const a = m.awayAssignedInscription?.inscriptionId;
    if (h) assigned.add(String(h));
    if (a) assigned.add(String(a));
  }

  if (assigned.size < KNOCKOUT_TEAMS.length) {
    for (let i = 0; i < KNOCKOUT_TEAMS.length; i += 1) {
      const team = KNOCKOUT_TEAMS[i];
      const inscriptionId = nameToId.get(team);
      if (!inscriptionId) throw new Error(`sin inscripción knockout para ${team}`);
      try {
        await gql(orgToken, MUT_ASSIGN_STAGE, {
          stageId: eliminationStageId,
          inscriptionId: String(inscriptionId),
          tournamentId,
          displayName: team,
          seedOrder: i + 1,
        });
      } catch (e) {
        if (!String(e.message).includes('ya')) throw e;
      }
    }
    console.log('  16 clasificados asignados a eliminatorias');
  } else {
    console.log('  clasificados ya asignados a eliminatorias — omitiendo');
  }

  const mid = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  let koMatches = collectStageMatches(mid.tournament, eliminationStageId);
  const koFinished = koMatches.filter((m) => isFinishedStatus(m.status)).length;
  const knockoutComplete = koMatches.length > 0 && koFinished === koMatches.length;

  if (!knockoutComplete) {
    await markStagesActive(orgToken, mid.tournament, { formats: ['elimination'] });
    if (String(mid.tournament.status || '').toLowerCase() === 'finished') {
      await markTournamentPublished(orgToken, tournamentId, mid.tournament);
    }
    await gql(orgToken, MUT_GEN_ELIMINATION, { stageId: eliminationStageId, doubleRound: false });
    console.log('  llave eliminatoria generada/regenerada');
  } else {
    console.log(`  llave ya completa (${koMatches.length} partidos finalizados)`);
  }

  const applied = await simulateEliminationByRounds(orgToken, tournamentId, eliminationStageId);
  console.log(`  resultados eliminatorias: ${applied} partidos simulados`);
}

async function finalizeTournament(orgToken, tournamentId) {
  const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: tournamentId });
  const tournament = detail.tournament;
  await markStagesFinished(orgToken, tournament);
  if (String(tournament.status).toLowerCase() !== 'finished') {
    await markTournamentFinished(orgToken, tournamentId, tournament);
  }
  console.log('  torneo y etapas marcados como finalizados');
}

function isFullySeeded(tournament) {
  const total = countMatches(tournament);
  const finished = countFinishedMatches(tournament);
  return total >= EXPECTED_MATCHES && finished >= EXPECTED_MATCHES && String(tournament.status).toLowerCase() === 'finished';
}

async function main() {
  console.log('Seed Mundial Qatar 2022 (idempotente)\n');

  const orgToken = await login('organizador');
  const existing = await findTournamentByName(orgToken, TOURNAMENT_NAME);
  if (existing) {
    const detail = await gql(orgToken, TOURNAMENT_DETAIL, { id: existing.id });
    if (isFullySeeded(detail.tournament)) {
      await ensureWorldCupSeries(orgToken, existing.id, detail.tournament);
      console.log(`✅ "${TOURNAMENT_NAME}" ya está completo (${EXPECTED_MATCHES} partidos finalizados) — nada que hacer`);
      console.log(`   ID: ${existing.id}`);
      console.log('   Abrí el detalle del torneo → pestaña Histórico');
      return;
    }
    console.log(`  reanudando seed incompleto (${countFinishedMatches(detail.tournament)}/${countMatches(detail.tournament)} partidos)`);
  }

  console.log('\n1) Estructura del torneo...');
  const ids = await ensureStructure(orgToken);

  console.log('\n2) Fase de grupos...');
  await ensureGroups(orgToken, ids);

  console.log('\n3) Eliminatorias...');
  await ensureKnockout(orgToken, ids);

  console.log('\n4) Cierre...');
  await finalizeTournament(orgToken, ids.tournamentId);

  const final = await gql(orgToken, TOURNAMENT_DETAIL, { id: ids.tournamentId });
  await ensureWorldCupSeries(orgToken, ids.tournamentId, final.tournament);
  console.log(`\n✅ Listo: "${TOURNAMENT_NAME}" (${ids.tournamentId})`);
  console.log(`   Partidos: ${countFinishedMatches(final.tournament)}/${countMatches(final.tournament)} finalizados`);
  console.log('   Campeón esperado: Argentina | Subcampeón: Francia');
  console.log('   Login: organizador / SeedLiga360!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
