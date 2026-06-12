#!/usr/bin/env node
/**
 * Demo lista para probar "Crear próxima edición" (2 divisiones + ascenso/descenso).
 *
 * Uso:
 *   npm run dev:bootstrap          # stack arriba
 *   npm run seed:dev               # usuarios + equipos (opcional pero recomendado)
 *   npm run seed:next-edition-demo
 *
 * Flags:
 *   --create-next   Ejecuta la mutation y crea edición 2026 por CLI
 *   --force         Recrea el torneo aunque ya exista
 */
import {
  DEFAULT_PASSWORD,
  INSCRIPTIONS_URL,
  createNextEdition,
  finishAllUnfinishedMatches,
  gql,
  httpJson,
  loadTournamentForNextEdition,
  login,
  findTournamentByName,
  saveNextEditionSnapshotsForTournament,
} from './seed-lib.mjs';

const SERIES_SLUG = 'liga-ascenso-demo';
const SERIES_NAME = 'Liga Ascenso Demo';
const TOURNAMENT_NAME = 'Sistema de Ligas Demo 2025';
const EDITION_LABEL = '2025';
const NEXT_EDITION_LABEL = '2026';
const TEAMS_PER_DIV = 6;
const PROMOTIONS = 2;
const RELEGATIONS = 2;

const DIV1_TEAMS = Array.from({ length: TEAMS_PER_DIV }, (_, i) => `Div1 · Equipo ${i + 1}`);
const DIV2_TEAMS = Array.from({ length: TEAMS_PER_DIV }, (_, i) => `Div2 · Equipo ${i + 1}`);

const Q_SERIES_BY_SLUG = `
query ($slug: String!) {
  competitionSeries(slug: $slug) { id slug name }
}`;

const MUT_CREATE_SERIES = `
mutation ($name: String!, $slug: String!, $sport: String!) {
  createCompetitionSeries(name: $name, slug: $slug, sport: $sport) { id slug name }
}`;

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
  $seriesId: ID
  $editionLabel: String
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
    seriesId: $seriesId
    editionLabel: $editionLabel
  ) { id name status seriesId editionLabel }
}`;

const MUT_CREATE_COMPETITION = `
mutation ($tournamentId: ID!, $name: String!, $order: Int!, $maxSlots: Int) {
  c: createCompetition(tournamentId: $tournamentId, name: $name, order: $order, maxSlots: $maxSlots) {
    id name order
  }
}`;

const MUT_ADD_STAGE = `
mutation ($competitionId: ID!, $name: String!, $order: Int!, $configJson: String) {
  s: addStage(
    competitionId: $competitionId
    name: $name
    order: $order
    format: league
    configJson: $configJson
    childrenJson: null
  ) { id name format order }
}`;

const MUT_ADD_TRANSITION = `
mutation (
  $from: ID!
  $to: ID
  $label: String!
  $selectionKind: String!
  $topN: Int
  $bottomN: Int
  $timing: String
) {
  addTransition(
    fromStageId: $from
    toStageId: $to
    label: $label
    selectionKind: $selectionKind
    topN: $topN
    bottomN: $bottomN
    timing: $timing
  ) { id label timing }
}`;

async function httpInscription(token, body) {
  const created = await httpJson(`${INSCRIPTIONS_URL}/inscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const id = Number(created?.inscription?.id);
  if (!Number.isFinite(id)) throw new Error(`sin id inscripción: ${body.displayName}`);
  await httpJson(`${INSCRIPTIONS_URL}/inscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: { status: 'ACEPTADO' },
  });
  return id;
}

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

const MUT_GEN_RR = `
mutation ($stageId: ID!, $doubleRound: Boolean!) {
  generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound) { id }
}`;

const MUT_SET_STAGE = `
mutation ($stageId: ID!, $status: String!) {
  setStageStatus(stageId: $stageId, status: $status) { id stageStatus }
}`;

const MUT_UPDATE_TOURNAMENT = `
mutation (
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
  ) { id status seriesId editionLabel }
}`;

async function ensureSeries(token) {
  let series = (await gql(token, Q_SERIES_BY_SLUG, { slug: SERIES_SLUG }))?.competitionSeries;
  if (!series?.id) {
    const created = await gql(token, MUT_CREATE_SERIES, {
      name: SERIES_NAME,
      slug: SERIES_SLUG,
      sport: 'football',
    });
    series = created?.createCompetitionSeries;
    console.log(`  serie creada: ${series.name}`);
  } else {
    console.log(`  serie existente: ${series.name}`);
  }
  return series;
}

async function deleteTournamentIfExists(token, name) {
  const hit = await findTournamentByName(token, name);
  if (!hit?.id) return;
  await gql(token, `mutation ($id: ID!) { deleteTournament(id: $id) }`, { id: hit.id });
  console.log(`  torneo anterior eliminado: ${name}`);
}

async function createDivisionStructure(token, tournamentId, { compName, order, teams, stageName }) {
  const comp = await gql(token, MUT_CREATE_COMPETITION, {
    tournamentId,
    name: compName,
    order,
    maxSlots: TEAMS_PER_DIV,
  });
  const stage = await gql(token, MUT_ADD_STAGE, {
    competitionId: comp.c.id,
    name: stageName,
    order: 1,
    configJson: JSON.stringify({ numParticipants: TEAMS_PER_DIV, rounds: 'single' }),
  });
  const stageId = stage.s.id;
  const inscriptionIds = [];
  for (let i = 0; i < teams.length; i += 1) {
    const displayName = teams[i];
    const inscriptionId = await httpInscription(token, {
      tournamentId,
      competitionId: comp.c.id,
      displayName,
      source: 'manual',
    });
    inscriptionIds.push({ inscriptionId, displayName });
    await gql(token, MUT_ASSIGN_STAGE, {
      stageId,
      inscriptionId: String(inscriptionId),
      tournamentId,
      displayName,
      seedOrder: i,
    });
  }
  await gql(token, MUT_GEN_RR, { stageId, doubleRound: false });
  return { competitionId: comp.c.id, stageId, inscriptionIds };
}

async function activateAndPlayStage(token, tournamentId, stageId) {
  await gql(token, MUT_SET_STAGE, { stageId, status: 'active' });
  let tournament = await loadTournamentForNextEdition(token, tournamentId);
  const finished = await finishAllUnfinishedMatches(token, tournament);
  console.log(`    partidos cerrados: ${finished}`);
  tournament = await loadTournamentForNextEdition(token, tournamentId);
  return tournament;
}

async function finalizeDivisionStage(token, tournamentId, stageId) {
  let tournament = await loadTournamentForNextEdition(token, tournamentId);
  const saved = await saveNextEditionSnapshotsForTournament(token, tournament);
  console.log(`    snapshots next_edition guardados: ${saved}`);
  await gql(token, MUT_SET_STAGE, { stageId, status: 'finished' });
  tournament = await loadTournamentForNextEdition(token, tournamentId);
  return tournament;
}

function printTestingGuide({ tournamentId, seriesId, nextTournamentId = null }) {
  console.log(`
