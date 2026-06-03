import { describe, expect, it } from 'vitest';
import { computeAutoAdvance, collectAutoAdvancePlacementsByDest } from '../../../modules/tournaments-list/stageAutoAdvance';
import type { TournamentStage } from '../../../modules/tournaments-list/types';

function row(
  position: number,
  inscriptionId: string,
  displayName: string,
  points: number,
  goalDifference = 0,
  goalsFor = 0
) {
  return {
    position,
    inscriptionId,
    displayName,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor,
    goalsAgainst: 0,
    goalDifference,
    points,
  };
}

describe('computeAutoAdvance', () => {
  it('avance top 2 por grupo en fase de grupos', () => {
    const stage: Pick<TournamentStage, 'format' | 'groups'> = {
      format: 'groups',
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          order: 1,
          standings: [row(1, '1', 'A', 9), row(2, '2', 'B', 6), row(3, '3', 'C', 3)],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          order: 2,
          standings: [row(1, '4', 'D', 9), row(2, '5', 'E', 6), row(3, '6', 'F', 3)],
        },
      ],
    };

    const out = computeAutoAdvance(stage, { selectionKind: 'top', topN: 2 });
    expect(out.map((t) => t.inscriptionId)).toEqual(['1', '2', '4', '5']);
  });

  it('avance bestN: mejores terceros entre todos los grupos', () => {
    const stage: Pick<TournamentStage, 'format' | 'groups'> = {
      format: 'groups',
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          order: 1,
          standings: [row(1, 'a1', 'A1', 9), row(2, 'a2', 'A2', 6), row(3, 'a3', 'A3', 4, 2, 5)],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          order: 2,
          standings: [row(1, 'b1', 'B1', 9), row(2, 'b2', 'B2', 6), row(3, 'b3', 'B3', 6, 1, 4)],
        },
        {
          id: 'g3',
          name: 'Grupo 3',
          order: 3,
          standings: [row(1, 'c1', 'C1', 9), row(2, 'c2', 'C2', 6), row(3, 'c3', 'C3', 3, 0, 2)],
        },
      ],
    };

    const out = computeAutoAdvance(stage, { selectionKind: 'bestN', topN: 2, rangeFrom: 3 });
    expect(out.map((t) => t.displayName)).toEqual(['B3', 'A3']);
  });

  it('collectAutoAdvancePlacementsByDest deduplica top 2 + bestN hacia la misma eliminatoria', () => {
    const stage: Pick<TournamentStage, 'format' | 'groups'> = {
      format: 'groups',
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          order: 1,
          standings: [row(1, '1', 'A', 9), row(2, '2', 'B', 6), row(3, '3', 'C', 4, 2, 5)],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          order: 2,
          standings: [row(1, '4', 'D', 9), row(2, '5', 'E', 6), row(3, '6', 'F', 6, 1, 4)],
        },
        {
          id: 'g3',
          name: 'Grupo 3',
          order: 3,
          standings: [row(1, '7', 'G', 9), row(2, '8', 'H', 6), row(3, '9', 'I', 3, 0, 2)],
        },
      ],
    };

    const byDest = collectAutoAdvancePlacementsByDest(stage, [
      { toStageId: 'elim', selectionKind: 'top', topN: 2 },
      { toStageId: 'elim', selectionKind: 'bestN', topN: 2, rangeFrom: 3 },
    ]);

    expect([...(byDest.get('elim') ?? []).map((t) => t.inscriptionId)].sort()).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8'].sort()
    );
  });
});
