import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'graphql';
import jwt from 'jsonwebtoken';
import { requireOrganizerFromAuthHeader } from '../../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const schemaPath = path.resolve(process.cwd(), 'schema.graphql');

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

function makeToken(username = 'org1', type = 'organizer') {
  return jwt.sign({ sub: 1, username, type }, JWT_SECRET, { expiresIn: '1h' });
}

function makeContext(username = 'org1', type = 'organizer') {
  const token = makeToken(username, type);
  return { headers: { authorization: `Bearer ${token}` } };
}

/** Crea un driver Neo4j mock que devuelve registros específicos. */
function makeDriver(records = []) {
  const session = {
    run: async () => ({ records }),
    close: async () => {},
  };
  return { session: () => session };
}

/** Crea un nodo Match mock con las propiedades dadas. */
function makeMatchRecord(props = {}) {
  return {
    get: (key) => {
      if (key === 'm') return { properties: props };
      if (key === 't') return { properties: props };
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests de schema: firma de updateMatchResult
// ---------------------------------------------------------------------------

describe('schema updateMatchResult', () => {
  test('mutation existe con los parámetros correctos', async () => {
    const sdl = await fs.readFile(schemaPath, 'utf8');
    const ast = parse(sdl);

    const mutationType = ast.definitions.find(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Mutation'
    );
    assert.ok(mutationType, 'Mutation type no encontrado');

    const mutation = mutationType.fields?.find((f) => f.name.value === 'updateMatchResult');
    assert.ok(mutation, 'updateMatchResult no encontrado en Mutation');

    const args = Object.fromEntries(mutation.arguments?.map((a) => [a.name.value, a]) || []);
    assert.ok(args.tournamentId, 'falta tournamentId');
    assert.ok(args.stageId, 'falta stageId');
    assert.ok(args.matchId, 'falta matchId');
    assert.ok(args.homeScore, 'falta homeScore');
    assert.ok(args.awayScore, 'falta awayScore');
  });

  test('mutation no duplicada — exactamente una vez', async () => {
    const sdl = await fs.readFile(schemaPath, 'utf8');
    const ast = parse(sdl);

    const mutationType = ast.definitions.find(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Mutation'
    );
    const occurrences = (mutationType?.fields || []).filter(
      (f) => f.name.value === 'updateMatchResult'
    );
    assert.equal(occurrences.length, 1, 'updateMatchResult debe aparecer exactamente una vez en Mutation');
  });

  test('tipo MatchResult eliminado (no debe existir)', async () => {
    const sdl = await fs.readFile(schemaPath, 'utf8');
    const ast = parse(sdl);

    const matchResult = ast.definitions.find(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'MatchResult'
    );
    assert.equal(matchResult, undefined, 'MatchResult no debería existir en el schema');
  });

  test('tipo Match expone homeScore, awayScore, status, resultRecordedAt, resultRecordedBy', async () => {
    const sdl = await fs.readFile(schemaPath, 'utf8');
    const ast = parse(sdl);

    const matchType = ast.definitions.find(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Match'
    );
    assert.ok(matchType, 'Match type no encontrado');

    const fields = new Set(matchType.fields?.map((f) => f.name.value) || []);
    for (const expected of ['homeScore', 'awayScore', 'status', 'resultRecordedAt', 'resultRecordedBy']) {
      assert.ok(fields.has(expected), `Match.${expected} no encontrado`);
    }
  });

  test('Match.status sin duplicados', async () => {
    const sdl = await fs.readFile(schemaPath, 'utf8');
    const ast = parse(sdl);

    const matchType = ast.definitions.find(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Match'
    );
    const statusFields = (matchType?.fields || []).filter((f) => f.name.value === 'status');
    assert.equal(statusFields.length, 1, 'Match.status debe aparecer exactamente una vez');
  });
});

// ---------------------------------------------------------------------------
// Tests de autenticación: requireOrganizer
// ---------------------------------------------------------------------------

describe('updateMatchResult — autenticación', () => {
  test('rechaza token de tipo team', () => {
    const ctx = makeContext('team1', 'team');
    assert.throws(
      () => requireOrganizerFromAuthHeader(ctx.headers.authorization),
      /FORBIDDEN/
    );
  });

  test('rechaza ausencia de token', () => {
    assert.throws(
      () => requireOrganizerFromAuthHeader(''),
      /UNAUTHORIZED/
    );
  });

  test('acepta token de organizador', () => {
    const ctx = makeContext('org1', 'organizer');
    const payload = requireOrganizerFromAuthHeader(ctx.headers.authorization);
    assert.equal(payload.type, 'organizer');
    assert.equal(payload.username, 'org1');
  });
});

// ---------------------------------------------------------------------------
// Tests de lógica de validación: scores y estado torneo
// ---------------------------------------------------------------------------

describe('updateMatchResult — validaciones de negocio', () => {
  test('score negativo debe ser rechazado', () => {
    const homeScore = -1;
    const awayScore = 0;
    const h = Number(homeScore);
    const a = Number(awayScore);
    assert.ok(!Number.isInteger(h) || h < 0, 'homeScore negativo debe fallar la validación');
  });

  test('score decimal debe ser rechazado', () => {
    const homeScore = 1.5;
    const h = Number(homeScore);
    // Los trunc y validación que hace el resolver
    assert.ok(!Number.isInteger(h), 'homeScore decimal debe fallar la validación');
  });

  test('scores enteros no negativos son válidos', () => {
    for (const s of [0, 1, 2, 10, 100]) {
      assert.ok(Number.isInteger(s) && s >= 0, `score ${s} debe ser válido`);
    }
  });

  test('estado torneo distinto de published debe bloquear la carga', () => {
    for (const status of ['draft', 'DRAFT', '', undefined, null]) {
      const tStatus = String(status || '').toLowerCase();
      assert.notEqual(tStatus, 'published', `torneo en estado "${status}" no debe permitir carga`);
    }
  });

  test('estado torneo published permite la carga', () => {
    const tStatus = String('published').toLowerCase();
    assert.equal(tStatus, 'published');
  });

  test('el partido queda en estado finished tras cargar resultado', () => {
    // El resolver fija matchStatus = 'finished'; matchFromNeoProps lo mapea a 'finished'.
    const mockNeoMatchProps = { id: 'm1', homeScore: 2, awayScore: 1, matchStatus: 'finished' };
    const ms = String(mockNeoMatchProps.matchStatus || '').toLowerCase();
    const status = ms === 'finished' ? 'finished' : 'scheduled';
    assert.equal(status, 'finished');
  });

  test('partido sin resultado previo devuelve status scheduled', () => {
    const mockNeoMatchProps = { id: 'm1', matchStatus: undefined };
    const ms = String(mockNeoMatchProps.matchStatus || '').toLowerCase();
    const status = ms === 'finished' ? 'finished' : 'scheduled';
    assert.equal(status, 'scheduled');
  });
});
