import type { FixtureGroup, Match as FxMatch, Round as FxRound, Team as FxTeam } from '../../components/fixture-viewer/types';
import type { TournamentMatchRow, TournamentStage } from './types';

/** Firma estable del calendario en servidor para resetear borradores locales tras refetch. */
export function stageMatchesSignature(stage: TournamentStage): string {
  const parts: string[] = [];
  const row = (m: TournamentMatchRow) =>
    [
      m.id,
      m.round ?? '',
      m.leg ?? '',
      m.slotIndex ?? '',
      m.scheduledAt ?? '',
      m.homeAssignedInscription?.inscriptionId ?? '',
      m.awayAssignedInscription?.inscriptionId ?? '',
      m.homeScore ?? '',
      m.awayScore ?? '',
      m.status ?? '',
      m.groupId ?? '',
    ].join(':');
  for (const m of stage.matches || []) parts.push(row(m));
  for (const g of stage.groups || []) for (const m of g.matches || []) parts.push(row(m));
  return parts.join('|');
}

function leagueRoundTitle(round: number, leg: number | null | undefined): string {
  if (leg != null && leg > 1) return `Fecha ${round} · vuelta`;
  return `Fecha ${round}`;
}

function eliminationRoundTitle(round: number): string {
  return `Ronda ${round}`;
}

function sortMatchesLeague(list: TournamentMatchRow[]): TournamentMatchRow[] {
  return list.slice().sort((a, b) => {
    const r = (a.round ?? 0) - (b.round ?? 0);
    if (r !== 0) return r;
    const l = (a.leg ?? 0) - (b.leg ?? 0);
    if (l !== 0) return l;
    return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
  });
}

