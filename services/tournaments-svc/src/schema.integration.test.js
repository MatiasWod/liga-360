import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'graphql';

const schemaPath = path.resolve(process.cwd(), 'schema.graphql');

test('schema.graphql parsea correctamente', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  assert.doesNotThrow(() => parse(sdl));
});

test('schema incluye mutaciones de inicializacion avanzada', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);

  const mutationType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Mutation'
  );
  assert.ok(mutationType, 'Mutation type no encontrado');

  const mutationFields = new Set(
    mutationType.fields?.map((field) => field.name.value) || []
  );

  assert.equal(mutationFields.has('syncStageGroups'), true);
  assert.equal(mutationFields.has('assignInscriptionToGroup'), true);
  assert.equal(mutationFields.has('ensureEliminationBracket'), true);
  assert.equal(mutationFields.has('assignInscriptionToMatchSlot'), true);
  assert.equal(mutationFields.has('generateLeagueRoundRobin'), true);
  assert.equal(mutationFields.has('generateSingleEliminationBracket'), true);
  assert.equal(mutationFields.has('generateGroupsStageRoundRobin'), true);
  assert.equal(mutationFields.has('trimEliminationBracketAfterRound'), true);
  assert.equal(mutationFields.has('deleteTransition'), true);
  assert.equal(mutationFields.has('updateMatchScheduling'), true);
  assert.equal(mutationFields.has('setMatchWinnerAdvancement'), true);
});

test('Match incluye winnerAdvancementTransitionId y Mutation setMatchWinnerAdvancement', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);

  const matchType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Match'
  );
  assert.ok(matchType);
  const matchFields = new Set(matchType.fields?.map((field) => field.name.value) || []);
  assert.equal(matchFields.has('winnerAdvancementTransitionId'), true);

  const mutationType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Mutation'
  );
  const mw = mutationType.fields?.find((f) => f.name.value === 'setMatchWinnerAdvancement');
  assert.ok(mw, 'Mutation.setMatchWinnerAdvancement');
  const argNames = mw.arguments?.map((a) => a.name.value).sort().join(',');
  assert.equal(argNames.includes('matchId'), true);
  assert.equal(argNames.includes('transitionId'), true);

  function unwrapNamedType(typeNode) {
    if (!typeNode) return null;
    let t = typeNode;
    while (t.kind === 'NonNullType' || t.kind === 'NonNull') t = t.type;
    if (t.kind === 'ListType') return unwrapNamedType(t.type);
    if (t.kind === 'NamedType') {
      return t.name.value;
    }
    return null;
  }
  assert.equal(unwrapNamedType(mw.type), 'Match');
});

test('schema incluye stageStatus en Stage y mutation setStageStatus', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);

  const stageType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Stage'
  );
  assert.ok(stageType, 'Stage type no encontrado');
  const stageFields = new Set(stageType.fields?.map((field) => field.name.value) || []);
  assert.equal(stageFields.has('stageStatus'), true, 'Stage debe tener campo stageStatus');

  const mutationType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Mutation'
  );
  const mut = mutationType.fields?.find((f) => f.name.value === 'setStageStatus');
  assert.ok(mut, 'Mutation.setStageStatus no encontrado');
  const argNames = mut.arguments?.map((a) => a.name.value).sort();
  assert.ok(argNames.includes('stageId'), 'setStageStatus debe tener arg stageId');
  assert.ok(argNames.includes('status'), 'setStageStatus debe tener arg status');
});

test('schema incluye StandingsRow y fields standings en Stage/Group', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);

  const standingsType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'StandingsRow'
  );
  assert.ok(standingsType, 'StandingsRow type no encontrado');

  const stageType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Stage'
  );
  assert.ok(stageType, 'Stage type no encontrado');
  const stageFields = new Set(stageType.fields?.map((field) => field.name.value) || []);
  assert.equal(stageFields.has('standings'), true);

  const groupType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Group'
  );
  assert.ok(groupType, 'Group type no encontrado');
  const groupFields = new Set(groupType.fields?.map((field) => field.name.value) || []);
  assert.equal(groupFields.has('standings'), true);
});

test('TournamentStatus incluye finished (cascada al finalizar competiciones)', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);
  const enumDef = ast.definitions.find(
    (definition) => definition.kind === 'EnumTypeDefinition' && definition.name.value === 'TournamentStatus'
  );
  assert.ok(enumDef, 'TournamentStatus enum no encontrado');
  const values = new Set(enumDef.values?.map((v) => v.name.value) || []);
  assert.equal(values.has('draft'), true);
  assert.equal(values.has('published'), true);
  assert.equal(values.has('finished'), true);
});

test('Match incluye matchKind para tercer puesto y variantes de llave', async () => {
  const sdl = await fs.readFile(schemaPath, 'utf8');
  const ast = parse(sdl);
  const matchType = ast.definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Match'
  );
  assert.ok(matchType, 'Match type no encontrado');
  const matchFields = new Set(matchType.fields?.map((field) => field.name.value) || []);
  assert.equal(matchFields.has('matchKind'), true);
});