══════════════════════════════════════════════════════════════
  Demo "próxima edición" lista
══════════════════════════════════════════════════════════════

Torneo fuente (finished):  ${TOURNAMENT_NAME}
  id: ${tournamentId}
Serie:                     ${SERIES_NAME}
  id: ${seriesId}
Edición actual:            ${EDITION_LABEL}
Ascenso:                   top ${PROMOTIONS} de División 2 → División 1
Descenso:                  bottom ${RELEGATIONS} de División 1 → División 2

── Probar en la UI ──────────────────────────────────────────
  1. Stack:     npm run dev:all   (o docker compose up -d)
  2. Frontend:  http://localhost:5173
  3. Login:     organizador / ${DEFAULT_PASSWORD}
  4. Torneos → Configuración → "${TOURNAMENT_NAME}"
  5. Botón:     "Crear próxima edición" (edición sugerida: ${NEXT_EDITION_LABEL})
  Alternativa:  Histórico → serie "${SERIES_NAME}" → mismo botón

── Probar por CLI ───────────────────────────────────────────
  npm run try:next-edition
  npm run seed:next-edition-demo -- --create-next

── Qué verificar en la edición nueva ────────────────────────
  · División 1: equipos que descendieron + permanencias
  · División 2: equipos que ascendieron + permanencias
  · Torneo en estado draft, listo para revisar planteles
