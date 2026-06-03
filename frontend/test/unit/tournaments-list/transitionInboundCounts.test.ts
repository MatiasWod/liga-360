import { describe, expect, it } from 'vitest';
import {
  countTeamsFromInboundTransition,
  describeInboundSelectionNatural,
} from '../../../modules/tournaments-list/transitionInboundCounts';
import type { TournamentStage } from '../../../modules/tournaments-list/types';

describe('transitionInboundCounts', () => {
  it('range en grupos: (hasta − desde + 1) × cantidad de grupos', () => {
    const groupsStage = {
      id: 'g',
      format: 'groups',
      groups: [{ id: 'a' }, { id: 'b' }],
      configJson: '{"numGroups": 2}',
    } as unknown as TournamentStage;

    expect(
      countTeamsFromInboundTransition(
        {
          selectionKind: 'range',
          rangeFrom: 9,
          rangeTo: 16,
          topN: null,
          bottomN: null,
        },
        groupsStage
      )
    ).toBe(16);
  });

  it('range en liga: un solo bracket de posiciones', () => {
    const league = {
      id: 'l',
      format: 'league',
    } as unknown as TournamentStage;

    expect(
      countTeamsFromInboundTransition(
        {
          selectionKind: 'range',
          rangeFrom: 9,
          rangeTo: 16,
          topN: null,
          bottomN: null,
        },
        league
      )
    ).toBe(8);
  });

  it('describe: grupos menciona cada grupo para rango', () => {
    const groupsStage = { format: 'groups' } as unknown as TournamentStage;
    expect(
      describeInboundSelectionNatural(
        { selectionKind: 'range', rangeFrom: 9, rangeTo: 16, topN: null, bottomN: null },
        groupsStage
      )
    ).toContain('cada grupo');
  });
});
