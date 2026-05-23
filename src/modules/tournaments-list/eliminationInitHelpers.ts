import type { TournamentMatchRow, TournamentStage } from './types';

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

export type EliminationMatchParts = {
  round: number;
  slotIndex: number;
  leg: number;
};

/** Parsea códigos P1R2, P1R2-L2 o legacy E2-M1 / E2-M1-L2. */
export function parseEliminationMatchCode(raw: string | null | undefined): EliminationMatchParts | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!s) return null;
  const pNew = /^P(\d+)R(\d+)(?:-L(\d+))?$/i.exec(s);
  if (pNew) {
    return {
      slotIndex: Number(pNew[1]),
      round: Number(pNew[2]),
      leg: pNew[3] ? Number(pNew[3]) : 1,
    };
  }
  const pLegacy = /^E(\d+)-M(\d+)(?:-L(\d+))?$/i.exec(s);
  if (pLegacy) {
    return {
      round: Number(pLegacy[1]),
      slotIndex: Number(pLegacy[2]),
      leg: pLegacy[3] ? Number(pLegacy[3]) : 1,
    };
  }
  return null;
}

export function eliminationMatchPartsFromRow(
  m: Pick<TournamentMatchRow, 'round' | 'slotIndex' | 'leg' | 'fixtureCode'>
): EliminationMatchParts {
  const parsed = parseEliminationMatchCode(m.fixtureCode);
  if (parsed) return parsed;
  return {
    slotIndex: Math.max(1, Math.trunc(Number(m.slotIndex) || 1)),
    round: Math.max(1, Math.trunc(Number(m.round) || 1)),
    leg: Math.max(1, Math.trunc(Number(m.leg) || 1)),
  };
}

/** Config de eliminatoria (espejo de tournaments-svc/bracketElimination.js). */
export type EliminationBracketConfig = {
  matchesPerTie: 'single' | 'double';
  finalMatchesPerTie: 'single' | 'double';
  thirdPlace: boolean;
  numAdvancing: number;
};

export function parseEliminationBracketConfig(
  configJson: string | null | undefined,
  fallbackDouble = false
): EliminationBracketConfig {
  try {
    const c = JSON.parse(configJson || '{}') as Record<string, unknown>;
    const matchesPerTie = c.matchesPerTie === 'double' ? 'double' : c.matchesPerTie === 'single' ? 'single' : fallbackDouble ? 'double' : 'single';
    const finalMatchesPerTie =
      c.finalMatchesPerTie === 'double' ? 'double' : c.finalMatchesPerTie === 'single' ? 'single' : matchesPerTie === 'double' ? 'single' : 'single';
    const thirdPlace = c.thirdPlace === 'yes';
    const numAdvancingRaw = Number(c.numAdvancing);
    const numAdvancing = Number.isInteger(numAdvancingRaw) && numAdvancingRaw > 0 ? numAdvancingRaw : 1;
    return { matchesPerTie, finalMatchesPerTie, thirdPlace, numAdvancing };
  } catch {
    return {
      matchesPerTie: fallbackDouble ? 'double' : 'single',
      finalMatchesPerTie: fallbackDouble ? 'double' : 'single',
      thirdPlace: false,
      numAdvancing: 1,
    };
  }
}

export function eliminationMaxRoundFromMatches(matches: TournamentMatchRow[]): number {
  let max = 0;
  for (const m of matches) {
    if (isThirdPlaceMatchRow(m)) continue;
    max = Math.max(max, Number(m.round ?? 0));
  }
  return max;
}

export function isThirdPlaceMatchRow(m: Pick<TournamentMatchRow, 'matchKind' | 'slotIndex' | 'fixtureCode'>): boolean {
  const kind = String(m.matchKind ?? '').toLowerCase();
  if (kind === 'third_place') return true;
  const fc = String(m.fixtureCode ?? '').trim().toUpperCase();
  return Number(m.slotIndex) === 0 && (fc === '3P' || fc.startsWith('3P-'));
}

export function isEliminationSlotDoubleLeg(
  round: number,
  maxRound: number,
  cfg: EliminationBracketConfig
): boolean {
  const r = Math.max(1, Math.trunc(Number(round) || 1));
  const maxR = Math.max(1, Math.trunc(Number(maxRound) || 1));
  if (r === maxR) return cfg.finalMatchesPerTie === 'double';
  return cfg.matchesPerTie === 'double';
}

