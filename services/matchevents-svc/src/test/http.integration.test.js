/**
 * Pruebas HTTP de integración contra Postgres real (liga360_matchevents).
 * Siembra eventos con atribución completa y legacy (sin inscription_id),
 * verifica las agregaciones de stats y el filtrado de `notes` por rol.
 * Si la DB no está disponible (docker compose abajo), se saltean limpiamente.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { pool, closePool } from '../config/db.js';

const organizerToken = jwt.sign({ sub: 1, type: 'organizer' }, 'devsecret');
const TID = `t-itest-${Date.now()}`;
const CID = `c-itest-${Date.now()}`;
const MATCH_A = `m-itest-a-${Date.now()}`;
const MATCH_B = `m-itest-b-${Date.now()}`;

let server;
let baseUrl;
let dbAvailable = false;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function seed() {
  const insert = `INSERT INTO "MatchEvent"(match_id, tournament_id, competition_id, event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
  // Goleador vinculado a plantel (2 goles en partidos distintos)
  await pool.query(insert, [MATCH_A, TID, CID, 'goal', 10, 100, 'Juan Pérez', 5, null]);
  await pool.query(insert, [MATCH_B, TID, CID, 'goal', 10, 100, 'Juan Pérez', 40, null]);
  // Goleador por texto libre con inscripción
  await pool.query(insert, [MATCH_A, TID, CID, 'goal', 11, null, 'Carlos Gómez', 20, null]);
  // Evento legacy: sin inscription_id ni competition_id
  await pool.query(insert, [MATCH_A, TID, null, 'goal', null, null, 'Sin Atribuir', 60, null]);
  // Tarjetas y suspensión
  await pool.query(insert, [MATCH_A, TID, CID, 'yellow_card', 10, 100, 'Juan Pérez', 30, null]);
  await pool.query(insert, [MATCH_B, TID, CID, 'red_card', 11, null, 'Carlos Gómez', 80, null]);
  await pool.query(insert, [MATCH_B, TID, CID, 'suspension', 11, null, 'Carlos Gómez', null, 2]);
  // Evento con notes para verificar filtrado por rol
  await pool.query(
    `INSERT INTO "MatchEvent"(match_id, tournament_id, competition_id, event_type, inscription_id, display_name, notes)
     VALUES ($1,$2,$3,'other_sanction',10,'Equipo A','observación interna')`,
    [MATCH_A, TID, CID]
  );
}

describe('matchevents-svc HTTP (integración con DB)', () => {
  before(async () => {
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch {
      console.warn('DB de matchevents no disponible; tests de integración salteados');
      return;
    }
    await seed();
    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (dbAvailable) {
      await pool.query('DELETE FROM "MatchEvent" WHERE tournament_id = $1', [TID]);
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  });

  test('GET stats/scorers agrega por playerKey incluyendo legacy', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/tournaments/${TID}/stats/scorers`);
      assert.equal(r.status, 200);
      const juan = r.body.find((s) => s.playerKey === 'member:100');
      assert.equal(juan.goals, 2);
      assert.equal(juan.inscriptionId, 10);
      const carlos = r.body.find((s) => s.displayName === 'Carlos Gómez');
      assert.equal(carlos.goals, 1);
      // Legacy sin inscripción agrega igual, con inscriptionId null
      const legacy = r.body.find((s) => s.displayName === 'Sin Atribuir');
      assert.equal(legacy.goals, 1);
      assert.equal(legacy.inscriptionId, null);
    })();
  });

  test('GET stats/scorers filtra por competitionId (excluye legacy NULL)', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/tournaments/${TID}/stats/scorers?competitionId=${CID}`);
      assert.equal(r.status, 200);
      assert.equal(r.body.some((s) => s.displayName === 'Sin Atribuir'), false);
      assert.equal(r.body.find((s) => s.playerKey === 'member:100').goals, 2);
    })();
  });

  test('GET stats/cards suma amarillas, rojas y fechas de suspensión', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/tournaments/${TID}/stats/cards`);
      assert.equal(r.status, 200);
      const juan = r.body.find((s) => s.playerKey === 'member:100');
      assert.equal(juan.yellowCards, 1);
      assert.equal(juan.redCards, 0);
      const carlos = r.body.find((s) => s.displayName === 'Carlos Gómez');
      assert.equal(carlos.redCards, 1);
      assert.equal(carlos.suspensionMatches, 2);
    })();
  });

  test('GET stats/teams agrega por inscripción (sin legacy NULL)', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/tournaments/${TID}/stats/teams`);
      assert.equal(r.status, 200);
      const team10 = r.body.find((s) => s.inscriptionId === 10);
      assert.equal(team10.goals, 2);
      assert.equal(team10.yellowCards, 1);
      const team11 = r.body.find((s) => s.inscriptionId === 11);
      assert.equal(team11.goals, 1);
      assert.equal(team11.redCards, 1);
      assert.equal(r.body.some((s) => s.inscriptionId == null), false);
    })();
  });

  test('GET /tournaments/:id/events?inscriptionId= devuelve eventos del equipo', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/tournaments/${TID}/events?inscriptionId=10`);
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 4);
      assert.equal(r.body.every((e) => e.inscription_id === 10), true);
    })();
  });

  test('notes se excluye sin token y se incluye con organizador', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const anon = await req('GET', `/matches/${MATCH_A}/events`);
      assert.equal(anon.status, 200);
      assert.equal(anon.body.every((e) => !('notes' in e)), true);

      const org = await req('GET', `/matches/${MATCH_A}/events`, null, { Authorization: `Bearer ${organizerToken}` });
      assert.equal(org.status, 200);
      const sanction = org.body.find((e) => e.event_type === 'other_sanction');
      assert.equal(sanction.notes, 'observación interna');
    })();
  });

  test('POST crea evento con competition_id e inscription_id persistidos', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req(
        'POST',
        `/matches/${MATCH_B}/events`,
        { event_type: 'goal', tournament_id: TID, competition_id: CID, inscription_id: 10, linked_member_id: 100, display_name: 'Juan Pérez', minute: 88 },
        { Authorization: `Bearer ${organizerToken}` }
      );
      assert.equal(r.status, 201);
      assert.equal(r.body.competition_id, CID);
      assert.equal(r.body.inscription_id, 10);
    })();
  });
});
