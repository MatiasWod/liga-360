import { describe, expect, it } from 'vitest';
import {
  buildOrganizersIndex,
  filterOrganizersByQuery,
} from '../../../../modules/tournaments-list/browse/organizersIndex';

describe('buildOrganizersIndex', () => {
  it('agrupa torneos por organizador con contadores', () => {
    const rows = buildOrganizersIndex([
      { id: '1', name: 'A', organizer: 'Liga Norte', status: 'published', competitions: [] },
      { id: '2', name: 'B', organizer: 'Liga Norte', status: 'finished', competitions: [] },
      { id: '3', name: 'C', organizer: 'Copa Sur', status: 'draft', competitions: [] },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Copa Sur',
      totalCount: 1,
      activeCount: 1,
      finishedCount: 0,
    });
    expect(rows[1]).toMatchObject({
      name: 'Liga Norte',
      totalCount: 2,
      activeCount: 1,
      finishedCount: 1,
    });
  });
});

describe('filterOrganizersByQuery', () => {
  it('filtra por texto parcial sin distinguir mayúsculas', () => {
    const rows = filterOrganizersByQuery(
      [
        { name: 'Liga Norte', totalCount: 1, activeCount: 1, finishedCount: 0 },
        { name: 'Copa Sur', totalCount: 2, activeCount: 1, finishedCount: 1 },
      ],
      'norte'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Liga Norte');
  });
});
