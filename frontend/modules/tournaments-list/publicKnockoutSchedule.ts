import {
  buildScheduleFromStage,
  matchInputToRecord,
  type FixtureMatchInput,
} from '../../components/tournament-schedule/adaptFixtureData';
import { bracketPublicTeamName } from '../../components/tournament-schedule/matchParticipantUtils';
import type { MatchRecord } from '../../components/tournament-schedule/types';
import {
  bracketDisplayCode,
  eliminationMatchSubtitle,
  isThirdPlaceMatchRow,
} from './eliminationInitHelpers';
import type { TournamentMatchRow, TournamentStage } from './types';

function mapPublicSlot(
  slot: { inscriptionId?: string | null; displayName?: string | null } | null | undefined,
): { inscriptionId: string; displayName: string } | null {
  if (!slot?.inscriptionId) return null;
  const name = bracketPublicTeamName(slot);
  return {
    inscriptionId: String(slot.inscriptionId),
    displayName: name || '—',
  };
}

function rowToFixtureInput(m: TournamentMatchRow): FixtureMatchInput {
  return {
    id: m.id,
    round: m.round,
    leg: m.leg,
    slotIndex: m.slotIndex,
    fixtureCode: m.fixtureCode,
    matchKind: m.matchKind,
    scheduledAt: m.scheduledAt,
    venue: m.venue,
    referee: m.referee,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    homeAssignedInscription: mapPublicSlot(m.homeAssignedInscription),
    awayAssignedInscription: mapPublicSlot(m.awayAssignedInscription),
  };
}

function toEliminationMatchRecord(m: FixtureMatchInput): MatchRecord {
  const rec = matchInputToRecord(m);
  rec.matchCode = bracketDisplayCode(m as TournamentMatchRow);
  rec.matchSubtitle = eliminationMatchSubtitle(m as TournamentMatchRow);
  return rec;
}

export type PublicKnockoutViewData = {
  columns: Array<{ id: string; label: string; matches: MatchRecord[] }>;
  thirdPlaceMatches: MatchRecord[];
};

/** Columnas por ronda (P1…Pn en orden) para la vista pública — sin árbol espejado. */
export function buildPublicKnockoutViewData(stage: TournamentStage): PublicKnockoutViewData | null {
  const all = stage.matches || [];
  const treeRows = all.filter((m) => !isThirdPlaceMatchRow(m));
  const thirdRows = all.filter((m) => isThirdPlaceMatchRow(m));
  if (treeRows.length === 0 && thirdRows.length === 0) return null;

  const built = buildScheduleFromStage({
    format: 'elimination',
    matches: treeRows.map(rowToFixtureInput),
  });

  let columns: PublicKnockoutViewData['columns'] = [];
  if (built?.type === 'knockout') {
    const roundNums = built.data.rounds.map((r) => Number(String(r.id).replace(/^ko-r/, '')) || 0);
    const maxRound = roundNums.length > 0 ? Math.max(...roundNums) : 0;
    columns = built.data.rounds.map((r) => {
      const rn = Number(String(r.id).replace(/^ko-r/, '')) || 0;
      const isFinal = rn === maxRound && r.matches.length <= 2;
      return {
        id: r.id,
        label: isFinal ? 'Final' : r.label,
        matches: r.matches,
      };
    });
  }

  const thirdPlaceMatches = thirdRows.map(rowToFixtureInput).map(toEliminationMatchRecord);

  return { columns, thirdPlaceMatches };
}
