import {
  bracketDisplayCode,
  eliminationMatchSubtitle,
} from '../../modules/tournaments-list/eliminationInitHelpers';
import type { TournamentMatchRow } from '../../modules/tournaments-list/types';
import type {
  GroupsScheduleData,
  KnockoutScheduleData,
  LeagueScheduleData,
  MatchRecord,
  MatchStatus,
  TeamRef,
} from './types';

/** Misma forma que devuelve GraphQL en configuración / detalle público */
export type FixtureMatchInput = {
  id: string;
  round?: number | null;
  leg?: number | null;
  slotIndex?: number | null;
  fixtureCode?: string | null;
  matchKind?: string | null;
  groupId?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  referee?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Valor crudo del backend (p. ej. `finished`, `scheduled`). */
  status?: string | null;
  homeAssignedInscription?: { inscriptionId: string; displayName: string } | null;
  awayAssignedInscription?: { inscriptionId: string; displayName: string } | null;
};

export type FixtureGroupInput = {
  id: string;
  name: string;
  order: number;
  matches?: FixtureMatchInput[];
};

export type FixtureStageFormat = 'league' | 'groups' | 'elimination' | 'composed';

export type FixtureStageInput = {
  format: FixtureStageFormat;
  matches?: FixtureMatchInput[];
  groups?: FixtureGroupInput[];
};

function mapGraphqlStatusToMatchStatus(raw: string | null | undefined): MatchStatus {
  const s = (raw || '').toLowerCase();
  if (s === 'finished' || s === 'completed') return 'completed';
  if (s === 'live' || s === 'in_progress' || s === 'playing') return 'live';
  if (s === 'postponed' || s === 'delayed') return 'postponed';
  return 'scheduled';
}

function teamFromSlot(
  slot: { inscriptionId: string; displayName: string } | null | undefined,
  side: 'home' | 'away',
  matchId: string,
  isBye = false
): TeamRef {
  if (!slot?.inscriptionId) {
    return isBye
      ? { id: `__bye-${side}-${matchId}`, name: 'Libre' }
      : { id: `__empty-${side}-${matchId}`, name: '—' };
  }
  return {
    id: String(slot.inscriptionId),
    name: (slot.displayName || '—').trim() || '—',
  };
}

function isRealInscriptionId(id: string | null | undefined): boolean {
  const s = String(id ?? '').trim();
  return !!s && !s.startsWith('liga360-slot:') && !s.startsWith('pos:');
}

export function matchInputToRecord(m: FixtureMatchInput, stageFormat?: string | null): MatchRecord {
  const homeId = m.homeAssignedInscription?.inscriptionId;
  const awayId = m.awayAssignedInscription?.inscriptionId;
  const partial =
    (isRealInscriptionId(homeId) && !awayId) ||
    (isRealInscriptionId(awayId) && !homeId);
  const isBye =
    partial &&
    (String(m.matchKind || '').toLowerCase() === 'bye' ||
      String(stageFormat || '').toLowerCase() !== 'elimination');

  const rec: MatchRecord = {
    id: m.id,
    homeTeam: teamFromSlot(m.homeAssignedInscription, 'home', m.id, isBye && !homeId),
    awayTeam: teamFromSlot(m.awayAssignedInscription, 'away', m.id, isBye && !awayId),
    status: mapGraphqlStatusToMatchStatus(m.status),
  };
  if (m.scheduledAt) rec.scheduledAt = m.scheduledAt;
  if (m.venue) rec.venue = m.venue;
  if (m.referee) rec.referee = m.referee;
  if (m.homeScore != null) rec.homeScore = Number(m.homeScore);
  if (m.awayScore != null) rec.awayScore = Number(m.awayScore);
  if (m.leg != null) rec.leg = Number(m.leg);
  if (m.slotIndex != null) rec.slotIndex = Number(m.slotIndex);
  return rec;
}

function eliminationMatchInputToRecord(m: FixtureMatchInput): MatchRecord {
  const rec = matchInputToRecord(m, 'elimination');
  rec.matchCode = bracketDisplayCode(m as TournamentMatchRow);
  rec.matchSubtitle = eliminationMatchSubtitle(m as TournamentMatchRow);
  return rec;
}

function sortMatches(list: FixtureMatchInput[]): FixtureMatchInput[] {
  return list.slice().sort((a, b) => {
    const r = (a.round ?? 0) - (b.round ?? 0);
    if (r !== 0) return r;
    const l = (a.leg ?? 0) - (b.leg ?? 0);
    if (l !== 0) return l;
    return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
  });
}

