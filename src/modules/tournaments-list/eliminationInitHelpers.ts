import type { TournamentMatchRow } from './types';

/** Misma orden que liga360FixtureAdapter.sortEliminationMatches (round → slotIndex → leg). */
export function sortEliminationInitMatches(list: TournamentMatchRow[]): TournamentMatchRow[] {
  return list.slice().sort((a, b) => {
    const r = (a.round ?? 0) - (b.round ?? 0);
    if (r !== 0) return r;
    const si = (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
    if (si !== 0) return si;
    return (a.leg ?? 0) - (b.leg ?? 0);
  });
}

export type EliminationRoundLegKey = string;

export function eliminationRoundLegSteps(matches: TournamentMatchRow[]): EliminationRoundLegKey[] {
  const sorted = sortEliminationInitMatches(matches);
  const out: EliminationRoundLegKey[] = [];
  const seen = new Set<string>();
  for (const m of sorted) {
    const r = Number(m.round ?? 1);
    // Siempre usamos leg=1 como representante de la ronda; la pierna 2 se auto-asigna en reversa.
    const k = `${r}|1`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function matchesForRoundLeg(
  matches: TournamentMatchRow[],
  key: EliminationRoundLegKey
): TournamentMatchRow[] {
  const [r, lg] = key.split('|').map(Number);
  return sortEliminationInitMatches(matches).filter((m) => (m.round ?? 1) === r && (m.leg ?? 1) === lg);
}

export function matchDisplayCode(m: TournamentMatchRow): string {
  const fc = (m.fixtureCode || '').trim();
  if (fc) return fc;
  const r = m.round ?? 1;
  const si = m.slotIndex ?? 0;
  const leg = m.leg != null && m.leg !== 1 ? `-L${m.leg}` : '';
  return `E${r}-M${si}${leg}`;
}

/** Código compacto tipo `E3M5` / `E3M5L2`; sin guiones como en {@link matchDisplayCode}. */
export function formatCompactEliminationSlot(
  m: Pick<TournamentMatchRow, 'round' | 'slotIndex' | 'leg' | 'fixtureCode'>
): string {
  const fc = (m.fixtureCode || '').trim();
  if (fc) return fc.replace(/-/g, '');
  const r = m.round ?? 1;
  const si = m.slotIndex ?? 0;
  const leg = m.leg != null && m.leg !== 1 ? `L${m.leg}` : '';
  return `E${r}M${si}${leg}`;
}

/** InscriptionIds ocupadas en otros partidos de la misma etapa (excluir un partido opcionalmente). */
export function inscriptionIdsUsedElsewhere(matches: TournamentMatchRow[], excludeMatchId?: string): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    if (excludeMatchId && m.id === excludeMatchId) continue;
    const h = m.homeAssignedInscription?.inscriptionId;
    const aw = m.awayAssignedInscription?.inscriptionId;
    if (h) ids.add(String(h));
    if (aw) ids.add(String(aw));
  }
  return ids;
}

/** Todas las inscripciones (uds. reales o sintéticas) ya colocadas en algún lado de la etapa eliminatoria. */
export function inscriptionIdsAssignedAnywhereInMatches(matches: TournamentMatchRow[]): Set<string> {
  return inscriptionIdsUsedElsewhere(matches, undefined);
}

/**
 * Placeholder de “ganador de esta llave” dentro de la misma etapa (sigue en Neo como inscriptionId textual).
 */
export function buildSameStageWinnerSlotId(stageId: string, matchId: string): string {
  return `liga360-slot:ew:${stageId}:${matchId}`;
}

export function parseSameStageWinnerSlotId(stageId: string, raw: string | null | undefined): string | null {
  const pref = `liga360-slot:ew:${stageId}:`;
  const p = String(raw ?? '').trim();
  if (!p.startsWith(pref)) return null;
  const rest = p.slice(pref.length).trim();
  return rest || null;
}

/**
 * Preview al acortar el bracket: cuántos partidos borraríamos y cuántos ganadores clasificarían
 * desde la última ronda conservada (`lastRoundInclusive`).
 */
export type EliminationTruncatePreview = {
  maxRound: number;
  removableMatchesCount: number;
  /** Una llave por `slotIndex` en la última ronda conservada (dedupe ida/vuelta). */
  clasificatorioLlaveCodes: string[];
};

export function buildEliminationTruncatePreview(
  matches: ReadonlyArray<TournamentMatchRow>,
  lastRoundInclusive: number
): EliminationTruncatePreview {
  let maxR = 1;
  let removable = 0;
  const L = Math.max(1, Math.trunc(lastRoundInclusive));

  const lastRoundMs: TournamentMatchRow[] = [];
  for (const m of matches) {
    const r = Number(m.round ?? 1);
    if (!Number.isFinite(r) || r < 1) continue;
    if (r > maxR) maxR = r;
    if (r > L) removable += 1;
    else if (r === L) lastRoundMs.push(m);
  }

  const sorted = sortEliminationInitMatches(lastRoundMs);
  const seenSlot = new Set<string>();
  const codes: string[] = [];
  for (const mm of sorted) {
    const si = Number(mm.slotIndex ?? 0);
    const k = `${L}|${si}`;
    if (seenSlot.has(k)) continue;
    seenSlot.add(k);
    const r = mm.round ?? 1;
    const slot = mm.slotIndex ?? 0;
    codes.push(`E${r}-M${slot}`);
  }

  return {
    maxRound: maxR,
    removableMatchesCount: removable,
    clasificatorioLlaveCodes: codes,
  };
}
