import {
  bracketDisplayCode,
  buildSameStageWinnerSlotId,
  computeEliminationFeedingRound,
  dedupeEliminationSeriesMatches,
  formatCompactEliminationSlot,
  formatWinnerSlotLabel,
  sortEliminationInitMatches,
} from './eliminationInitHelpers';
import type {
  StandingsRow,
  TournamentEntity,
  TournamentStage,
  TournamentTransition,
  TournamentMatchRow,
} from './types';
import { countTeamsFromInboundTransition } from './transitionInboundCounts';

export type EligibleInscriptionSource = 'groups' | 'league' | 'elimination';

export type EligibleInscription = {
  inscriptionId: string;
  displayName: string;
  optionLabel: string;
  shortLabel: string;
  sectionTitle: string;
  source: EligibleInscriptionSource;
  /** Código legible del partido (fixture o E2-M1) para huecos eliminatorios sintéticos */
  eliminationMatchLabel?: string;
  /** Origen grupo + posición (fase grupos): nombre de grupo y puesto esperado */
  groupsOrigin?: { groupName: string; position: number };
  /**
   * ID real de inscripción resuelto desde la tabla de posiciones (ej: "42").
   * Cuando el backend resuelve el ref sintético pos:l: al devolver los partidos,
   * el frontend puede usarlo para deduplicar y mostrar la etiqueta de posición correcta.
   */
  resolvedRealId?: string;
};

type StageTrans = TournamentTransition;

/** Línea fija torneo · competición · nombre de etapa origen (sin “desde X”). */
function lineageTriple(
  tournamentName: string,
  competitionName: string,
  stageName: string
): string {
  return [String(tournamentName || '').trim(), String(competitionName || '').trim(), String(stageName || '').trim()]
    .filter(Boolean)
    .join(' · ');
}

/** Título estable para agrupaciones (torneo · competición · etapa · pista opcional). */
export function buildSectionTitle(
  tournamentName: string,
  competitionName: string,
  stageName: string,
  hint?: string | null
): string {
  const parts = [
    String(tournamentName || '').trim(),
    String(competitionName || '').trim(),
    String(stageName || '').trim(),
    hint != null ? String(hint || '').trim() : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function sortStandingsByPosition(rows: StandingsRow[]): StandingsRow[] {
  return [...(rows || [])].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
}

/** Misma lógica conceptual que en TournamentConfiguration.collectIncomingTransitions */
export function collectIncomingTransitionRows(
  tournament: TournamentEntity | null,
  targetStageId: string
): Array<{ fromStage: TournamentStage; tr: StageTrans; fromCompetitionName: string }> {
  const out: Array<{ fromStage: TournamentStage; tr: StageTrans; fromCompetitionName: string }> = [];
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      for (const tr of s.transitions || []) {
        if (String(tr.toStageId || '') === targetStageId) {
          out.push({ fromStage: s, tr, fromCompetitionName: c.name });
        }
      }
    }
  }
  out.sort((a, b) => {
    const o = Number(a.fromStage.order || 0) - Number(b.fromStage.order || 0);
    if (o !== 0) return o;
    return String(a.fromStage.name || '').localeCompare(String(b.fromStage.name || ''), 'es', { sensitivity: 'base' });
  });
  return out;
}

function pickFromGroupStandingsBySelection(standings: StandingsRow[], tr: StageTrans): StandingsRow[] {
  const sorted = sortStandingsByPosition(standings);
  const kind = String(tr.selectionKind || 'top').toLowerCase();

  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    return sorted.filter((row) => {
      const pos = Number(row.position ?? 0);
      return pos >= from && pos <= to;
    });
  }

  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (b <= 0) return [];
    const perGroup = Math.min(b, sorted.length);
    return sorted.slice(-perGroup);
  }

  const topN = Number(tr.topN) || 0;
  if (topN <= 0) return [];
  const cap = Math.min(topN, sorted.length);
  return sorted.slice(0, cap);
}

function leagueStandingsSelection(fromStage: TournamentStage, tr: StageTrans): StandingsRow[] {
  const sorted = sortStandingsByPosition(fromStage.standings || []);
  const kind = String(tr.selectionKind || 'top').toLowerCase();

  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    return sorted.filter((row) => {
      const pos = Number(row.position ?? 0);
      return pos >= from && pos <= to;
    });
  }

  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (b <= 0) return [];
    const per = Math.min(b, sorted.length);
    return sorted.slice(-per);
  }

  const topN = Number(tr.topN) || 0;
  if (topN <= 0) return [];
  return sorted.slice(0, Math.min(topN, sorted.length));
}