function groupMatchesByRoundKey(matches: FixtureMatchInput[]): Map<string, FixtureMatchInput[]> {
  const map = new Map<string, FixtureMatchInput[]>();
  for (const m of sortMatches(matches)) {
    const key = `${m.round ?? 0}|${m.leg ?? 1}`;
    const arr = map.get(key) || [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

function leagueRoundTitle(round: number, leg: number | null | undefined): string {
  if (leg != null && leg > 1) return `Fecha ${round} · vuelta`;
  return `Fecha ${round}`;
}

function eliminationRoundTitle(round: number): string {
  return `Ronda ${round}`;
}

function roundKeySort(a: string, b: string): number {
  const [r1, l1] = a.split('|').map(Number);
  const [r2, l2] = b.split('|').map(Number);
  if (r1 !== r2) return r1 - r2;
  return l1 - l2;
}

/** Llave: mismo slot ida y vuelta — ordenar por ronda, slot y luego pierna. */
function sortEliminationMatches(matches: FixtureMatchInput[]): FixtureMatchInput[] {
  return matches.slice().sort((a, b) => {
    const r = (a.round ?? 0) - (b.round ?? 0);
    if (r !== 0) return r;
    const si = (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
    if (si !== 0) return si;
    return (a.leg ?? 0) - (b.leg ?? 0);
  });
}

/**
 * Convierte partidos de una etapa (GraphQL) al modelo de {@link TournamentSchedule}.
 * Devuelve `null` si no hay partidos para mostrar.
 */
export function buildScheduleFromStage(stage: FixtureStageInput):
  | { type: 'league'; data: LeagueScheduleData }
  | { type: 'groups'; data: GroupsScheduleData }
  | { type: 'knockout'; data: KnockoutScheduleData }
  | null {
  if (stage.format === 'league') {
    const list = stage.matches || [];
    if (list.length === 0) return null;
    const byRound = groupMatchesByRoundKey(list);
    const keys = Array.from(byRound.keys()).sort(roundKeySort);
    const rounds = keys.map((key) => {
      const [r, leg] = key.split('|').map(Number);
      const rowMatches = byRound.get(key) || [];
      return {
        id: `lr-${key}`,
        label: leagueRoundTitle(r, leg),
        matches: rowMatches.map((row) => matchInputToRecord(row, 'league')),
      };
    });
    return { type: 'league', data: { rounds } };
  }

  if (stage.format === 'elimination') {
    const list = stage.matches || [];
    if (list.length === 0) return null;
    const byRound = new Map<number, FixtureMatchInput[]>();
    for (const m of sortEliminationMatches(list)) {
      const r = m.round ?? 1;
      const arr = byRound.get(r) || [];
      arr.push(m);
      byRound.set(r, arr);
    }
    const roundNums = Array.from(byRound.keys()).sort((a, b) => a - b);
    const rounds = roundNums.map((rn) => ({
      id: `ko-r${rn}`,
      label: eliminationRoundTitle(rn),
      matches: (byRound.get(rn) || []).map(eliminationMatchInputToRecord),
    }));
    return { type: 'knockout', data: { rounds } };
  }

  if (stage.format === 'groups') {
    const groups = (stage.groups || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const outGroups: GroupsScheduleData['groups'] = [];
    for (const g of groups) {
      const gm = sortMatches(g.matches || []);
      if (gm.length === 0) {
        outGroups.push({ id: g.id, name: g.name, rounds: [] });
        continue;
      }
      const byRound = groupMatchesByRoundKey(gm);
      const keys = Array.from(byRound.keys()).sort(roundKeySort);
      // Mismo id de ronda en todos los grupos para la misma fecha (la UI usa el grupo 0 para las pestañas).
      const rounds = keys.map((key) => {
        const [r, leg] = key.split('|').map(Number);
        const rowMatches = byRound.get(key) || [];
        return {
          id: `gr-${key}`,
          label: leagueRoundTitle(r, leg),
          matches: rowMatches.map((row) => matchInputToRecord(row, 'groups')),
        };
      });
      outGroups.push({ id: g.id, name: g.name, rounds });
    }
    const any = outGroups.some((g) => g.rounds.length > 0);
    if (!any) return null;
    return { type: 'groups', data: { groups: outGroups } };
  }

  return null;
}
