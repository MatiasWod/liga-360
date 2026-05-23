import { describe, expect, it } from 'vitest';
import type { TournamentMatchRow } from '../../../modules/tournaments-list/types';
import {
  buildEliminationTruncatePreview,
  buildSameStageWinnerSlotId,
  eliminationRoundLegSteps,
  formatCompactEliminationSlot,
  inscriptionIdsAssignedAnywhereInMatches,
  inscriptionIdsUsedElsewhere,
  matchDisplayCode,
  matchesForRoundLeg,
  parseSameStageWinnerSlotId,
  sortEliminationInitMatches,
} from '../../../modules/tournaments-list/eliminationInitHelpers';

function m(p: Partial<TournamentMatchRow> & { id: string }): TournamentMatchRow {
  return {
    round: null,
    leg: null,
    slotIndex: null,
    fixtureCode: null,
    ...p,
  };
}

describe('eliminationInitHelpers', () => {
  it('sortEliminationInitMatches ordena por round, slotIndex, leg', () => {
    const sorted = sortEliminationInitMatches([
      m({ id: 'c', round: 1, leg: 2, slotIndex: 2 }),
      m({ id: 'a', round: 1, leg: 1, slotIndex: 2 }),
      m({ id: 'b', round: 1, leg: 1, slotIndex: 1 }),
      m({ id: 'd', round: 2, leg: 1, slotIndex: 1 }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('eliminationRoundLegSteps devuelve un paso por ronda (legs se agrupan, la pierna 2 se auto-asigna)', () => {
    const keys = eliminationRoundLegSteps([
      m({ id: '1', round: 1, leg: 2, slotIndex: 1 }),
      m({ id: '2', round: 1, leg: 1, slotIndex: 1 }),
      m({ id: '3', round: 1, leg: 2, slotIndex: 2 }),
    ]);
    expect(keys).toEqual(['1|1']);
  });

  it('matchesForRoundLeg filtra por pierna correcta', () => {
    const list = [
      m({ id: 'a', round: 1, leg: 1, slotIndex: 1 }),
      m({ id: 'b', round: 1, leg: 2, slotIndex: 1 }),
    ];
    const one = matchesForRoundLeg(list, '1|1');
    expect(one.map((x) => x.id)).toEqual(['a']);
  });

  it('matchDisplayCode usa fixtureCode o código sintético estable', () => {
    expect(matchDisplayCode(m({ id: 'x', fixtureCode: 'E1-M2', round: 9 }))).toBe('E1-M2');
    expect(matchDisplayCode(m({ id: 'y', fixtureCode: '', round: 2, slotIndex: 3, leg: 2 }))).toMatch(/^E2-M3-L2$/);
    expect(matchDisplayCode(m({ id: 'z', fixtureCode: '  ', round: 1, slotIndex: 1, leg: 1 }))).toMatch(/^E1-M1$/);
  });

  it('formatCompactEliminationSlot usa fixtureCode sin guiones o E{r}M{s}L{leg}', () => {
    expect(formatCompactEliminationSlot(m({ id: 'x', fixtureCode: 'E1-M2', round: 9 }))).toBe('E1M2');
    expect(formatCompactEliminationSlot(m({ id: 'y', fixtureCode: '', round: 3, slotIndex: 1, leg: 1 }))).toBe('E3M1');
    expect(formatCompactEliminationSlot(m({ id: 'z', fixtureCode: '', round: 3, slotIndex: 1, leg: 2 }))).toBe('E3M1L2');
  });

  it('inscriptionIdsUsedElsewhere excluye un partido', () => {
    const ids = inscriptionIdsUsedElsewhere(
      [
        m({
          id: 'x',
          homeAssignedInscription: { inscriptionId: '1', displayName: 'A' },
          awayAssignedInscription: null,
        }),
        m({
          id: 'y',
          homeAssignedInscription: null,
          awayAssignedInscription: { inscriptionId: '2', displayName: 'B' },
        }),
      ],
      'x'
    );
    expect([...ids].sort()).toEqual(['2']);
  });

  it('inscriptionIdsAssignedAnywhereInMatches agrupa local y visitante', () => {
    const ids = inscriptionIdsAssignedAnywhereInMatches([
      m({
        id: 'x',
        homeAssignedInscription: { inscriptionId: 'a', displayName: '' },
        awayAssignedInscription: { inscriptionId: 'b', displayName: '' },
      }),
      m({ id: 'y', homeAssignedInscription: null, awayAssignedInscription: null }),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('buildSameStageWinnerSlotId y parseSameStageWinnerSlotId son inversos', () => {
    const stageId = 'st-1';
    const matchId = 'm-99';
    const raw = buildSameStageWinnerSlotId(stageId, matchId);
    expect(raw).toMatch(/^liga360-slot:ew:/);
    expect(parseSameStageWinnerSlotId('otro', raw)).toBeNull();
    expect(parseSameStageWinnerSlotId(stageId, raw)).toBe(matchId);
  });

  it('buildEliminationTruncatePreview: borra rr > L y clasificatorios desde última ronda', () => {
    const matches = [
      m({ id: 'a', round: 1, slotIndex: 1, leg: 1 }),
      m({ id: 'b', round: 1, slotIndex: 2, leg: 1 }),
      m({ id: 'c', round: 2, slotIndex: 1, leg: 1 }),
      m({ id: 'd', round: 2, slotIndex: 2, leg: 1 }),
      m({ id: 'e', round: 3, slotIndex: 1, leg: 1 }),
      m({ id: 'f', round: 4, slotIndex: 1, leg: 1 }),
    ];
    const p = buildEliminationTruncatePreview(matches, 2);
    expect(p.maxRound).toBe(4);
    expect(p.removableMatchesCount).toBe(2);
    expect(p.clasificatorioLlaveCodes.sort()).toEqual(['E2-M1', 'E2-M2']);
  });

  it('buildEliminationTruncatePreview dedupe ida/vuelta por slotIndex', () => {
    const matches = [
      m({ id: 'x', round: 2, slotIndex: 1, leg: 1 }),
      m({ id: 'y', round: 2, slotIndex: 1, leg: 2 }),
    ];
    const p = buildEliminationTruncatePreview(matches, 2);
    expect(p.clasificatorioLlaveCodes).toEqual(['E2-M1']);
  });
});
