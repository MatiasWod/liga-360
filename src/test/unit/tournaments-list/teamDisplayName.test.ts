import { describe, expect, it } from 'vitest';
import {
  enrichStageTeamDisplayNames,
  resolvePersistedTeamDisplayName,
} from '../../../modules/tournaments-list/teamDisplayName';
import type { TournamentStage } from '../../../modules/tournaments-list/types';

describe('teamDisplayName', () => {
  it('resolvePersistedTeamDisplayName reemplaza BN2 por nombre real de inscripción', () => {
    const map = new Map([['243', { display_name: 'Brasil' }]]);
    expect(resolvePersistedTeamDisplayName('BN2', '243', map)).toBe('Brasil');
    expect(resolvePersistedTeamDisplayName('Brasil', '243', map)).toBe('Brasil');
  });

  it('resolvePersistedTeamDisplayName prefiere inscripción sobre nombre stale del grafo', () => {
    const map = new Map([['4', { display_name: 'República Checa' }]]);
    expect(resolvePersistedTeamDisplayName('Mundial FIFA 2026', '4', map)).toBe('República Checa');
  });

  it('enrichStageTeamDisplayNames corrige fixture y tablas de grupos', () => {
    const stage: TournamentStage = {
      id: 's1',
      name: 'Grupos',
      order: 1,
      format: 'groups',
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          order: 1,
          standings: [
            {
              position: 2,
              inscriptionId: '246',
              displayName: 'BN1',
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              points: 0,
            },
          ],
          matches: [
            {
              id: 'm1',
              homeAssignedInscription: { inscriptionId: '246', displayName: 'BN1' },
              awayAssignedInscription: { inscriptionId: '241', displayName: 'Argentina' },
            },
          ],
        },
      ],
    };
    const map = new Map([['246', { display_name: 'Italia' }]]);
    const out = enrichStageTeamDisplayNames(stage, map);
    expect(out.groups?.[0]?.standings?.[0]?.displayName).toBe('Italia');
    expect(out.groups?.[0]?.matches?.[0]?.homeAssignedInscription?.displayName).toBe('Italia');
  });
});
