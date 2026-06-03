import { describe, expect, it } from 'vitest';
import {
  addEmptyMatch,
  addRound,
  findRoundContainingMatch,
  moveMatch,
  moveMatchToRound,
  removeMatch,
  reorderWithinRound,
} from '../../../components/fixture-viewer/fixtureMutations';
import type { Round } from '../../../components/fixture-viewer/types';

const sample: Round[] = [
  {
    id: 'r1',
    name: 'Fecha 1',
    matches: [
      { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
      { id: 'm2', homeTeamId: 'c', awayTeamId: 'd' },
    ],
  },
  {
    id: 'r2',
    name: 'Fecha 2',
    matches: [{ id: 'm3', homeTeamId: null, awayTeamId: null }],
  },
];

describe('fixtureMutations', () => {
  it('reorderWithinRound mueve partido dentro de la misma fecha', () => {
    const next = reorderWithinRound(sample, 'r1', 'm2', 'm1');
    expect(next[0].matches.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('moveMatch mueve partido a otra fecha antes de otro partido', () => {
    const next = moveMatch(sample, 'm1', 'm3');
    expect(next[0].matches.map((m) => m.id)).toEqual(['m2']);
    expect(next[1].matches.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('moveMatch al tail agrega al final', () => {
    const next = moveMatch(sample, 'm1', 'round-tail-r2');
    expect(next[0].matches.map((m) => m.id)).toEqual(['m2']);
    expect(next[1].matches.map((m) => m.id)).toEqual(['m3', 'm1']);
  });

  it('moveMatchToRound mueve al final de otra fecha', () => {
    const next = moveMatchToRound(sample, 'm1', 'r2');
    expect(next[0].matches.map((m) => m.id)).toEqual(['m2']);
    expect(next[1].matches.map((m) => m.id)).toEqual(['m3', 'm1']);
  });

  it('addEmptyMatch y removeMatch', () => {
    const withM = addEmptyMatch(sample, 'r1');
    expect(withM[0].matches).toHaveLength(3);
    const newId = withM[0].matches[2]?.id;
    expect(newId).toBeTruthy();
    const removed = removeMatch(withM, newId!);
    expect(removed[0].matches).toHaveLength(2);
  });

  it('addRound', () => {
    const next = addRound(sample);
    expect(next).toHaveLength(3);
    expect(next[2].name).toMatch(/Fecha/);
  });

  it('findRoundContainingMatch', () => {
    expect(findRoundContainingMatch(sample, 'm3')).toEqual({ roundIndex: 1, matchIndex: 0 });
    expect(findRoundContainingMatch(sample, 'x')).toBeNull();
  });
});