${nextTournamentId ? `\nEdición creada por CLI: ${nextTournamentId}\n` : ''}`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Seed demo para probar createNextEditionFromTournament.

Requisitos:
  npm run dev:bootstrap
  npm run seed:dev          (usuarios; organizador / ${DEFAULT_PASSWORD})

Comandos:
  npm run seed:next-edition-demo
  npm run seed:next-edition-demo -- --create-next
  npm run seed:next-edition-demo -- --force
`);
    process.exit(0);
  }

  const force = argv.includes('--force');
  const createNext = argv.includes('--create-next');

  console.log('Seed próxima edición — Liga Ascenso Demo\n');
  const token = await login('organizador');

  const existing = await findTournamentByName(token, TOURNAMENT_NAME);
  if (existing?.id && !force) {
    const loaded = await loadTournamentForNextEdition(token, existing.id);
    if (String(loaded?.status || '').toLowerCase() === 'finished') {
      console.log(`Torneo demo ya existe (${existing.id}), status finished — omitiendo creación.`);
      const series = await ensureSeries(token);
      if (createNext) {
        const result = await createNextEdition(token, {
          sourceTournamentId: existing.id,
          editionLabel: NEXT_EDITION_LABEL,
          name: TOURNAMENT_NAME,
          mode: 'full',
          seriesId: series.id,
        });
        console.log('Mutation OK:', result);
        printTestingGuide({ tournamentId: existing.id, seriesId: series.id, nextTournamentId: result?.tournament?.id });
        return;
      }
      printTestingGuide({ tournamentId: existing.id, seriesId: series.id });
      return;
    }
    console.log('Torneo demo incompleto — recreando (--force implícito).');
    await deleteTournamentIfExists(token, TOURNAMENT_NAME);
  } else if (force && existing?.id) {
    await deleteTournamentIfExists(token, TOURNAMENT_NAME);
  }

  const series = await ensureSeries(token);

  console.log('\n1) Crear torneo + serie…');
  const created = await gql(token, MUT_CREATE_TOURNAMENT, {
    name: TOURNAMENT_NAME,
    sport: 'football',
    season: '2025',
    venue: 'Cancha Demo',
    participantType: 'teams',
    maxSlots: TEAMS_PER_DIV * 2,
    inscriptionMode: 'public',
    status: 'published',
    seriesId: series.id,
    editionLabel: EDITION_LABEL,
  });
  const tournamentId = created.t.id;
  console.log(`  torneo: ${tournamentId}`);

  console.log('\n2) Estructura 2 divisiones…');
  const div1 = await createDivisionStructure(token, tournamentId, {
    compName: 'División 1',
    order: 1,
    teams: DIV1_TEAMS,
    stageName: 'División 1',
  });
  const div2 = await createDivisionStructure(token, tournamentId, {
    compName: 'División 2',
    order: 2,
    teams: DIV2_TEAMS,
    stageName: 'División 2',
  });

  console.log('\n3) Transiciones next_edition…');
  await gql(token, MUT_ADD_TRANSITION, {
    from: div2.stageId,
    to: div1.stageId,
    label: 'Ascenso a División 1',
    selectionKind: 'top',
    topN: PROMOTIONS,
    bottomN: null,
    timing: 'next_edition',
  });
  await gql(token, MUT_ADD_TRANSITION, {
    from: div1.stageId,
    to: div2.stageId,
    label: 'Descenso a División 2',
    selectionKind: 'bottom',
    topN: null,
    bottomN: RELEGATIONS,
    timing: 'next_edition',
  });

  console.log('\n4) Jugar temporada (liga single round)…');
  await activateAndPlayStage(token, tournamentId, div1.stageId);
  await activateAndPlayStage(token, tournamentId, div2.stageId);

  console.log('\n5) Finalizar etapas + snapshots…');
  await finalizeDivisionStage(token, tournamentId, div1.stageId);
  let tournament = await finalizeDivisionStage(token, tournamentId, div2.stageId);

  if (String(tournament.status || '').toLowerCase() !== 'finished') {
    tournament = await loadTournamentForNextEdition(token, tournamentId);
    await gql(token, MUT_UPDATE_TOURNAMENT, {
      id: tournamentId,
      name: tournament.name,
      sport: tournament.sport || 'football',
      season: tournament.season || '2025',
      venue: tournament.venue || 'Cancha Demo',
      participantType: tournament.participantType || 'teams',
      inscriptionMode: tournament.inscriptionMode || 'public',
      status: 'finished',
      seriesId: series.id,
      editionLabel: EDITION_LABEL,
    });
  }

  console.log('\n6) Resumen standings (para validar ascenso/descenso):');
  tournament = await loadTournamentForNextEdition(token, tournamentId);
  for (const comp of tournament.competitions || []) {
    const stage = comp.stages?.[0];
    console.log(`  ${comp.name}:`);
    for (const row of (stage?.standings || []).slice(0, TEAMS_PER_DIV)) {
      console.log(`    #${row.position} ${row.displayName}`);
    }
  }

  let nextTournamentId = null;
  if (createNext) {
    console.log('\n7) Crear próxima edición por mutation…');
    const result = await createNextEdition(token, {
      sourceTournamentId: tournamentId,
      editionLabel: NEXT_EDITION_LABEL,
      name: TOURNAMENT_NAME,
      mode: 'full',
      seriesId: series.id,
    });
    console.log('  resultado:', result);
    nextTournamentId = result?.tournament?.id ?? null;
  }

  printTestingGuide({ tournamentId, seriesId: series.id, nextTournamentId });
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