function parseStageConfig(stage: TournamentStage): {
  teamsPerGroup?: number;
  numParticipants?: number;
  numAdvancing?: number;
} {
  try {
    const cfg = JSON.parse(String(stage.configJson || '{}'));
    const teamsPerGroup = Number(cfg?.teamsPerGroup);
    const numParticipants = Number(cfg?.numParticipants);
    const numAdvancing = Number(cfg?.numAdvancing);
    return {
      teamsPerGroup: Number.isFinite(teamsPerGroup) && teamsPerGroup > 0 ? teamsPerGroup : undefined,
      numParticipants:
        Number.isFinite(numParticipants) && numParticipants > 0 ? numParticipants : undefined,
      numAdvancing:
        Number.isFinite(numAdvancing) && numAdvancing > 0 ? numAdvancing : undefined,
    };
  } catch {
    return {};
  }
}

function standingsByDistinctPosition(rows: StandingsRow[]): Map<number, StandingsRow> {
  const sorted = sortStandingsByPosition(rows);
  const m = new Map<number, StandingsRow>();
  for (const row of sorted) {
    const p = Math.trunc(Number(row.position ?? 0));
    if (p > 0 && !m.has(p)) m.set(p, row);
  }
  return m;
}

function effectiveLeagueSize(fromStage: TournamentStage): number | null {
  const cfg = parseStageConfig(fromStage);
  if (cfg.numParticipants) return cfg.numParticipants;
  const rows = fromStage.standings || [];
  let maxPos = 0;
  for (const r of rows) {
    const p = Math.trunc(Number(r.position ?? 0));
    if (p > maxPos) maxPos = p;
  }
  if (maxPos > 0) return maxPos;
  return null;
}

function effectiveTeamsPerGroup(
  group: { capacity?: number | null },
  stageCfg: { teamsPerGroup?: number }
): number | null {
  const c = Number(group.capacity);
  if (Number.isFinite(c) && c > 0) return Math.trunc(c);
  const t = stageCfg.teamsPerGroup;
  if (t != null && Number.isFinite(t) && t > 0) return Math.trunc(t);
  return null;
}

/**
 * Posiciones (1-based) que cubre la transición, para poder ofrecer plazas aunque no haya filas en tablas.
 * top/bottom requieren tamaño conocido (config o capacity); range solo usa rango numérico.
 */
function rankPositionsForIncomingSelection(tr: StageTrans, _mode: 'groups' | 'league', size: number | null): number[] {
  const kind = String(tr.selectionKind || 'top').toLowerCase();

  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    if (from <= 0 || to < from) return [];
    const out: number[] = [];
    for (let p = from; p <= to; p++) out.push(p);
    return out;
  }

  if (!size || size <= 0) return [];

  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (b <= 0) return [];
    const take = Math.min(b, size);
    const out: number[] = [];
    const start = size - take + 1;
    for (let p = start; p <= size; p++) out.push(p);
    return out;
  }

  const topN = Number(tr.topN) || 0;
  if (topN <= 0) return [];
  const cap = Math.min(topN, size);
  const out: number[] = [];
  for (let p = 1; p <= cap; p++) out.push(p);
  return out;
}

function buildSyntheticGroupSlotId(
  fromStageId: string,
  trId: string,
  groupId: string,
  position: number
): string {
  return `liga360-slot:sg:${fromStageId}:${trId}:${groupId}:${position}`;
}

function buildSyntheticLeagueSlotId(fromStageId: string, trId: string, position: number): string {
  return `liga360-slot:lg:${fromStageId}:${trId}:${position}`;
}

function isSyntheticEligibleId(raw: string): boolean {
  return String(raw || '').startsWith('liga360-slot:');
}

/** Placeholders grupos/liga si aún no hay equipo: «NombreDeFase ×1», ×2 … */
function syntheticPlaceholderLabel(stageLabel: string, ordinalInBatch: number): string {
  const name = String(stageLabel || '').trim() || 'Etapa';
  const k = Math.max(1, Math.trunc(Number(ordinalInBatch)));
  return `${name} ×${k}`;
}

function onlyHighestEliminationRound(matches: TournamentMatchRow[]): TournamentMatchRow[] {
  if (!matches?.length) return [];
  const maxR = Math.max(...matches.map((m) => Number(m.round ?? 1)));
  return matches.filter((m) => Number(m.round ?? 1) === maxR);
}

/**
 * Máximo N filas por transición; primero equipos conocidos, luego pendientes.
 * Eliminación: llave/código; grupos sintéticos: grupo + posición sin ×k genéricos.
 */
