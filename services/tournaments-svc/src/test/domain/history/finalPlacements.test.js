import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFinalPlacements } from '../../../domain/history/finalPlacements.js';

const row = (position, id, name, points = 0) => ({
  position,
  inscriptionId: id,
  displayName: name,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points,
});

const match = (id, round, homeId, awayId, hs, as, extra = {}) => ({
  id,
  round,
  homeScore: hs,
  awayScore: as,
  status: 'finished',
  homeAssignedInscription: { inscriptionId: homeId, displayName: `Equipo ${homeId}` },
  awayAssignedInscription: { inscriptionId: awayId, displayName: `Equipo ${awayId}` },
  ...extra,
});

const leagueStage = (order, standings) => ({
  id: `st-liga-${order}`,
  name: 'Liga',
  order,
  format: 'league',
  standings,
});

const eliminationStage = (order, matches) => ({
  id: `st-elim-${order}`,
  name: 'Llave',
  order,
  format: 'elimination',
  matches,
});

test('liga: campeón = posición 1, subcampeón = posición 2, sin 3er puesto', () => {
  const result = computeFinalPlacements({
    stages: [leagueStage(1, [row(2, '20', 'Beta', 30), row(1, '10', 'Alpha', 35)])],
  });
  assert.deepEqual(result.champion, { inscriptionId: '10', displayName: 'Alpha' });
  assert.deepEqual(result.runnerUp, { inscriptionId: '20', displayName: 'Beta' });
  assert.equal(result.thirdPlace, null);
  assert.equal(result.perStage.length, 1);
  assert.equal(result.perStage[0].kind, 'table');
});

test('eliminación: campeón = ganador del partido de mayor round', () => {
  const result = computeFinalPlacements({
    stages: [
      eliminationStage(1, [
        match('semi1', 1, '10', '20', 2, 1),
        match('semi2', 1, '30', '40', 0, 3),
        match('final', 2, '10', '40', 1, 2),
      ]),
    ],
  });
  assert.equal(result.champion?.inscriptionId, '40');
  assert.equal(result.runnerUp?.inscriptionId, '10');
});

test('partido de 3er puesto: se excluye de la final y aporta el 3er puesto', () => {
  const result = computeFinalPlacements({
    stages: [
      eliminationStage(1, [
        match('semi1', 1, '10', '20', 2, 0),
        match('semi2', 1, '30', '40', 1, 0),
        match('3p', 2, '20', '40', 2, 1, { matchKind: 'third_place' }),
        match('final', 2, '10', '30', 1, 0),
      ]),
    ],
  });
  assert.equal(result.champion?.inscriptionId, '10');
  assert.equal(result.runnerUp?.inscriptionId, '30');
  assert.equal(result.thirdPlace?.inscriptionId, '20');
});

test('placeholders liga360-slot:/pos: nunca son campeón', () => {
  const elim = computeFinalPlacements({
    stages: [eliminationStage(1, [match('final', 1, 'liga360-slot:a', '20', 3, 1)])],
  });
  assert.equal(elim.champion, null);

  const league = computeFinalPlacements({
    stages: [leagueStage(1, [row(1, 'pos:1:1', 'Slot'), row(2, '20', 'Beta')])],
  });
  assert.equal(league.champion, null);
  assert.equal(league.runnerUp?.inscriptionId, '20');
});

test('competencia vacía o null: todo null', () => {
  assert.equal(computeFinalPlacements(null).champion, null);
  assert.deepEqual(computeFinalPlacements({ stages: [] }).perStage, []);
});