function groupMatchesByRoundKey(matches: TournamentMatchRow[]): Map<string, TournamentMatchRow[]> {
  const map = new Map<string, TournamentMatchRow[]>();
  for (const m of sortMatchesLeague(matches)) {
    const key = `${m.round ?? 0}|${m.leg ?? 1}`;
    const arr = map.get(key) || [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

function roundKeySort(a: string, b: string): number {
  const [r1, l1] = a.split('|').map(Number);
  const [r2, l2] = b.split('|').map(Number);
  if (r1 !== r2) return r1 - r2;
  return l1 - l2;
}

function sortEliminationMatches(list: TournamentMatchRow[]): TournamentMatchRow[] {
  return list.slice().sort((a, b) => {
    const r = (a.round ?? 0) - (b.round ?? 0);
    if (r !== 0) return r;
    const si = (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
    if (si !== 0) return si;
    return (a.leg ?? 0) - (b.leg ?? 0);
  });
}

export function matchRowToFixtureMatch(m: TournamentMatchRow): FxMatch {
  const finished = String(m.status || '').toLowerCase() === 'finished';
  let statusLabel: string | undefined;
  if (finished && m.homeScore != null && m.awayScore != null) {
    statusLabel = `${m.homeScore} – ${m.awayScore}`;
  } else if (finished) {
    statusLabel = 'Finalizado';
  }
  return {
    id: m.id,
    homeTeamId: m.homeAssignedInscription?.inscriptionId ?? null,
    awayTeamId: m.awayAssignedInscription?.inscriptionId ?? null,
    date: m.scheduledAt ?? undefined,
    statusLabel,
    homeScore: m.homeScore != null ? Number(m.homeScore) : undefined,
    awayScore: m.awayScore != null ? Number(m.awayScore) : undefined,
  };
}

/** Inscripciones como opciones de equipo (id = inscriptionId). */
export function collectFixtureTeams(
  stage: TournamentStage,
  badgeUrlByInscriptionId?: Record<string, string> | null
): FxTeam[] {
  const map = new Map<string, FxTeam>();
  const add = (id?: string | null, name?: string | null) => {
    if (!id) return;
    const sid = String(id);
    const badge = badgeUrlByInscriptionId?.[sid];
    if (!map.has(sid))
      map.set(sid, {
        id: sid,
        name: (name || sid).trim() || sid,
        ...(badge ? { badgeUrl: badge } : {}),
      });
    else if (badge) {
      const cur = map.get(sid)!;
      if (!cur.badgeUrl) map.set(sid, { ...cur, badgeUrl: badge });
    }
  };
  for (const ai of stage.assignedInscriptions || []) {
    add(ai.inscriptionId, ai.displayName);
  }
  for (const g of stage.groups || []) {
    for (const ai of g.assignedInscriptions || []) add(ai.inscriptionId, ai.displayName);
  }
  const walk = (matches?: TournamentMatchRow[]) => {
    for (const m of matches || []) {
      add(m.homeAssignedInscription?.inscriptionId, m.homeAssignedInscription?.displayName);
      add(m.awayAssignedInscription?.inscriptionId, m.awayAssignedInscription?.displayName);
    }
  };
  walk(stage.matches);
  for (const g of stage.groups || []) walk(g.matches);
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

export type Liga360FixtureModel =
  | { layout: 'league'; fixture: FxRound[]; teams: FxTeam[] }
  | { layout: 'knockout'; fixture: FxRound[]; teams: FxTeam[] }
  | { layout: 'groups'; groups: FixtureGroup[]; teams: FxTeam[] };

export function buildLiga360FixtureModel(
  stage: TournamentStage,
  badgeUrlByInscriptionId?: Record<string, string> | null
): Liga360FixtureModel | null {
  const teams = collectFixtureTeams(stage, badgeUrlByInscriptionId);

  if (stage.format === 'league') {
    const list = stage.matches || [];
    if (list.length === 0) return null;
    const byRound = groupMatchesByRoundKey(list);
    const keys = Array.from(byRound.keys()).sort(roundKeySort);
    const rounds: FxRound[] = keys.map((key) => {
      const [r, leg] = key.split('|').map(Number);
      const rowMatches = byRound.get(key) || [];
      return {
        id: `lr-${key}`,
        name: leagueRoundTitle(r, leg),
        matches: rowMatches.map(matchRowToFixtureMatch),
      };
    });
    return { layout: 'league', fixture: rounds, teams };
  }

  if (stage.format === 'elimination') {
    const list = stage.matches || [];
    if (list.length === 0) return null;
    const byRound = new Map<number, TournamentMatchRow[]>();
    for (const m of sortEliminationMatches(list)) {
      const r = m.round ?? 1;
      const arr = byRound.get(r) || [];
      arr.push(m);
      byRound.set(r, arr);
    }
    const roundNums = Array.from(byRound.keys()).sort((a, b) => a - b);
    const rounds: FxRound[] = roundNums.map((rn) => ({
      id: `ko-r${rn}`,
      name: eliminationRoundTitle(rn),
      matches: (byRound.get(rn) || []).map(matchRowToFixtureMatch),
    }));
    return { layout: 'knockout', fixture: rounds, teams };
  }

  if (stage.format === 'groups') {
    const groups = (stage.groups || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const outGroups: FixtureGroup[] = [];
    for (const g of groups) {
      const gm = sortMatchesLeague(g.matches || []);
      if (gm.length === 0) {
        outGroups.push({ id: g.id, name: g.name, rounds: [] });
        continue;
      }
      const byRound = groupMatchesByRoundKey(gm);
      const keys = Array.from(byRound.keys()).sort(roundKeySort);
      const rounds: FxRound[] = keys.map((key) => {
        const [r, leg] = key.split('|').map(Number);
        const rowMatches = byRound.get(key) || [];
        return {
          id: `gr-${key}`,
          name: leagueRoundTitle(r, leg),
          matches: rowMatches.map(matchRowToFixtureMatch),
        };
      });
      outGroups.push({ id: g.id, name: g.name, rounds });
    }
    const any = outGroups.some((x) => x.rounds.length > 0);
    if (!any) return null;
    return { layout: 'groups', groups: outGroups, teams };
  }

  return null;
}
