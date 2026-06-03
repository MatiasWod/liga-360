import type { Match, Round } from './types';

function cloneRounds(rounds: Round[]): Round[] {
  return rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));
}

export function genMatchId(): string {
  return `fx-m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function genRoundId(): string {
  return `fx-r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function findRoundContainingMatch(rounds: Round[], matchId: string): { roundIndex: number; matchIndex: number } | null {
  for (let ri = 0; ri < rounds.length; ri++) {
    const mi = rounds[ri].matches.findIndex((m) => m.id === matchId);
    if (mi >= 0) return { roundIndex: ri, matchIndex: mi };
  }
  return null;
}

/** `overId` es id de partido o `round-tail-${roundId}` */
export function resolveDropTarget(
  rounds: Round[],
  overId: string
): { roundIndex: number; insertIndex: number } | null {
  if (overId.startsWith('round-tail-')) {
    const rid = overId.slice('round-tail-'.length);
    const ri = rounds.findIndex((r) => r.id === rid);
    if (ri < 0) return null;
    return { roundIndex: ri, insertIndex: rounds[ri].matches.length };
  }
  const found = findRoundContainingMatch(rounds, overId);
  if (!found) return null;
  return { roundIndex: found.roundIndex, insertIndex: found.matchIndex };
}

/** Mueve un partido a otra fecha/ronda (al final de la lista destino). */
export function moveMatchToRound(rounds: Round[], matchId: string, targetRoundId: string): Round[] {
  const next = cloneRounds(rounds);
  const from = findRoundContainingMatch(next, matchId);
  if (!from) return rounds;
  const destRi = next.findIndex((r) => r.id === targetRoundId);
  if (destRi < 0 || destRi === from.roundIndex) return rounds;
  const [removed] = next[from.roundIndex].matches.splice(from.matchIndex, 1);
  if (!removed) return rounds;
  next[destRi].matches.push(removed);
  return next;
}

export function moveMatch(rounds: Round[], activeMatchId: string, overId: string): Round[] {
  const next = cloneRounds(rounds);
  const from = findRoundContainingMatch(next, activeMatchId);
  const to = resolveDropTarget(next, overId);
  if (!from || !to) return rounds;

  const [removed] = next[from.roundIndex].matches.splice(from.matchIndex, 1);
  if (!removed) return rounds;

  let { roundIndex: destRi, insertIndex: destMi } = to;

  if (from.roundIndex === destRi && from.matchIndex < destMi) {
    destMi -= 1;
  }

  next[destRi].matches.splice(destMi, 0, removed);
  return next;
}

export function reorderWithinRound(rounds: Round[], roundId: string, activeId: string, overId: string): Round[] {
  const next = cloneRounds(rounds);
  const ri = next.findIndex((r) => r.id === roundId);
  if (ri < 0) return rounds;
  const list = next[ri].matches;
  const oldIndex = list.findIndex((m) => m.id === activeId);
  const newIndex = list.findIndex((m) => m.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return rounds;
  const [item] = list.splice(oldIndex, 1);
  list.splice(newIndex, 0, item);
  return next;
}

export function addEmptyMatch(rounds: Round[], roundId: string): Round[] {
  const next = cloneRounds(rounds);
  const r = next.find((x) => x.id === roundId);
  if (!r) return rounds;
  r.matches.push({
    id: genMatchId(),
    homeTeamId: null,
    awayTeamId: null,
  });
  return next;
}

export function removeMatch(rounds: Round[], matchId: string): Round[] {
  const next = cloneRounds(rounds);
  for (const r of next) {
    const i = r.matches.findIndex((m) => m.id === matchId);
    if (i >= 0) {
      r.matches.splice(i, 1);
      break;
    }
  }
  return next;
}

export function addRound(rounds: Round[], name?: string): Round[] {
  const n = rounds.length + 1;
  return [
    ...cloneRounds(rounds),
    {
      id: genRoundId(),
      name: name ?? `Fecha ${n}`,
      matches: [],
    },
  ];
}

export function updateMatch(rounds: Round[], matchId: string, patch: Partial<Match>): Round[] {
  const next = cloneRounds(rounds);
  for (const r of next) {
    const m = r.matches.find((x) => x.id === matchId);
    if (m) {
      Object.assign(m, patch);
      break;
    }
  }
  return next;
}
