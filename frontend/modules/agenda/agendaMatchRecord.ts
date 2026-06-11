import type { MatchRecord, MatchStatus } from '../../components/tournament-schedule/types';
import type { TournamentMatchRow } from '../tournaments-list/types';

function mapStatus(raw: string | null | undefined): MatchStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'live' || s === 'in_progress' || s === 'playing') return 'live';
  if (s === 'finished' || s === 'completed') return 'completed';
  if (s === 'postponed') return 'postponed';
  return 'scheduled';
}

function teamRef(
  slot?: { inscriptionId?: string; displayName?: string } | null,
  images?: ReadonlyMap<string, string>,
) {
  const id = String(slot?.inscriptionId ?? '').trim() || 'tbd';
  const name = slot?.displayName?.trim() || 'Por definir';
  const badgeUrl = images?.get(id);
  return { id, name, ...(badgeUrl ? { badgeUrl } : {}) };
}

export function tournamentMatchToRecord(
  match: TournamentMatchRow,
  images?: ReadonlyMap<string, string>,
): MatchRecord {
  return {
    id: match.id,
    homeTeam: teamRef(match.homeAssignedInscription, images),
    awayTeam: teamRef(match.awayAssignedInscription, images),
    scheduledAt: match.scheduledAt ?? undefined,
    venue: match.venue ?? undefined,
    referee: match.referee ?? undefined,
    status: mapStatus(match.status),
    homeScore: match.homeScore ?? undefined,
    awayScore: match.awayScore ?? undefined,
    leg: match.leg ?? undefined,
    slotIndex: match.slotIndex ?? undefined,
    matchCode: match.fixtureCode ?? undefined,
  };
}
