#!/usr/bin/env node
/**
 * Ejecuta createNextEditionFromTournament sobre el torneo demo (sin UI).
 *
 * Uso:
 *   npm run seed:next-edition-demo
 *   npm run try:next-edition
 *   npm run try:next-edition -- --edition 2027 --mode structure_only
 */
import {
  createNextEdition,
  findTournamentByName,
  loadTournamentForNextEdition,
  login,
} from './seed-lib.mjs';

const DEFAULT_SOURCE_NAME = 'Sistema de Ligas Demo 2025';

function parseArgs(argv) {
  const out = {
    sourceName: DEFAULT_SOURCE_NAME,
    editionLabel: '2026',
    mode: 'full',
    name: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--edition' && argv[i + 1]) {
      out.editionLabel = argv[++i];
    } else if (a === '--mode' && argv[i + 1]) {
      out.mode = argv[++i];
    } else if (a === '--name' && argv[i + 1]) {
      out.name = argv[++i];
    } else if (a === '--source' && argv[i + 1]) {
      out.sourceName = argv[++i];
    }
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Ejecuta la mutation createNextEditionFromTournament.

  npm run try:next-edition
  npm run try:next-edition -- --edition 2027 --mode structure_only
  npm run try:next-edition -- --source "Mi Torneo" --edition 2026

Requiere torneo fuente finished con snapshots (npm run seed:next-edition-demo).
`);
    process.exit(0);
  }

  const opts = parseArgs(argv);
  const token = await login('organizador');
  const source = await findTournamentByName(token, opts.sourceName);
  if (!source?.id) {
    throw new Error(`No se encontró torneo "${opts.sourceName}". Corré: npm run seed:next-edition-demo`);
  }

  const loaded = await loadTournamentForNextEdition(token, source.id);
  console.log('Fuente:', {
    id: loaded.id,
    name: loaded.name,
    status: loaded.status,
    seriesId: loaded.seriesId,
    editionLabel: loaded.editionLabel,
  });

  const result = await createNextEdition(token, {
    sourceTournamentId: source.id,
    editionLabel: opts.editionLabel,
    name: opts.name || loaded.name,
    mode: opts.mode,
    seriesId: loaded.seriesId || null,
  });

  console.log('\n✅ Próxima edición creada\n');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nAbrí configuración del torneo: ${result.tournament.id}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
