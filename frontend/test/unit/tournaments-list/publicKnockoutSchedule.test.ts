import { describe, expect, it } from 'vitest';
import { buildPublicKnockoutViewData } from '../../../modules/tournaments-list/publicKnockoutSchedule';
import type { TournamentMatchRow, TournamentStage } from '../../../modules/tournaments-list/types';

function m(partial: Partial<TournamentMatchRow> & { id: string }): TournamentMatchRow {
  return {
    round: 1,
    leg: 1,
    slotIndex: 1,
    status: 'scheduled',
    ...partial,
  };
}

describe('buildPublicKnockoutViewData', () => {
  it('ordena partidos por slot dentro de cada ronda y separa 3er puesto', () => {
    const stage: TournamentStage = {
      id: 's1',
      name: 'Elim',
      order: 2,
      format: 'elimination',
      stageStatus: 'active',
      matches: [
        m({ id: 'm2', round: 1, slotIndex: 2, homeAssignedInscription: { inscriptionId: '2', displayName: 'B' }, awayAssignedInscription: { inscriptionId: '3', displayName: 'C' } }),
        m({ id: 'm1', round: 1, slotIndex: 1, homeAssignedInscription: { inscriptionId: '1', displayName: 'A' }, awayAssignedInscription: { inscriptionId: '4', displayName: 'D' } }),
        m({ id: 'm-q1', round: 2, slotIndex: 1, homeAssignedInscription: { inscriptionId: 'liga360-slot:ew:s1:m1', displayName: 'Ganador Partido 1' }, awayAssignedInscription: { inscriptionId: 'liga360-slot:ew:s1:m8', displayName: 'Ganador Partido 8' } }),
        m({ id: 'm3p', round: 2, slotIndex: 0, matchKind: 'third_place', fixtureCode: '3P' }),
      ],
    };
    const data = buildPublicKnockoutViewData(stage);
    expect(data).not.toBeNull();
    expect(data!.columns).toHaveLength(2);
    expect(data!.columns[0].matches.map((x) => x.id)).toEqual(['m1', 'm2']);
    expect(data!.columns[1].label).toBe('Final');
    expect(data!.columns[1].matches[0].homeTeam.name).toBe('—');
    expect(data!.thirdPlaceMatches).toHaveLength(1);
    expect(data!.thirdPlaceMatches[0].id).toBe('m3p');
  });
});
