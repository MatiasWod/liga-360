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
  assert.equal(mutationFields.has('deleteTransition'), true);
  assert.equal(mutationFields.has('updateMatchScheduling'), true);
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
