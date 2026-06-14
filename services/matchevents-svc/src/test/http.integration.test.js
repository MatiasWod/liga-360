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

const organizerToken = jwt.sign({ sub: 1, type: 'organizer', isVerified: true }, 'devsecret');
const TID = `t-itest-${Date.now()}`;
const TID2 = `t-itest-b-${Date.now()}`;
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
  // Presencias: snapshot de texto (Juan vinculado + invitado) para PJ y lectura pública
  const insertPresence = `INSERT INTO "MatchPresence"(match_id, tournament_id, competition_id, inscription_id, linked_member_id, display_name, is_guest)
                          VALUES ($1,$2,$3,$4,$5,$6,$7)`;
  await pool.query(insertPresence, [MATCH_A, TID, CID, 10, 100, 'Juan Pérez', false]);
  await pool.query(insertPresence, [MATCH_B, TID, CID, 10, 100, 'Juan Pérez', false]);
  await pool.query(insertPresence, [MATCH_A, TID, CID, 10, null, 'Invitado X', true]);
  // Segundo torneo: mismo jugador anota 1 gol más (cross-edición)
  await pool.query(insert, [MATCH_A, TID2, CID, 'goal', 10, 100, 'Juan Pérez', 12, null]);
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
      await pool.query('DELETE FROM "MatchPresence" WHERE tournament_id = $1', [TID]);
      await pool.query('DELETE FROM "MatchEvent" WHERE tournament_id = $1', [TID2]);
      await pool.query('DELETE FROM "MatchPresence" WHERE tournament_id = $1', [TID2]);
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  });

  test('GET stats/scorers agrega por playerKey incluyendo legacy', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/stats/scorers?tournamentId=${TID}`);
      assert.equal(r.status, 200);
      const juan = r.body.find((s) => s.playerKey === 'member:100');
      assert.equal(juan.goals, 2);
      assert.equal(juan.inscriptionId, 10);
      // PJ desde presencias: Juan tiene 2; Carlos no tiene → null
      assert.equal(juan.matchesPlayed, 2);
      assert.equal(r.body.find((s) => s.displayName === 'Carlos Gómez').matchesPlayed, null);
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
      const r = await req('GET', `/stats/scorers?tournamentId=${TID}&competitionId=${CID}`);
      assert.equal(r.status, 200);
      assert.equal(r.body.some((s) => s.displayName === 'Sin Atribuir'), false);
      assert.equal(r.body.find((s) => s.playerKey === 'member:100').goals, 2);
    })();
  });

  test('GET /stats/scorers?tournamentIds= agrega goles cross-torneo', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/stats/scorers?tournamentIds=${TID},${TID2}`);
      assert.equal(r.status, 200);
      const juan = r.body.find((s) => s.playerKey === 'member:100');
      assert.equal(juan.goals, 3);
    })();
  });

  test('GET stats/cards suma amarillas, rojas y fechas de suspensión', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/stats/cards?tournamentId=${TID}`);
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
      const r = await req('GET', `/stats/teams?tournamentId=${TID}`);
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

  test('GET /stats?tournamentId=&inscriptionId= devuelve eventos del equipo', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/stats?tournamentId=${TID}&inscriptionId=10`);
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

  test('GET /stats/participants/:memberId devuelve totales y desglose por torneo', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', '/stats/participants/100', null, { Authorization: `Bearer ${organizerToken}` });
      assert.equal(r.status, 200);
      assert.equal(r.body.memberId, 100);
      assert.equal(r.body.totals.goals >= 2, true);
      assert.equal(r.body.totals.matchesPlayed >= 2, true);
      const row = r.body.byTournament.find((x) => x.tournamentId === TID);
      assert.equal(row.goals, 2);
      assert.equal(row.yellowCards, 1);
      assert.equal(row.matchesPlayed, 2);
    })();
  });

  test('GET /matches/:id/presences público devuelve snapshot (plantilla + invitado)', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    return (async () => {
      const r = await req('GET', `/matches/${MATCH_A}/presences`);
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 2);
      const juan = r.body.find((p) => p.linked_member_id === 100);
      assert.equal(juan.display_name, 'Juan Pérez');
      assert.equal(juan.is_guest, false);
      const guest = r.body.find((p) => p.is_guest);
      assert.equal(guest.display_name, 'Invitado X');
      assert.equal(guest.linked_member_id, null);
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
      const pres = await req('GET', `/matches/${MATCH_B}/presences`);
      assert.equal(pres.status, 200);
      assert.ok(pres.body.some((p) => p.linked_member_id === 100));
    })();
  });

  test('POST evento con invitado (sin plantilla) crea presencia automatica', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    const MATCH_G = `m-itest-guest-${Date.now()}`;
    return (async () => {
      const created = await req(
        'POST',
        `/matches/${MATCH_G}/events`,
        {
          event_type: 'goal',
          tournament_id: TID,
          competition_id: CID,
          inscription_id: 11,
          display_name: 'Invitado Gol',
          minute: 12,
        },
        { Authorization: `Bearer ${organizerToken}` }
      );
      assert.equal(created.status, 201);
      const pres = await req('GET', `/matches/${MATCH_G}/presences`);
      assert.equal(pres.status, 200);
      const guest = pres.body.find((p) => p.display_name === 'Invitado Gol');
      assert.ok(guest);
      assert.equal(guest.is_guest, true);
      assert.equal(guest.linked_member_id, null);
      assert.equal(guest.inscription_id, 11);
    })();
  });

  test('POST /events tennis_set crea el set y GET lo devuelve con extra_json', (t) => {
    if (!dbAvailable) return t.skip('sin DB');
    const MATCH_T = `m-itest-tennis-${Date.now()}`;
    return (async () => {
      const created = await req(
        'POST',
        `/matches/${MATCH_T}/events`,
        { event_type: 'tennis_set', tournament_id: TID, competition_id: CID, extra_json: { setNumber: 1, homeGames: 6, awayGames: 4 } },
        { Authorization: `Bearer ${organizerToken}` }
      );
      assert.equal(created.status, 201);
      assert.equal(created.body.event_type, 'tennis_set');
      assert.equal(created.body.display_name, 'Set 1');

      const r = await req('GET', `/matches/${MATCH_T}/events`);
      assert.equal(r.status, 200);
      const setEv = r.body.find((e) => e.event_type === 'tennis_set');
      assert.ok(setEv);
      assert.equal(setEv.extra_json.homeGames, 6);
      assert.equal(setEv.extra_json.awayGames, 4);

      // DELETE vía /events/:eventId (mismo CRUD genérico)
      const del = await req('DELETE', `/matches/${MATCH_T}/events/${setEv.id}`, null, { Authorization: `Bearer ${organizerToken}` });
      assert.equal(del.status, 200);
      await pool.query('DELETE FROM "MatchEvent" WHERE match_id = $1', [MATCH_T]);
    })();
  });
});
