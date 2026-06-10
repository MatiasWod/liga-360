import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePresenceWriteAccess, normalizePresenceEntries, mergeParticipantTotals } from '../../domain/presence.js';

const inscription = { id: 10, linked_team_id: 5 };
const team = { id: 5, owner_user_id: 42 };

describe('evaluatePresenceWriteAccess (matriz de autorización)', () => {
  test('dueño del equipo → permitido', () => {
    const v = evaluatePresenceWriteAccess({ user: { sub: 42, type: 'team' }, inscription, team });
    assert.equal(v.ok, true);
  });

  test('organizador → 403 (solo dueños editan presencias)', () => {
    const v = evaluatePresenceWriteAccess({ user: { sub: 1, type: 'organizer' }, inscription, team });
    assert.equal(v.ok, false);
    assert.equal(v.statusCode, 403);
  });

  test('otro usuario team (no dueño) → 403', () => {
    const v = evaluatePresenceWriteAccess({ user: { sub: 99, type: 'team' }, inscription, team });
    assert.equal(v.ok, false);
    assert.equal(v.statusCode, 403);
  });

  test('sin token → 401', () => {
    const v = evaluatePresenceWriteAccess({ user: null, inscription, team });
    assert.equal(v.ok, false);
    assert.equal(v.statusCode, 401);
  });

  test('inscripción inexistente → 404', () => {
    const v = evaluatePresenceWriteAccess({ user: { sub: 42, type: 'team' }, inscription: null, team: null });
    assert.equal(v.ok, false);
    assert.equal(v.statusCode, 404);
  });

  test('inscripción manual sin equipo vinculado → 403', () => {
    const v = evaluatePresenceWriteAccess({
      user: { sub: 42, type: 'team' },
      inscription: { id: 11, linked_team_id: null },
      team: null,
    });
    assert.equal(v.ok, false);
    assert.equal(v.statusCode, 403);
  });
});

describe('normalizePresenceEntries', () => {
  test('normaliza plantilla + invitado de texto', () => {
    const r = normalizePresenceEntries([
      { linked_member_id: 100, display_name: ' Juan Pérez ' },
      { display_name: 'Invitado X', is_guest: true },
    ]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.entries, [
      { linkedMemberId: 100, displayName: 'Juan Pérez', isGuest: false },
      { linkedMemberId: null, displayName: 'Invitado X', isGuest: true },
    ]);
  });

  test('rechaza entrada sin display_name (snapshot obligatorio)', () => {
    const r = normalizePresenceEntries([{ linked_member_id: 100, display_name: '  ' }]);
    assert.equal(r.ok, false);
    assert.match(r.error, /display_name/);
  });

  test('rechaza member duplicado en el payload', () => {
    const r = normalizePresenceEntries([
      { linked_member_id: 100, display_name: 'Juan' },
      { linked_member_id: 100, display_name: 'Juan otra vez' },
    ]);
    assert.equal(r.ok, false);
  });

  test('rechaza nombre de texto duplicado (case-insensitive)', () => {
    const r = normalizePresenceEntries([
      { display_name: 'Invitado X' },
      { display_name: 'invitado x' },
    ]);
    assert.equal(r.ok, false);
  });

  test('lista vacía es válida (borra todas las presencias)', () => {
    const r = normalizePresenceEntries([]);
    assert.equal(r.ok, true);
    assert.deepEqual(r.entries, []);
  });

  test('payload no-lista → error', () => {
    assert.equal(normalizePresenceEntries(null).ok, false);
    assert.equal(normalizePresenceEntries({}).ok, false);
  });
});

describe('mergeParticipantTotals', () => {
  test('combina eventos y presencias por torneo; PJ solo con presencias', () => {
    const events = [
      { tournament_id: 't1', competition_id: 'c1', goals: 3, yellow_cards: 1, red_cards: 0, suspension_matches: 0 },
      { tournament_id: 't2', competition_id: null, goals: 1, yellow_cards: 0, red_cards: 1, suspension_matches: 2 },
    ];
    const presences = [{ tournament_id: 't1', competition_id: 'c1', matches_played: 5 }];
    const { totals, byTournament } = mergeParticipantTotals(events, presences);

    const t1 = byTournament.find((r) => r.tournamentId === 't1');
    assert.equal(t1.goals, 3);
    assert.equal(t1.matchesPlayed, 5);
    // t2 sin presencias: PJ null, nunca inferido
    const t2 = byTournament.find((r) => r.tournamentId === 't2');
    assert.equal(t2.matchesPlayed, null);

    assert.equal(totals.goals, 4);
    assert.equal(totals.redCards, 1);
    assert.equal(totals.matchesPlayed, 5);
  });

  test('presencias sin eventos generan fila con ceros (jugador sin goles visible)', () => {
    const { totals, byTournament } = mergeParticipantTotals(
      [],
      [{ tournament_id: 't1', competition_id: 'c1', matches_played: 3 }]
    );
    assert.equal(byTournament.length, 1);
    assert.equal(byTournament[0].goals, 0);
    assert.equal(byTournament[0].matchesPlayed, 3);
    assert.equal(totals.matchesPlayed, 3);
  });

  test('sin datos: totales en cero y PJ null', () => {
    const { totals, byTournament } = mergeParticipantTotals([], []);
    assert.equal(byTournament.length, 0);
    assert.equal(totals.goals, 0);
    assert.equal(totals.matchesPlayed, null);
  });
});
