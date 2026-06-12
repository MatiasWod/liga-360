import type { TournamentEntity } from '../types';

export type OrganizerIndexEntry = {
  name: string;
  totalCount: number;
  activeCount: number;
  finishedCount: number;
};

function isFinishedStatus(status?: string | null): boolean {
  const value = String(status || '').trim().toLowerCase();
  return value === 'finished' || value === 'closed';
}

export function buildOrganizersIndex(tournaments: TournamentEntity[]): OrganizerIndexEntry[] {
  const map = new Map<string, OrganizerIndexEntry>();

  for (const tournament of tournaments) {
    const name = String(tournament.organizer || '').trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const current = map.get(key) ?? {
      name,
      totalCount: 0,
      activeCount: 0,
      finishedCount: 0,
    };

    current.totalCount += 1;
    if (isFinishedStatus(tournament.status)) {
      current.finishedCount += 1;
    } else {
      current.activeCount += 1;
    }

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

export function filterOrganizersByQuery(
  organizers: OrganizerIndexEntry[],
  query: string
): OrganizerIndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return organizers;
  return organizers.filter((entry) => entry.name.toLowerCase().includes(needle));
}
