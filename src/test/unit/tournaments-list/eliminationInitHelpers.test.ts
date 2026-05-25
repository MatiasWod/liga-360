import { describe, expect, it } from 'vitest';
import type { TournamentMatchRow } from '../../../modules/tournaments-list/types';
import {
  buildEliminationTruncatePreview,
  buildSameStageWinnerSlotId,
  computeEliminationFeedingRound,
  dedupeEliminationSeriesMatches,
  expandAssignedIdsForPool,
  eliminationRoundLegSteps,
  formatCompactEliminationSlot,
  formatWinnerSlotLabel,
  inscriptionIdsAssignedAnywhereInMatches,
  inscriptionIdsUsedElsewhere,
  matchDisplayCode,
  matchesForRoundLeg,
  parseSameStageWinnerSlotId,
  physicalInscriptionIdsUsedElsewhere,
  resolvePoolChoicePhysicalId,
  resolveWinnerSlotLabelFromRef,
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

  it('matchDisplayCode normaliza legacy E* a P* o genera P{partido}R{ronda}', () => {
    expect(matchDisplayCode(m({ id: 'x', fixtureCode: 'E1-M2', round: 9 }))).toBe('P2R1');
    expect(matchDisplayCode(m({ id: 'y', fixtureCode: '', round: 2, slotIndex: 3, leg: 2 }))).toBe('P3R2-L2');
    expect(matchDisplayCode(m({ id: 'z', fixtureCode: '  ', round: 1, slotIndex: 1, leg: 1 }))).toBe('P1R1');
    expect(matchDisplayCode(m({ id: 'w', fixtureCode: 'P4R2-L2', round: 1, slotIndex: 1 }))).toBe('P4R2-L2');
  });

  it('formatCompactEliminationSlot usa P{n}R{m} compacto', () => {
    expect(formatCompactEliminationSlot(m({ id: 'x', fixtureCode: 'E1-M2', round: 9 }))).toBe('P2R1');
    expect(formatCompactEliminationSlot(m({ id: 'y', fixtureCode: '', round: 3, slotIndex: 1, leg: 1 }))).toBe('P1R3');
    expect(formatCompactEliminationSlot(m({ id: 'z', fixtureCode: '', round: 3, slotIndex: 1, leg: 2 }))).toBe('P1R3L2');
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

  it('formatWinnerSlotLabel incluye nombre de etapa', () => {
    expect(formatWinnerSlotLabel({ round: 1, slotIndex: 2 }, 'Repechaje')).toBe(
      'Ganador Partido 2 - Repechaje'
    );
  });

  it('resolveWinnerSlotLabelFromRef resuelve ganador de otra etapa', () => {
    const tournament = {
      competitions: [
        {
          stages: [
            {
              id: 'rep',
              name: 'Repechaje',
              order: 1,
              format: 'elimination' as const,
              matches: [{ id: 'm1', round: 1, slotIndex: 3, leg: 1 }],
            },
          ],
        },
      ],
    };
    expect(resolveWinnerSlotLabelFromRef(tournament, 'liga360-slot:ew:rep:m1')).toBe(
      'Ganador Partido 3 - Repechaje'
    );
  });

  it('parseSameStageWinnerSlotId y parseAnyStageWinnerSlotId son inversos del mismo stage', () => {
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
    expect(p.clasificatorioLlaveCodes.sort()).toEqual(['P1R2', 'P2R2']);
  });

  it('buildEliminationTruncatePreview dedupe ida/vuelta por slotIndex', () => {
    const matches = [
      m({ id: 'x', round: 2, slotIndex: 1, leg: 1 }),
      m({ id: 'y', round: 2, slotIndex: 1, leg: 2 }),
    ];
    const p = buildEliminationTruncatePreview(matches, 2);
    expect(p.clasificatorioLlaveCodes).toEqual(['P1R2']);
  });

  it('computeEliminationFeedingRound: 16 participantes y 8 clasificados → ronda 1', () => {
    expect(computeEliminationFeedingRound(16, 8)).toBe(1);
    expect(computeEliminationFeedingRound(16, 1)).toBeNull();
  });

  it('dedupeEliminationSeriesMatches: una fila por serie, pierna 1', () => {
    const out = dedupeEliminationSeriesMatches([
      m({ id: 'leg2', round: 1, slotIndex: 3, leg: 2 }),
      m({ id: 'leg1', round: 1, slotIndex: 3, leg: 1 }),
      m({ id: 'other', round: 1, slotIndex: 4, leg: 1 }),
    ]);
    expect(out.map((x) => x.id)).toEqual(['leg1', 'other']);
  });

  it('expandAssignedIdsForPool: id resuelto excluye también el ref pos: del pool', () => {
    const eligible = [
      { inscriptionId: 'pos:l:liga:9', resolvedRealId: '42' },
      { inscriptionId: 'liga360-slot:ew:rep:m1' },
    ];
    const assigned = new Set(['42']);
    const out = expandAssignedIdsForPool(assigned, eligible);
    expect(out.has('42')).toBe(true);
    expect(out.has('pos:l:liga:9')).toBe(true);
    expect(out.has('liga360-slot:ew:rep:m1')).toBe(false);
  });

  it('expandAssignedIdsForPool: ref sintético asignado excluye id real vinculado', () => {
    const eligible = [{ inscriptionId: 'pos:l:liga:10', resolvedRealId: '99' }];
    const assigned = new Set(['pos:l:liga:10']);
    const out = expandAssignedIdsForPool(assigned, eligible);
    expect(out.has('pos:l:liga:10')).toBe(true);
    expect(out.has('99')).toBe(true);
  });

  it('physicalInscriptionIdsUsedElsewhere detecta el mismo equipo con ids distintos', () => {
    const matches = [
      m({
        id: 'x',
        homeAssignedInscription: { inscriptionId: '245', displayName: 'BN2' },
      }),
      m({ id: 'y', homeAssignedInscription: null, awayAssignedInscription: null }),
    ];
    const eligible = [{ inscriptionId: 'pos:bestN:s:3:2:2', resolvedRealId: '245' }];
    const blocked = physicalInscriptionIdsUsedElsewhere(matches, eligible, 'y');
    expect(blocked.has('245')).toBe(true);
    expect(resolvePoolChoicePhysicalId('pos:bestN:s:3:2:2', eligible)).toBe('245');
  });
});