function finalizeEligibleRowsForQuota(rows: EligibleInscription[], quota: number, placeholderStageLabel: string, lineageForSynthOption: string): EligibleInscription[] {
  const cap = Math.max(0, Math.trunc(quota));
  if (cap === 0 || rows.length === 0) return [];

  const real = rows.filter((r) => !isSyntheticEligibleId(r.inscriptionId));
  const synth = rows.filter((r) => isSyntheticEligibleId(r.inscriptionId));
  const combined = [...real, ...synth].slice(0, cap);

  let synthIx = 0;
  const out: EligibleInscription[] = [];
  for (const r of combined) {
    if (!isSyntheticEligibleId(r.inscriptionId)) {
      const go = r.groupsOrigin;
      if (go && r.source === 'groups') {
        const dn = String(r.displayName || '').trim() || '';
        out.push({
          ...r,
          optionLabel: `${lineageForSynthOption} · ${go.groupName} · posición ${go.position} · ${dn}`,
        });
      } else {
        out.push(r);
      }
      continue;
    }

    const structural = String(r.shortLabel || '').trim() || '?';

    if (r.source === 'elimination') {
      const hint = String(r.eliminationMatchLabel || '').trim();
      const code = hint || structural;
      const displayName =
        String(r.displayName || '').trim() || `${placeholderStageLabel} · ${code} · Ganador`;
      out.push({
        ...r,
        displayName,
        shortLabel: structural,
        eliminationMatchLabel: hint || code,
        optionLabel:
          String(r.optionLabel || '').trim() ||
          `${lineageForSynthOption} · ${code} · Ganador · sin asignar`,
      });
      continue;
    }

    if (r.source === 'groups' && r.groupsOrigin) {
      const go = r.groupsOrigin;
      const displayName = `${go.groupName} · posición ${go.position}`;
      out.push({
        ...r,
        displayName,
        shortLabel: structural,
        groupsOrigin: go,
        optionLabel: `${lineageForSynthOption} · ${displayName} · sin asignar`,
      });
      continue;
    }

    synthIx += 1;
    const ph = syntheticPlaceholderLabel(placeholderStageLabel, synthIx);
    out.push({
      ...r,
      displayName: ph,
      shortLabel: `×${synthIx}`,
      optionLabel: `${lineageForSynthOption} · ${structural} · ${ph} · sin asignar`,
    });
  }
  return out;
}

/** Partidos de eliminatoria que alimentan `tr` (ronda exportadora según numAdvancing o última ronda). */
function eliminationMatchesForIncomingTransition(fromStage: TournamentStage, tr: StageTrans): TournamentMatchRow[] {
  const tid = String(tr.id || '').trim();
  const poolSorted = sortEliminationInitMatches(fromStage.matches || []);

  const strict = poolSorted.filter((m) => tid && String(m.winnerAdvancementTransitionId || '') === tid);
  if (strict.length > 0) return dedupeEliminationSeriesMatches(strict);

  const loose = poolSorted.filter((m) => {
    const wid = String(m.winnerAdvancementTransitionId || '').trim();
    return !wid || wid === tid;
  });

  const stageCfg = parseStageConfig(fromStage);
  const feedingRound =
    stageCfg.numParticipants != null && stageCfg.numAdvancing != null
      ? computeEliminationFeedingRound(stageCfg.numParticipants, stageCfg.numAdvancing)
      : null;

  if (feedingRound != null && feedingRound >= 1) {
    return dedupeEliminationSeriesMatches(
      loose.filter((m) => Number(m.round ?? 1) === feedingRound)
    );
  }

  return dedupeEliminationSeriesMatches(onlyHighestEliminationRound(loose));
}

/**
 * Inscripciones que las transiciones entrantes + tablas disponibles sugieren elegibles para el stage destino
 * (p. ej. puestos 9–16 en cada grupo clasificando a repechaje).
 */