/** Código canónico P{partido}R{ronda}; opcional sufijo -L{n} para pierna > 1. */
export function buildEliminationPxRxCode(
  parts: Pick<EliminationMatchParts, 'round' | 'slotIndex'> & { leg?: number | null },
  options?: { includeLegSuffix?: boolean }
): string {
  const si = Math.max(1, Math.trunc(Number(parts.slotIndex) || 1));
  const r = Math.max(1, Math.trunc(Number(parts.round) || 1));
  const base = `P${si}R${r}`;
  const leg = Math.trunc(Number(parts.leg) || 1);
  if (options?.includeLegSuffix && leg > 1) return `${base}-L${leg}`;
  return base;
}

export function matchDisplayCode(m: TournamentMatchRow): string {
  const parts = eliminationMatchPartsFromRow(m);
  return buildEliminationPxRxCode(parts, { includeLegSuffix: true });
}

/** Código de llave (slot) sin sufijo de pierna — para mostrar el ID del enfrentamiento, no de la pierna individual. */
export function bracketDisplayCode(m: TournamentMatchRow): string {
  if (isThirdPlaceMatchRow(m)) return '3P';
  const parts = eliminationMatchPartsFromRow(m);
  return buildEliminationPxRxCode(parts, { includeLegSuffix: false });
}

/** Subtítulo legible alineado con la nomenclatura P{n}R{m}. */
export function eliminationMatchSubtitle(
  m: Pick<TournamentMatchRow, 'round' | 'slotIndex' | 'fixtureCode' | 'matchKind'>
): string {
  if (isThirdPlaceMatchRow(m)) return 'Tercer puesto';
  const { slotIndex, round } = eliminationMatchPartsFromRow(m);
  return `Partido ${slotIndex} · Ronda ${round}`;
}

