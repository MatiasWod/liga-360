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
});