export function deriveEligibleInscriptionsFromIncomingTransitions(
  tournament: TournamentEntity | null,
  targetStageId: string
): EligibleInscription[] {
  const incoming = collectIncomingTransitionRows(tournament, targetStageId);
  const byId = new Map<string, EligibleInscription>();

  const tournamentLabel = String(tournament?.name || '').trim() || 'Torneo';

  function upsertEligible(payload: Omit<EligibleInscription, never>) {
    const id = String(payload.inscriptionId || '').trim();
    if (!id) return;
    const dn = String(payload.displayName || '').trim() || id;
    const lbl = String(payload.optionLabel || '').trim() || `${payload.shortLabel} · ${dn}`;
    if (!byId.has(id)) {
      byId.set(id, {
        inscriptionId: id,
        displayName: dn,
        shortLabel: payload.shortLabel,
        sectionTitle: payload.sectionTitle,
        source: payload.source,
        optionLabel: lbl,
        ...(payload.resolvedRealId ? { resolvedRealId: payload.resolvedRealId } : {}),
        ...(payload.eliminationMatchLabel != null && payload.eliminationMatchLabel !== ''
          ? { eliminationMatchLabel: payload.eliminationMatchLabel }
          : {}),
        ...(payload.groupsOrigin != null ? { groupsOrigin: payload.groupsOrigin } : {}),
      });
    }
  }

  for (const { fromStage, tr, fromCompetitionName } of incoming) {
    const fmt = String(fromStage.format || '').toLowerCase();
    const stageLabel = String(fromStage.name || '').trim() || 'Etapa';
    const lineage = lineageTriple(tournamentLabel, fromCompetitionName, stageLabel);
    const quota = countTeamsFromInboundTransition(tr, fromStage);

    if (fmt === 'groups') {
      const sectionTitle = buildSectionTitle(tournamentLabel, fromCompetitionName, stageLabel, 'desde grupos');
      const stageCfg = parseStageConfig(fromStage);
      const groups = [...(fromStage.groups || [])].sort(
        (a, b) => Number(a.order || 0) - Number(b.order || 0)
      );
      const pendingLabel = 'Clasificación pendiente';

      if (String(tr.selectionKind || '').toLowerCase() === 'bestn') {
        const count = Number(tr.topN) || 0;       // N (ej: 8)
        const fromPos = Number(tr.rangeFrom) || 0; // M (ej: 3)
        if (count > 0 && fromPos > 0) {
          // Recolectar el equipo en posición M de cada grupo y rankearlos globalmente
          const candidates: Array<{ inscriptionId: string; displayName: string; points: number; goalDifference: number; goalsFor: number }> = [];
          for (const g of groups) {
            const byPos = standingsByDistinctPosition(g.standings || []);
            const row = byPos.get(fromPos);
            if (row) {
              const id = String(row.inscriptionId ?? '').trim();
              if (id) candidates.push({ inscriptionId: id, displayName: String(row.displayName || id).trim(), points: Number(row.points ?? 0), goalDifference: Number(row.goalDifference ?? 0), goalsFor: Number(row.goalsFor ?? 0) });
            }
          }
          // Mismo criterio de ordenamiento que el backend: pts → dif goles → goles a favor
          candidates.sort((a, b) => b.points !== a.points ? b.points - a.points : b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference : b.goalsFor - a.goalsFor);

          for (let rank = 1; rank <= count; rank++) {
            const candidate = candidates[rank - 1];
            const rankLabel = `${rank}° mejor ${fromPos}° entre grupos`;
            if (candidate) {
              upsertEligible({ inscriptionId: candidate.inscriptionId, displayName: candidate.displayName, sectionTitle, shortLabel: `BN${rank}`, source: 'groups', optionLabel: `${lineage} · ${rankLabel} · ${candidate.displayName}` });
            } else {
              upsertEligible({ inscriptionId: `pos:bestN:${fromStage.id}:${fromPos}:${count}:${rank}`, displayName: rankLabel, sectionTitle, shortLabel: `BN${rank}`, source: 'groups', optionLabel: `${lineage} · ${rankLabel} · ${pendingLabel}` });
            }
          }
        }
        continue;
      }

      const bucket: EligibleInscription[] = [];

      for (let gi = 0; gi < groups.length; gi++) {
        const gIdx = gi + 1;
        const g = groups[gi];
        const groupHumanName = String(g.name || '').trim() || `Grupo ${gIdx}`;
        const tpgEff = effectiveTeamsPerGroup(g, stageCfg);
        const positions = rankPositionsForIncomingSelection(tr, 'groups', tpgEff);
        const byPos = standingsByDistinctPosition(g.standings || []);

        if (positions.length > 0) {
          for (const pos of positions) {
            const row = byPos.get(pos);
            const resolvedName = row ? (String(row?.displayName || '').trim() || '') : '';
            const resolvedId = row ? (String(row?.inscriptionId || '').trim() || '') : '';
            const posTxt = String(pos);
            const shortLabel = `P${posTxt}G${gIdx}`;
            const posNum = Math.trunc(Number(pos)) || Number(posTxt) || 0;
            const go = { groupName: groupHumanName, position: posNum };
            // Siempre emitir referencia de posición (pos:sg:); el nombre resuelto va solo en displayName
            bucket.push({
              inscriptionId: `pos:sg:${fromStage.id}:${g.id}:${pos}`,
              ...(resolvedId ? { resolvedRealId: resolvedId } : {}),
              displayName: resolvedName || pendingLabel,
              sectionTitle,
              shortLabel,
              source: 'groups',
              groupsOrigin: go,
              optionLabel: resolvedName
                ? `${lineage} · ${shortLabel} · ${resolvedName}`
                : `${lineage} · ${shortLabel} · ${pendingLabel}`,
            });
          }
        } else {
          for (const row of pickFromGroupStandingsBySelection(g.standings || [], tr)) {
            const id = String(row.inscriptionId ?? '').trim();
            if (!id) continue;
            const pos = Number(row.position ?? 0);
            const dn = String(row.displayName || '').trim() || id;
            const posTxt = Number.isFinite(pos) && pos > 0 ? String(Math.trunc(pos)) : '?';
            const shortLabel = `P${posTxt}G${gIdx}`;
            const placementPos = Math.trunc(Number(row.position ?? 0)) || 0;
            const go = { groupName: groupHumanName, position: placementPos };
            bucket.push({
              inscriptionId: id,
              displayName: dn,
              sectionTitle,
              shortLabel,
              source: 'groups',
              groupsOrigin: go,
              optionLabel: `${lineage} · ${shortLabel} · ${dn}`,
            });
          }
        }
      }
      for (const row of finalizeEligibleRowsForQuota(bucket, quota, stageLabel, lineage)) {
        upsertEligible(row);
      }
      continue;
    }

    if (fmt === 'league') {
      const sectionTitle = buildSectionTitle(tournamentLabel, fromCompetitionName, stageLabel, 'desde liga');
      const leagueSize = effectiveLeagueSize(fromStage);
      const positions = rankPositionsForIncomingSelection(tr, 'league', leagueSize);
      const pendingLabel = 'Clasificación pendiente';
      const byPos = standingsByDistinctPosition(fromStage.standings || []);
      const bucket: EligibleInscription[] = [];

      if (positions.length > 0) {
        for (const pos of positions) {
          const row = byPos.get(pos);
          const resolvedName = row ? (String(row?.displayName || '').trim() || '') : '';
          const resolvedId = row ? (String(row?.inscriptionId || '').trim() || '') : '';
          const posTxt = String(pos);
          const shortLabel = `P${posTxt}`;
          // Siempre emitir referencia de posición (pos:l:); el nombre resuelto va solo en displayName
          bucket.push({
            inscriptionId: `pos:l:${fromStage.id}:${pos}`,
            ...(resolvedId ? { resolvedRealId: resolvedId } : {}),
            displayName: resolvedName || pendingLabel,
            sectionTitle,
            shortLabel,
            source: 'league',
            optionLabel: resolvedName
              ? `${lineage} · tabla general ${shortLabel} · ${resolvedName}`
              : `${lineage} · tabla general ${shortLabel} · ${pendingLabel}`,
          });
        }
      }
      for (const row of finalizeEligibleRowsForQuota(bucket, quota, stageLabel, lineage)) {
        upsertEligible(row);
      }
      continue;
    }

    if (fmt === 'elimination') {
      const sectionTitle = buildSectionTitle(
        tournamentLabel,
        fromCompetitionName,
        stageLabel,
        'desde eliminatoria'
      );
      const matches = eliminationMatchesForIncomingTransition(fromStage, tr);
      const bucket: EligibleInscription[] = [];
      for (const m of matches) {
        const code = bracketDisplayCode(m);
        const slotCode = formatCompactEliminationSlot({ ...m, leg: 1 });
        const slotId = buildSameStageWinnerSlotId(fromStage.id, m.id);
        const winnerLbl = formatWinnerSlotLabel(m, stageLabel);
        bucket.push({
          inscriptionId: slotId,
          displayName: `${winnerLbl} — pendiente`,
          sectionTitle,
          shortLabel: slotCode,
          source: 'elimination',
          eliminationMatchLabel: code,
          optionLabel: `${lineage} · ${winnerLbl}`,
        });
      }
      for (const row of finalizeEligibleRowsForQuota(bucket, quota, stageLabel, lineage)) {
        upsertEligible(row);
      }
    }

    // composed u otros formatos: sin inferencia estable
  }

  const collator = new Intl.Collator('es', {
    sensitivity: 'base',
    numeric: true,
  });

  return [...byId.values()].sort((a, b) => {
    const cs = collator.compare(a.sectionTitle, b.sectionTitle);
    if (cs !== 0) return cs;
    const cq = collator.compare(a.shortLabel, b.shortLabel);
    if (cq !== 0) return cq;
    return collator.compare(a.displayName, b.displayName);
  });
}