/** Código compacto tipo `P3R2` / `P3R2L2`; sin guiones como en {@link matchDisplayCode}. */
export function formatCompactEliminationSlot(
  m: Pick<TournamentMatchRow, 'round' | 'slotIndex' | 'leg' | 'fixtureCode'>
): string {
  return matchDisplayCode({ ...m, id: '' } as TournamentMatchRow).replace(/-/g, '');
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

type PoolEligibleRef = {
  inscriptionId: string;
  resolvedRealId?: string;
};

/**
 * Expande IDs asignados en partidos (a menudo resueltos a equipo real) a los IDs del pool
 * (`pos:`, `liga360-slot:`, etc.) para excluir opciones ya usadas en el selector.
 */
export function expandAssignedIdsForPool(
  assignedRaw: ReadonlySet<string>,
  eligibleFromTables: ReadonlyArray<PoolEligibleRef>
): Set<string> {
  const out = new Set<string>();
  for (const id of assignedRaw) {
    const s = String(id || '').trim();
    if (s) out.add(s);
  }

  const realToPool = new Map<string, string[]>();
  for (const el of eligibleFromTables) {
    const poolId = String(el.inscriptionId || '').trim();
    const realId = String(el.resolvedRealId ?? '').trim();
    if (!poolId || !realId) continue;
    const list = realToPool.get(realId) ?? [];
    list.push(poolId);
    realToPool.set(realId, list);
  }

  for (const id of out) {
    const pools = realToPool.get(id);
    if (pools) pools.forEach((p) => out.add(p));
  }

  for (const el of eligibleFromTables) {
    const poolId = String(el.inscriptionId || '').trim();
    if (!poolId || !assignedRaw.has(poolId)) continue;
    out.add(poolId);
    const realId = String(el.resolvedRealId ?? '').trim();
    if (realId) out.add(realId);
  }

  return out;
}

export function buildPoolExclusionSet(
  matches: TournamentMatchRow[],
  eligibleFromTables: ReadonlyArray<PoolEligibleRef>
): Set<string> {
  return expandAssignedIdsForPool(inscriptionIdsAssignedAnywhereInMatches(matches), eligibleFromTables);
}

/**
 * Placeholder de “ganador de esta llave” dentro de la misma etapa (sigue en Neo como inscriptionId textual).
 */
export function buildSameStageWinnerSlotId(stageId: string, matchId: string): string {
  return `liga360-slot:ew:${stageId}:${matchId}`;
}

/** Etiqueta de ganador de llave; incluye etapa origen cuando está disponible. */
export function formatWinnerSlotLabel(
  m: Pick<TournamentMatchRow, 'round' | 'slotIndex'>,
  stageName?: string | null
): string {
  const si = Number(m.slotIndex ?? 0);
  const stage = String(stageName || '').trim();
  if (stage) return `Ganador Partido ${si} - ${stage}`;
  const r = Number(m.round ?? 1);
  return `Ganador · Partido ${si} · Ronda ${r}`;
}

export function parseAnyStageWinnerSlotId(
  raw: string | null | undefined
): { stageId: string; matchId: string } | null {
  const p = String(raw ?? '').trim();
  if (!p.startsWith('liga360-slot:ew:')) return null;
  const rest = p.slice('liga360-slot:ew:'.length);
  const idx = rest.indexOf(':');
  if (idx <= 0) return null;
  const stageId = rest.slice(0, idx);
  const matchId = rest.slice(idx + 1).trim();
  if (!stageId || !matchId) return null;
  return { stageId, matchId };
}

export function findTournamentMatchById(
  tournament: { competitions?: Array<{ stages?: TournamentStage[] }> },
  matchId: string
): { stageId: string; stageName: string; match: TournamentMatchRow } | null {
  for (const c of tournament.competitions || []) {
    for (const s of c.stages || []) {
      const m = (s.matches || []).find((x) => x.id === matchId);
      if (m) {
        return {
          stageId: s.id,
          stageName: String(s.name || '').trim() || 'Etapa',
          match: m,
        };
      }
    }
  }
  return null;
}

/** Etiqueta legible para un ref `liga360-slot:ew:{stageId}:{matchId}` de cualquier etapa. */
export function resolveWinnerSlotLabelFromRef(
  tournament: { competitions?: Array<{ stages?: TournamentStage[] }> },
  rawId: string | null | undefined
): string | null {
  const parsed = parseAnyStageWinnerSlotId(rawId);
  if (!parsed) return null;
  const found = findTournamentMatchById(tournament, parsed.matchId);
  if (!found || found.stageId !== parsed.stageId) return null;
  return formatWinnerSlotLabel(found.match, found.stageName);
}

export function parseSameStageWinnerSlotId(stageId: string, raw: string | null | undefined): string | null {
  const parsed = parseAnyStageWinnerSlotId(raw);
  if (!parsed || parsed.stageId !== stageId) return null;
  return parsed.matchId || null;
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
    codes.push(bracketDisplayCode(mm));
  }

  return {
    maxRound: maxR,
    removableMatchesCount: removable,
    clasificatorioLlaveCodes: codes,
  };
}

/**
 * Ronda cuya llave alimenta la etapa siguiente según numParticipants / numAdvancing
 * (misma fórmula que generateSingleEliminationBracket en tournaments-svc).
 */
export function computeEliminationFeedingRound(
  numParticipants: number,
  numAdvancing: number
): number | null {
  const P = Math.max(2, Math.trunc(Number(numParticipants) || 0));
  const adv = Math.max(1, Math.trunc(Number(numAdvancing) || 0));
  if (adv <= 1 || adv >= P) return null;
  const ratio = P / adv;
  if (ratio <= 1) return null;
  const maxRounds = Math.round(Math.log2(ratio));
  return maxRounds >= 1 ? maxRounds : null;
}

/** Una fila por serie (round + slotIndex); preferir pierna 1 en ida y vuelta. */
export function dedupeEliminationSeriesMatches(matches: TournamentMatchRow[]): TournamentMatchRow[] {
  const sorted = sortEliminationInitMatches(matches);
  const byKey = new Map<string, TournamentMatchRow>();
  for (const m of sorted) {
    const r = Number(m.round ?? 1);
    const si = Number(m.slotIndex ?? 0);
    const key = `${r}|${si}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, m);
      continue;
    }
    const legExisting = Number(existing.leg ?? 1);
    const legNew = Number(m.leg ?? 1);
    if (legNew === 1 && legExisting !== 1) byKey.set(key, m);
  }
  return sortEliminationInitMatches([...byKey.values()]);
}
