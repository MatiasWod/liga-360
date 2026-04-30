import type { TournamentMatchRow } from './types';

export type PoolEntry =
  | {
      kind: 'inscription';
      item: { id: string | number; display_name: string };
    }
  | { kind: 'assigned'; id: string; displayName: string };

export type ParticipantPoolSection = {
  sectionLabel: string;
  entries: PoolEntry[];
};

export function resolvePoolEntryLabel(en: PoolEntry): string {
  return en.kind === 'inscription' ? String(en.item.display_name || '') : String(en.displayName || '');
}

export function resolvePoolEntryId(en: PoolEntry): string {
  return en.kind === 'inscription' ? String(en.item.id) : en.id;
}

export function normPoolId(id: string | null | undefined): string {
  return id == null ? '' : String(id).trim();
}

export function optionAllowedForSlot(
  choiceId: string | null | undefined,
  role: 'home' | 'away',
  curMatch: TournamentMatchRow,
  blockedElsewhere: Set<string>
): boolean {
  const cid = normPoolId(choiceId);
  if (!cid) return true;
  const homeNow = normPoolId(curMatch.homeAssignedInscription?.inscriptionId);
  const awayNow = normPoolId(curMatch.awayAssignedInscription?.inscriptionId);
  if (role === 'home' && cid !== homeNow && awayNow && cid === awayNow) return false;
  if (role === 'away' && cid !== awayNow && homeNow && cid === homeNow) return false;
  if ((role === 'home' && cid === homeNow) || (role === 'away' && cid === awayNow)) return true;
  if (blockedElsewhere.has(cid)) return false;
  return true;
}

export function filterPoolSectionsForRole(
  sections: ParticipantPoolSection[],
  role: 'home' | 'away',
  curMatch: TournamentMatchRow,
  blockedElsewhere: Set<string>
): ParticipantPoolSection[] {
  const out: ParticipantPoolSection[] = [];
  for (const sec of sections) {
    const entries = sec.entries.filter((en) =>
      optionAllowedForSlot(resolvePoolEntryId(en), role, curMatch, blockedElsewhere)
    );
    if (entries.length > 0) out.push({ sectionLabel: sec.sectionLabel, entries });
  }
  return out;
}
