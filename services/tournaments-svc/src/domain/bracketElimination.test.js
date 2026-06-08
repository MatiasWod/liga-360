import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateEliminationSeriesScores,
  eliminationFirstRoundBracketPositions,
  eliminationFixtureCode,
  eliminationMatchCount,
  eliminationMatchSlots,
  formatEliminationMatchCodeFromProps,
  legsForEliminationSlot,
  nextPowerOf2,
  pickSeriesWinnerFromScoreMap,
  resolveEliminationBracketConfig,
  shouldCreateThirdPlaceMatch,
} from './bracketElimination.js';

test('nextPowerOf2', () => {
  assert.equal(nextPowerOf2(1), 1);
  assert.equal(nextPowerOf2(5), 8);
  assert.equal(nextPowerOf2(6), 8);
});

test('elimination P=8: 7 partidos y rondas', () => {
  const slots = eliminationMatchSlots(8);
  assert.equal(slots.length, 7);
  assert.equal(eliminationMatchCount(8), 7);
  const r1 = slots.filter((s) => s.round === 1);
  assert.equal(r1.length, 4);
  const r3 = slots.filter((s) => s.round === 3);
  assert.equal(r3.length, 1);
});

test('eliminationFixtureCode P{partido}R{ronda}', () => {
  assert.equal(eliminationFixtureCode(1, 1), 'P1R1');
  assert.equal(eliminationFixtureCode(3, 2), 'P3R2');
  assert.equal(eliminationFixtureCode(2, 1, 2, { doubleRound: true }), 'P2R1-L2');
  assert.equal(eliminationFixtureCode(2, 1, 2, { doubleRound: false }), 'P2R1');
});

test('formatEliminationMatchCodeFromProps normaliza legacy E*', () => {
  assert.equal(formatEliminationMatchCodeFromProps({ fixtureCode: 'E1-M2' }), 'P2R1');
  assert.equal(formatEliminationMatchCodeFromProps({ fixtureCode: 'P3R1' }), 'P3R1');
  assert.equal(formatEliminationMatchCodeFromProps({ round: 2, slotIndex: 4 }), 'P4R2');
});

test('aggregateEliminationSeriesScores suma ida y vuelta', () => {
  const legs = [
    {
      homeInscriptionId: 'a',
      awayInscriptionId: 'b',
      homeScore: 1,
      awayScore: 0,
      homeDisplayName: 'Alpha',
      awayDisplayName: 'Beta',
    },
    {
      homeInscriptionId: 'b',
      awayInscriptionId: 'a',
      homeScore: 0,
      awayScore: 2,
      homeDisplayName: 'Beta',
      awayDisplayName: 'Alpha',
    },
  ];
  const map = aggregateEliminationSeriesScores(legs);
  const picked = pickSeriesWinnerFromScoreMap(map);
  assert.equal(picked?.inscriptionId, 'a');
  assert.equal(picked?.score, 3);
});

test('aggregateEliminationSeriesScores unifica slot ref y id físico del mismo equipo', () => {
  const legs = [
    {
      homeInscriptionId: 'liga360-slot:ew:stage:m1',
      awayInscriptionId: 'ins-atletico',
      homeScore: 2,
      awayScore: 0,
      homeDisplayName: 'Liverpool FC',
      awayDisplayName: 'Atlético',
    },
    {
      homeInscriptionId: 'ins-atletico',
      awayInscriptionId: 'ins-liverpool',
      homeScore: 0,
      awayScore: 2,
      homeDisplayName: 'Atlético',
      awayDisplayName: 'Liverpool FC',
    },
  ];
  const map = aggregateEliminationSeriesScores(legs);
  const picked = pickSeriesWinnerFromScoreMap(map);
  assert.equal(picked?.inscriptionId, 'ins-liverpool');
  assert.equal(picked?.displayName, 'Liverpool FC');
  assert.equal(picked?.score, 4);
});

test('pickSeriesWinnerFromScoreMap no elige ganador con un solo equipo en el mapa', () => {
  const map = new Map([['ins-atletico', { score: 0, displayName: 'Atlético' }]]);
  assert.equal(pickSeriesWinnerFromScoreMap(map), null);
});

test('aggregateEliminationSeriesScores: Liverpool gana ida y vuelta aunque solo tenga refs de slot', () => {
  const legs = [
    {
      homeInscriptionId: 'liga360-slot:ew:s:m1',
      awayInscriptionId: 'liga360-slot:ew:s:m2',
      homeScore: 3,
      awayScore: 1,
      homeDisplayName: 'Liverpool FC',
      awayDisplayName: 'Atlético Madrid',
    },
    {
      homeInscriptionId: 'liga360-slot:ew:s:m2',
      awayInscriptionId: 'liga360-slot:ew:s:m1',
      homeScore: 0,
      awayScore: 2,
      homeDisplayName: 'Atlético Madrid',
      awayDisplayName: 'Liverpool FC',
    },
  ];
  const map = aggregateEliminationSeriesScores(legs);
  const picked = pickSeriesWinnerFromScoreMap(map);
  assert.equal(picked?.displayName, 'Liverpool FC');
  assert.equal(picked?.score, 5);
  assert.equal(picked?.inscriptionId, 'dn:liverpool fc');
});

test('legsForEliminationSlot: ida/vuelta excepto final única', () => {
  const cfg = resolveEliminationBracketConfig(
    { matchesPerTie: 'double', finalMatchesPerTie: 'single', thirdPlace: 'no' },
    false
  );
  assert.deepEqual(legsForEliminationSlot(1, 3, cfg), [1, 2]);
  assert.deepEqual(legsForEliminationSlot(2, 3, cfg), [1, 2]);
  assert.deepEqual(legsForEliminationSlot(3, 3, cfg), [1]);
});

test('shouldCreateThirdPlaceMatch', () => {
  const cfg = resolveEliminationBracketConfig({ thirdPlace: 'yes', numAdvancing: 1 }, false);
  assert.equal(shouldCreateThirdPlaceMatch(2, cfg), true);
  assert.equal(shouldCreateThirdPlaceMatch(1, cfg), false);
  const noThird = resolveEliminationBracketConfig({ thirdPlace: 'no' }, false);
  assert.equal(shouldCreateThirdPlaceMatch(3, noThird), false);
});

test('primera ronda: posiciones de llave 0 vs P-1, …', () => {
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 1), { idxA: 0, idxB: 7 });
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 2), { idxA: 1, idxB: 6 });
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 4), { idxA: 3, idxB: 4 });
});
