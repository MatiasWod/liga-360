import { describe, expect, it } from 'vitest';
import { dedupeCompetitionsByName } from '../../../modules/team-presences/matchDedupe';

describe('dedupeCompetitionsByName', () => {
  it('prefiere la competición con más partidos finalizados (copia actualizada del organizador)', () => {
    const stale = {
      id: 'c-old',
      name: 'Primera división',
      order: 1,
      stages: [
        {
          id: 's1',
          name: 'Liga',
          format: 'league',
          order: 1,
          matches: [
            { id: 'm1', status: 'finished', round: 1, homeScore: 2, awayScore: 1 },
            { id: 'm2', status: 'scheduled', round: 2 },
            { id: 'm3', status: 'scheduled', round: 3 },
          ],
        },
      ],
    };
    const fresh = {
      id: 'c-new',
      name: 'Primera división',
      order: 1,
      stages: [
        {
          id: 's2',
          name: 'Liga',
          format: 'league',
          order: 1,
          matches: [
            { id: 'm4', status: 'finished', round: 1, homeScore: 2, awayScore: 1 },
            { id: 'm5', status: 'finished', round: 2, homeScore: 3, awayScore: 0 },
            { id: 'm6', status: 'scheduled', round: 3 },
          ],
        },
      ],
    };
    const result = dedupeCompetitionsByName([stale, fresh] as any);
    expect(result).toHaveLength(1);
    expect((result[0] as unknown as { id: string }).id).toBe('c-new');
  });
});
