import type { TournamentStage, TournamentTransition } from './types';

function parseCfg(configJson?: string | null): Record<string, unknown> {
  if (!configJson?.trim()) return {};
  try {
    return JSON.parse(configJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type Trans = Pick<
  TournamentTransition,
  'selectionKind' | 'topN' | 'rangeFrom' | 'rangeTo' | 'bottomN'
>;
type SrcStage = Pick<TournamentStage, 'format' | 'groups' | 'configJson'>;

/**
 * Total de equipos que aporta una transición entrante según formato de etapa origen
 * (p. ej. rango por grupo × cantidad de grupos).
 */
export function countTeamsFromInboundTransition(tr: Trans, fromStage: SrcStage): number {
  const kind = String(tr.selectionKind || 'top').toLowerCase();

  // bestN: picks the N best teams from a given position across all groups (not per-group)
  if (kind === 'bestn') {
    return Number(tr.topN) || 0;
  }
  const cfg = parseCfg(fromStage.configJson ?? null);

  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    const spanPerBracket = Math.max(0, to - from + 1);
    if (String(fromStage.format || '').toLowerCase() === 'groups') {
      const numGroups =
        (fromStage.groups || []).length || Number(cfg.numGroups) || Number(cfg.groupsCount) || 0;
      if (numGroups > 0) return spanPerBracket * numGroups;
    }
    return spanPerBracket;
  }

  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (String(fromStage.format || '').toLowerCase() === 'groups') {
      const numGroups = (fromStage.groups || []).length || Number(cfg.numGroups) || 0;
      const perGroup = Math.min(b, Number(cfg.teamsPerGroup) || b);
      return numGroups > 0 ? numGroups * perGroup : b;
    }
    return b;
  }

  const topN = Number(tr.topN) || 0;
  if (String(fromStage.format || '').toLowerCase() === 'groups') {
    const numGroups = (fromStage.groups || []).length || Number(cfg.numGroups) || 0;
    const teamsPerG = Number(cfg.teamsPerGroup) || 0;
    if (numGroups <= 0) return topN;
    const perGroup = Math.min(topN, teamsPerG || topN);
    return perGroup * numGroups;
  }

  return topN;
}

export function describeInboundSelectionNatural(tr: Trans, fromStage: SrcStage): string {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  if (kind === 'bestn') {
    const n = Number(tr.topN) || 0;
    const pos = Number(tr.rangeFrom) || 0;
    return `mejores ${n} que terminaron ${pos}° en su grupo`;
  }
  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    return String(fromStage.format || '').toLowerCase() === 'groups'
      ? `puestos ${from} a ${to} en cada grupo`
      : `puestos ${from} a ${to} en la tabla`;
  }
  if (kind === 'bottom') {
    const bNumber = Number(tr.bottomN) || 0;
    return String(fromStage.format || '').toLowerCase() === 'groups'
      ? `últimos ${bNumber} por grupo`
      : `últimos ${bNumber} en la tabla`;
  }
  const t = Number(tr.topN) || 0;
  return String(fromStage.format || '').toLowerCase() === 'groups'
    ? `primeros ${t} por grupo`
    : `primeros ${t} en la tabla`;
}
