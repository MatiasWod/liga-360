import { describe, expect, it } from 'vitest';
import { buildLiga360FixtureModel, stageMatchesSignature } from '../../../modules/tournaments-list/liga360FixtureAdapter';
import { parseLeagueLikeRoundId } from '../../../modules/tournaments-list/persistLiga360Fixture';
import type { TournamentMatchRow, TournamentStage } from '../../../modules/tournaments-list/types';

describe('parseLeagueLikeRoundId', () => {
  it('parsea ids de liga y grupo', () => {
    expect(parseLeagueLikeRoundId('lr-2|1')).toEqual({ round: 2, leg: 1 });
    expect(parseLeagueLikeRoundId('gr-1|2')).toEqual({ round: 1, leg: 2 });
  });
  it('rechaza knockout u otros', () => {
    expect(parseLeagueLikeRoundId('ko-r1')).toBeNull();
    expect(parseLeagueLikeRoundId('fx-r-1')).toBeNull();
  });
});

describe('stageMatchesSignature', () => {
  it('cambia con datos de partidos', () => {
    const a: TournamentStage = {
      id: 's1',
      name: 'Liga',
      order: 1,
      format: 'league',
      matches: [
        {
          id: 'm1',
          round: 1,
          leg: 1,
          slotIndex: 1,
          scheduledAt: null,
          homeScore: null,
          awayScore: null,
        } as TournamentMatchRow,
      ],
    };
    const b = {
      ...a,
      matches: [{ ...(a.matches![0] as TournamentMatchRow), homeScore: 1 }],
    };
    expect(stageMatchesSignature(a)).not.toBe(stageMatchesSignature(b));
  });
});

describe('buildLiga360FixtureModel', () => {
  it('arma liga con ids lr-{round}|{leg}', () => {
    const stage: TournamentStage = {
      id: 's1',
      name: 'Liga',
      order: 1,
      format: 'league',
      matches: [
        {
          id: 'm1',
          round: 1,
          leg: 1,
          slotIndex: 1,
          homeAssignedInscription: { inscriptionId: 'i1', displayName: 'A' },
          awayAssignedInscription: { inscriptionId: 'i2', displayName: 'B' },
        } as TournamentMatchRow,
      ],
    };
    const m = buildLiga360FixtureModel(stage);
    expect(m?.layout).toBe('league');
    expect(m && m.layout === 'league' ? m.fixture[0]?.id : '').toMatch(/^lr-1\|1$/);
    expect(m && m.layout === 'league' ? m.fixture[0]?.matches[0]?.homeTeamId : null).toBe('i1');
  });
});
