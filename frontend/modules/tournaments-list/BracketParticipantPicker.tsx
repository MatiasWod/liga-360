import React from 'react';
import { createPortal } from 'react-dom';
import type { ParticipantPoolSection, PoolEntry } from './bracketParticipantPool';
import {
  resolvePoolEntryId,
  resolvePoolEntryLabel,
  normPoolId,
} from './bracketParticipantPool';

type GroupTabSlot =
  | { mode: 'flat'; entries: PoolEntry[] }
  | {
      mode: 'tabs';
      tabs: ReadonlyArray<{
        key: string;
        label: string;
        entries: PoolEntry[];
      }>;
    };

/** Ej. etiqueta que empieza con G1P9 · … → 1 */
function groupOrdinalFromGnLabel(label: string): number | null {
  const m = /^G(\d+)P\d+/i.exec(String(label || '').trim());
  return m ? Number(m[1]) : null;
}

/** Ej. "Posición 2 · Grupo 3" (headline del picker) → 3 */
function groupOrdinalFromPositionHeadline(label: string): number | null {
  const m = /^Posici[oó]n\s+\d+\s*·\s*Grupo\s+(\d+)/i.exec(String(label || '').trim());
  return m ? Number(m[1]) : null;
}

function groupOrdinalFromPoolLabel(label: string): number | null {
  return groupOrdinalFromPositionHeadline(label) ?? groupOrdinalFromGnLabel(label);
}

function sortEntries(entries: PoolEntry[]): PoolEntry[] {
  return [...entries].sort((a, b) =>
    resolvePoolEntryLabel(a).localeCompare(resolvePoolEntryLabel(b), 'es', {
      sensitivity: 'base',
      numeric: true,
    })
  );
}

function clusterGroupEntries(entries: PoolEntry[]): GroupTabSlot {
  const byGroup = new Map<number, PoolEntry[]>();
  const loose: PoolEntry[] = [];

  for (const en of entries) {
    const label = resolvePoolEntryLabel(en);
    const gn = groupOrdinalFromPoolLabel(label);
    if (gn != null && gn > 0) {
      let list = byGroup.get(gn);
      if (!list) {
        list = [];
        byGroup.set(gn, list);
      }
      list.push(en);
    } else loose.push(en);
  }

  const sortedKeys = [...byGroup.keys()].sort((a, b) => a - b);

  if (sortedKeys.length === 0) {
    return { mode: 'flat', entries: sortEntries(entries) };
  }

  if (sortedKeys.length === 1 && loose.length === 0) {
    return {
      mode: 'flat',
      entries: sortEntries(byGroup.get(sortedKeys[0]) ?? []),
    };
  }

  const tabsOut: Array<{ key: string; label: string; entries: PoolEntry[] }> = [];

  for (const k of sortedKeys) {
    tabsOut.push({
      key: `g-${k}`,
      label: `Grupo ${k}`,
      entries: sortEntries(byGroup.get(k) ?? []),
    });
  }

  if (loose.length > 0) {
    tabsOut.push({
      key: 'other',
      label: 'Otros',
      entries: sortEntries(loose),
    });
  }

  return { mode: 'tabs', tabs: tabsOut };
}

function capitalizeFirst(s: string): string {
  const t = String(s || '').trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
}

/** Texto corto para mini-tab desde el título de sección (… · desde grupos). */
export function shortPhaseTabTitle(sectionLabel: string): string {
  const trimmed = String(sectionLabel || '').trim();
  const parts = trimmed.split(' · ').map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? trimmed;
  const low = last.toLowerCase();
  if (low.startsWith('desde ')) {
    const rest = last.slice(6).trim() || last;
    return capitalizeFirst(rest);
  }
  if (low.startsWith('asignados')) return last.length <= 34 ? last : `${last.slice(0, 31)}…`;
  return last.length <= 36 ? last : `${last.slice(0, 33)}…`;
}

/** Fila searchable con contexto (origen/grupo). */
export type SearchRow = {
  key: string;
  sectionIx: number;
  /** Índice de sub-tab dentro de clusterGroupEntries o 0 si plano */
  groupTabIxResolved: number;
  phaseShort: string;
  groupHint?: string | null;
  entry: PoolEntry;
};

function buildSearchRows(safeSections: ReadonlyArray<ParticipantPoolSection>): SearchRow[] {
  const rows: SearchRow[] = [];

  safeSections.forEach((sec, sectionIx) => {
    const phaseShort = shortPhaseTabTitle(sec.sectionLabel);
    const cluster = clusterGroupEntries(sec.entries);

    const pushFlat = (ents: PoolEntry[], pref: string) => {
      ents.forEach((en, ei) => {
        rows.push({
          key: `${pref}-${ei}-${resolvePoolEntryId(en)}`,
          sectionIx,
          groupTabIxResolved: 0,
          phaseShort,
          groupHint: null,
          entry: en,
        });
      });
    };

    if (cluster.mode === 'flat') {
      pushFlat(cluster.entries, `s-${sectionIx}-f`);
      return;
    }

    cluster.tabs.forEach((tb, ti) =>
      tb.entries.forEach((en, ei) => {
        rows.push({
          key: `s-${sectionIx}-t${ti}-${ei}-${resolvePoolEntryId(en)}`,
          sectionIx,
          groupTabIxResolved: ti,
          phaseShort,
          groupHint: tb.label,
          entry: en,
        });
      })
    );
  });

  return rows;
}

/**
 * Traduce etiquetas largas (lineage · P9G2 · equipo, tabla general P12 · …, eliminatoria llave E3M2 · …)
 * a líneas cortas tipo “Posición · Grupo / liga / llave”.
 */
export function summarizeParticipantOptionLabel(optionLabel: string): {
  headline: string;
  subline?: string;
} {
  const full = String(optionLabel || '').trim();
  if (!full) return { headline: 'Sin asignar' };

  const segments = full.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean);
  if (segments.length === 0) return { headline: 'Sin asignar' };

  const sublineSkippingIdx = (skipIdx: number): string | undefined => {
    const rest = segments
      .filter((_, i) => i !== skipIdx)
      .join(' · ')
      .trim();
    return rest || undefined;
  };

  const normSeg = (s: string): string => s.replace(/\s+/g, '');

  // Mejor tercero entre grupos: "1° mejor 3° entre grupos"
  const idxBestThirdRank = segments.findIndex((s) =>
    /^\d+°\s+mejor\s+\d+°\s+entre\s+grupos$/i.test(String(s ?? '').trim())
  );
  if (idxBestThirdRank >= 0) {
    return {
      headline: segments[idxBestThirdRank],
      subline: sublineSkippingIdx(idxBestThirdRank),
    };
  }

  // Cupo BN1 / BN2 (mejor tercero)
  const idxBnSlot = segments.findIndex((s) => /^BN\d+$/i.test(normSeg(s)));
  if (idxBnSlot >= 0) {
    return {
      headline: `${segments[idxBnSlot]} · mejor tercero`,
      subline: sublineSkippingIdx(idxBnSlot),
    };
  }

  // Posición/grupo nuevo: P9G2
  const idxPgn = segments.findIndex((s) => /^P\d+G\d+$/i.test(normSeg(s)));
  if (idxPgn >= 0) {
    const mm = /^P(\d+)G(\d+)$/i.exec(normSeg(segments[idxPgn]));
    if (mm) {
      return {
        headline: `Posición ${Number(mm[1])} · Grupo ${Number(mm[2])}`,
        subline: sublineSkippingIdx(idxPgn),
      };
    }
  }

  // Legacy G1P9
  const idxGnp = segments.findIndex((s) => /^G\d+P\d+$/i.test(normSeg(s)));
  if (idxGnp >= 0) {
    const gm = /^G(\d+)P(\d+)$/i.exec(normSeg(segments[idxGnp]));
    if (gm) {
      const g = Number(gm[1]);
      const pos = Number(gm[2]);
      return {
        headline: `Posición ${pos} · Grupo ${g}`,
        subline: sublineSkippingIdx(idxGnp),
      };
    }
  }

  // Liga: "... tabla general P12 ..."
  const idxTabla = segments.findIndex((s) => /\btabla\s+general\s+P\d+/i.test(s));
  if (idxTabla >= 0) {
    const tm = /\btabla\s+general\s+P(\d+)\b/i.exec(segments[idxTabla]);
    if (tm) {
      const stageHint = idxTabla > 0 ? segments[idxTabla - 1] : null;
      return {
        headline: `Posición ${Number(tm[1])} · ${stageHint ?? 'Liga'}`,
        subline: sublineSkippingIdx(idxTabla),
      };
    }
  }

  // Grupos (finalizeEligibleRowsForQuota): "... · Grupo 1 · posición 2 · Equipo"
  for (let i = 0; i < segments.length - 1; i += 1) {
    const gm = /^Grupo\s+(.+)$/i.exec(String(segments[i] ?? '').trim());
    const pm = /^posici[oó]n\s+(\d+)/i.exec(String(segments[i + 1] ?? '').trim());
    if (gm && pm) {
      const skip = new Set([i, i + 1]);
      const subline =
        segments
          .filter((_, j) => !skip.has(j))
          .join(' · ')
          .trim() || undefined;
      return {
        headline: `Posición ${Number(pm[1])} · Grupo ${gm[1].trim()}`,
        subline,
      };
    }
  }

  // Ganador con etapa origen: "Ganador Partido 1 - Repechaje"
  const idxGanStage = segments.findIndex((s) => /^Ganador\s+Partido\s+\d+\s+-\s+.+/i.test(s));
  if (idxGanStage >= 0) {
    const gm = /^Ganador\s+Partido\s+(\d+)\s+-\s+(.+)$/i.exec(segments[idxGanStage].trim());
    if (gm) {
      return {
        headline: `Ganador Partido ${Number(gm[1])} - ${gm[2].trim()}`,
        subline: sublineSkippingIdx(idxGanStage),
      };
    }
  }

  const ganStageFull = /^Ganador\s+Partido\s+(\d+)\s+-\s+(.+)$/i.exec(full);
  if (ganStageFull) {
    return {
      headline: `Ganador Partido ${Number(ganStageFull[1])} - ${ganStageFull[2].trim()}`,
    };
  }

  // Clasificado desde eliminatoria previa (legacy): "... · Ganador · Partido 3 · Ronda 1"
  const idxGanador = segments.findIndex((s) => /^Ganador$/i.test(s));
  if (idxGanador >= 0) {
    const partSeg = segments[idxGanador + 1] ?? '';
    const roundSeg = segments[idxGanador + 2] ?? '';
    const pm = /^Partido\s+(\d+)$/i.exec(partSeg);
    const rm = /^Ronda\s+(\d+)$/i.exec(roundSeg);
    if (pm && rm) {
      const skip = new Set([idxGanador, idxGanador + 1, idxGanador + 2]);
      const subline = segments.filter((_, i) => !skip.has(i)).join(' · ').trim() || undefined;
      return {
        headline: `Ganador · Partido ${Number(pm[1])} · Ronda ${Number(rm[1])}`,
        subline,
      };
    }

    const prev = segments[idxGanador - 1] ?? '';
    const codeNorm = prev.replace(/\s+/g, '');
    const elimCode = /^E(\d+)-M(\d+)$/i.exec(prev) ?? /^E(\d+)M(\d+)$/i.exec(codeNorm);
    if (elimCode) {
      return {
        headline: `Ganador · Partido ${Number(elimCode[2])} · Ronda ${Number(elimCode[1])}`,
        subline: sublineSkippingIdx(idxGanador),
      };
    }
  }

  const idxGanPartido = segments.findIndex((s) => /^Ganador\s+·\s+Partido\s+\d+/i.test(s));
  if (idxGanPartido >= 0) {
    const gm = /Ganador\s+·\s+Partido\s+(\d+)\s+·\s+Ronda\s+(\d+)/i.exec(segments[idxGanPartido]);
    if (gm) {
      return {
        headline: `Ganador · Partido ${Number(gm[1])} · Ronda ${Number(gm[2])}`,
        subline: sublineSkippingIdx(idxGanPartido),
      };
    }
  }

  const idxElimSeg = segments.findIndex((s) => /\beliminatoria\s+llave\b/i.test(s));
  if (idxElimSeg >= 0) {
    const lc = /\beliminatoria\s+llave\s+([^\s·]+)/i.exec(segments[idxElimSeg] ?? '');
    const rawCode = (lc?.[1] ?? '').replace(/-/g, '');
    if (rawCode) {
      const elim = /^E(\d+)M(\d+)(L(\d+))?$/i.exec(rawCode);
      const headline = elim
        ? `Ronda ${elim[1]} · Partido ${elim[2]}${elim[4] ? ` · Pierna ${elim[4]}` : ''}`
        : `Llave ${rawCode}`;
      return {
        headline,
        subline: sublineSkippingIdx(idxElimSeg),
      };
    }
  }

  const firstRaw = segments[0] ?? '';
  const remainder = segments.slice(1).join(' · ');
  /** Normaliza primera pieza quitando espacios internos. */
  const first = firstRaw.replace(/\s+/g, '');

  const pn = /^P(\d+)$/i.exec(first);
  if (pn) {
    return {
      headline: `Posición ${Number(pn[1])} · Liga`,
      subline: remainder || undefined,
    };
  }

  const firstClean = first.replace(/-([LV])$/i, '');

  const elim = /^E(\d+)M(\d+)(?:L(\d+))?$/i.exec(firstClean.replace(/-/g, ''));
  if (elim) {
    const leg = elim[3] ? ` · Pierna ${elim[3]}` : '';
    return {
      headline: `Ronda ${elim[1]} · Partido ${elim[2]}${leg}`,
      subline: remainder || undefined,
    };
  }

  return {
    headline:
      firstRaw.length <= 52 ? firstRaw : `${firstRaw.slice(0, 49)}…`,
    subline: remainder || undefined,
  };
}

/** Etiqueta corta para pool/bracket; evita mostrar solo el nombre del torneo como fallback. */
export function displayLabelFromPoolEligible(el: {
  inscriptionId?: string;
  optionLabel?: string;
  displayName?: string;
  shortLabel?: string;
}): string {
  const sid = String(el.inscriptionId || '').trim();
  const raw = String(el.optionLabel || el.displayName || '').trim();
  const { headline } = summarizeParticipantOptionLabel(raw || sid);
  if (headline && headline !== sid) {
    const firstSeg = raw.split(/\s*·\s*/)[0]?.trim() ?? '';
    if (raw.includes(' · ') && headline === firstSeg) {
      return String(el.shortLabel || el.displayName || sid).trim() || sid;
    }
    return headline;
  }
  return String(el.shortLabel ?? el.displayName ?? raw ?? sid).trim() || sid;
}

function buildTriggerSummary(
  sections: ReadonlyArray<ParticipantPoolSection>,
  value: string,
  emptyText: string
): { headline: string; subline?: string; isEmpty: boolean; titleAttr: string } {
  const v = normPoolId(value);
  if (!v) {
    return {
      headline: emptyText,
      subline: 'Tocá para elegir',
      isEmpty: true,
      titleAttr: `${emptyText} · tocar para elegir`,
    };
  }
  for (const sec of sections) {
    for (const en of sec.entries) {
      if (resolvePoolEntryId(en) !== v) continue;
      const raw = resolvePoolEntryLabel(en);
      const summarized = summarizeParticipantOptionLabel(raw);
      const titleAttr = summarized.subline
        ? `${summarized.headline} — ${summarized.subline}`
        : summarized.headline;
      return {
        headline: summarized.headline,
        subline: summarized.subline,
        isEmpty: false,
        titleAttr,
      };
    }
  }
  const titleAttr = v.length > 64 ? `${v.slice(0, 61)}…` : v;
  return {
    headline: v,
    subline: undefined,
    titleAttr,
    isEmpty: false,
  };
}

function buildTriggerSummaryWithFallback(
  sections: ReadonlyArray<ParticipantPoolSection>,
  value: string,
  emptyText: string,
  fallbackLabel?: string
): ReturnType<typeof buildTriggerSummary> {
  const result = buildTriggerSummary(sections, value, emptyText);
  if (!result.isEmpty && result.headline === normPoolId(value) && fallbackLabel) {
    return { ...result, headline: fallbackLabel };
  }
  return result;
}

export type BracketParticipantPickerProps = {
  resetSignal: string | number;
  sections: ReadonlyArray<ParticipantPoolSection>;
  value: string;
  /** Nombre a mostrar cuando el value no se encuentra en ninguna sección (ej: inscripción asignada antes de configurar el pool). */
  valueLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
  emptyLabel?: string;
  onChange: (rawId: string) => void;
};

export const BracketParticipantPicker: React.FC<BracketParticipantPickerProps> = ({
  resetSignal,
  sections,
  value,
  valueLabel,
  disabled,
  ariaLabel,
  emptyLabel,
  onChange,
}) => {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const portalPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = React.useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [expanded, setExpanded] = React.useState(false);
  const [phaseIx, setPhaseIx] = React.useState(0);
  const [groupTabIx, setGroupTabIx] = React.useState(0);
  const [search, setSearch] = React.useState('');

  const safeSections = sections.length ? sections : [];

  React.useEffect(() => {
    setPhaseIx(0);
    setGroupTabIx(0);
    setSearch('');
    setExpanded(false);
  }, [resetSignal]);

  const vi = normPoolId(value);

  React.useEffect(() => {
    if (!safeSections.length) return;
    if (!vi) return;
    const pi = safeSections.findIndex((s) =>
      s.entries.some((e) => resolvePoolEntryId(e) === vi)
    );
    if (pi >= 0) setPhaseIx(pi);
  }, [safeSections, vi]);

  React.useEffect(() => {
    function onPointerDown(ev: MouseEvent | PointerEvent) {
      if (!expanded) return;
      const t = ev.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (portalPanelRef.current?.contains(t)) return;
      setExpanded(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const safePhaseIx = Math.min(Math.max(0, phaseIx), Math.max(0, safeSections.length - 1));
  const phaseSec = safeSections[safePhaseIx];

  const groupCluster = React.useMemo(() => clusterGroupEntries(phaseSec?.entries ?? []), [phaseSec]);

  React.useEffect(() => {
    if (groupCluster.mode === 'flat') {
      setGroupTabIx(0);
      return;
    }
    if (!vi) {
      setGroupTabIx(0);
      return;
    }
    const idx = groupCluster.tabs.findIndex((t) =>
      t.entries.some((e) => resolvePoolEntryId(e) === vi)
    );
    if (idx >= 0) setGroupTabIx(idx);
  }, [groupCluster, phaseSec?.sectionLabel, phaseSec?.entries, vi]);

  const safeGroupIx =
    groupCluster.mode === 'tabs' && groupCluster.tabs.length > 0
      ? Math.min(Math.max(0, groupTabIx), groupCluster.tabs.length - 1)
      : 0;

  React.useEffect(() => {
    if (groupCluster.mode !== 'tabs') return undefined;
    if (groupTabIx >= groupCluster.tabs.length) setGroupTabIx(0);
    return undefined;
  }, [groupCluster, groupTabIx]);

  const visibleEntries =
    groupCluster.mode === 'flat'
      ? groupCluster.entries
      : groupCluster.mode === 'tabs' && groupCluster.tabs.length > 0
        ? groupCluster.tabs[safeGroupIx]?.entries ?? []
        : [];

  const searchRows = React.useMemo(
    () => buildSearchRows(safeSections),
    [safeSections]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const searchFilteredRows = React.useMemo(() => {
    if (!normalizedSearch) return [];
    const q = normalizedSearch;
    return searchRows.filter((row) => {
      const lbl = resolvePoolEntryLabel(row.entry).toLowerCase();
      const ctx = `${row.phaseShort} ${row.groupHint ?? ''}`.toLowerCase();
      return lbl.includes(q) || ctx.includes(q);
    });
  }, [normalizedSearch, searchRows]);

  const browsingList = normalizedSearch !== '' ? null : visibleEntries;

  const showGlobalSearchHits = normalizedSearch !== '' && searchFilteredRows.length > 0;

  const showGlobalSearchEmpty =
    normalizedSearch !== '' && searchFilteredRows.length === 0;

  const emptyText = emptyLabel ?? 'Sin asignar';

  const updatePopoverPosition = React.useCallback(() => {
    const btn = triggerRef.current;
    if (!expanded || !btn) return;
    const r = btn.getBoundingClientRect();
    const pad = 8;
    let width = Math.max(r.width, 280);
    let left = r.left;
    if (typeof window !== 'undefined') {
      width = Math.min(width, window.innerWidth - pad * 2);
      left = Math.min(Math.max(pad, left), Math.max(pad, window.innerWidth - width - pad));
    }
    setPopoverPos({ top: r.bottom + 6, left, width });
  }, [expanded]);

  React.useLayoutEffect(() => {
    updatePopoverPosition();
  }, [expanded, updatePopoverPosition, phaseIx, groupTabIx, normalizedSearch, safeSections]);

  React.useEffect(() => {
    if (!expanded) return undefined;
    const onWin = () => updatePopoverPosition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    window.requestAnimationFrame(updatePopoverPosition);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [expanded, updatePopoverPosition, phaseIx, groupTabIx]);

  function pick(rowForSync: SearchRow | null, rawId: string) {
    if (rowForSync != null && safeSections[rowForSync.sectionIx]) {
      setPhaseIx(rowForSync.sectionIx);
      setGroupTabIx(rowForSync.groupTabIxResolved);
    }
    onChange(rawId);
    setExpanded(false);
    setSearch('');
  }

  const triggerDisplay = React.useMemo(
    () =>
      safeSections.length === 0 && !normPoolId(value)
        ? {
            headline: emptyText,
            subline: 'No hay opciones disponibles' as string | undefined,
            isEmpty: true,
            titleAttr: 'Sin opciones disponibles',
          }
        : buildTriggerSummaryWithFallback(safeSections, value, emptyText, valueLabel),
    [safeSections, value, emptyText, valueLabel]
  );

  const inputClass =
    'w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text-primary outline-none transition focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/30';

  function clearAssignment() {
    onChange('');
    setExpanded(false);
    setSearch('');
  }

  return (
    <div className="relative mt-1 w-full" aria-label={ariaLabel}>
      <div className="flex items-stretch gap-2">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setExpanded((e) => !e)}
          className={`flex min-w-0 flex-1 items-center justify-between rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-60 ${
            expanded ? 'ring-2 ring-accent-primary/30 border-accent-primary/55' : ''
          }`}
          aria-expanded={expanded}
          aria-haspopup="listbox"
          aria-controls={expanded ? `${String(resetSignal)}-panel` : undefined}
          title={triggerDisplay.titleAttr}
        >
          <div className="min-w-0 flex-1 pr-2">
            <p
              className={`truncate text-sm font-semibold tracking-tight ${
                triggerDisplay.isEmpty ? 'text-text-muted' : 'text-success-base'
              }`}
            >
              {triggerDisplay.headline}
            </p>
            {triggerDisplay.subline ? (
              <p className="mt-0.5 truncate text-[11px] leading-snug text-text-subtle">{triggerDisplay.subline}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-text-subtle" aria-hidden>
            {expanded ? 'v' : '>'}
          </span>
        </button>
        {!triggerDisplay.isEmpty && !disabled ? (
          <button
            type="button"
            onClick={clearAssignment}
            className="shrink-0 rounded-xl border border-border-subtle bg-surface-2 px-2.5 text-[11px] font-medium text-text-muted transition hover:border-danger-base/40 hover:bg-danger-soft hover:text-danger-base"
            title="Quitar asignación"
          >
            Quitar
          </button>
        ) : null}
      </div>

      {expanded && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalPanelRef}
              id={`${String(resetSignal)}-panel`}
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                width: `${popoverPos.width}px`,
                maxHeight: `min(28rem, calc(100vh - ${popoverPos.top}px - 0.75rem))`,
                zIndex: 10050,
              }}
              className="overflow-y-auto overscroll-contain rounded-xl border border-border-subtle bg-surface-2 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.55)] ring-1 ring-border-strong backdrop-blur-sm"
            >
              <div className="space-y-2" role="region">

            {safeSections.length > 1 ? (
              <div
                className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1"
                role="tablist"
                aria-label="Origen por fase"
              >
                {safeSections.map((s, i) => {
                  const sel = safePhaseIx === i;
                  return (
                    <button
                      key={`phase-${String(s.sectionLabel).slice(0, 52)}-${i}`}
                      type="button"
                      disabled={disabled}
                      role="tab"
                      aria-selected={sel}
                      title={s.sectionLabel}
                      onClick={() => {
                        setPhaseIx(i);
                        setGroupTabIx(0);
                      }}
                      className={`min-w-[4rem] flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        sel
                          ? 'bg-accent-primary text-white shadow-sm'
                          : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
                      }`}
                    >
                      {shortPhaseTabTitle(s.sectionLabel)}
                    </button>
                  );
                })}
              </div>
            ) : (
              phaseSec ? (
                <p className="text-[11px] text-text-muted">{phaseSec.sectionLabel}</p>
              ) : null
            )}

            {phaseSec && groupCluster.mode === 'tabs' ? (
              <div
                className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-1 p-1"
                role="tablist"
                aria-label="Grupos dentro de la fase"
              >
                {groupCluster.tabs.map((tb, ti) => {
                  const sel = safeGroupIx === ti;
                  return (
                    <button
                      key={tb.key}
                      type="button"
                      role="tab"
                      disabled={disabled}
                      aria-selected={sel}
                      onClick={() => setGroupTabIx(ti)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        sel
                          ? 'bg-accent-soft text-success-base ring-1 ring-accent-primary/30'
                          : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
                      }`}
                    >
                      {tb.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <label className="block">
              <span className="sr-only">Buscar en el cupo</span>
              <input
                type="text"
                value={search}
                disabled={disabled}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar equipo o plaza (todos los orígenes)…"
                className={inputClass}
              />
            </label>

            <div className="max-h-56 overflow-auto rounded-lg border border-border-subtle bg-surface-1 p-2" role="listbox">
              <button
                type="button"
                disabled={disabled}
                role="option"
                aria-selected={!vi}
                onClick={() => pick(null, '')}
                className={`mb-1 w-full rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  !vi
                    ? 'bg-accent-soft font-semibold text-text-primary'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
                }`}
              >
                — {emptyText}
              </button>

              {safeSections.length === 0 ? (
                <p className="px-2 py-2 text-[11px] italic text-text-muted">
                  No hay más opciones disponibles para este slot.
                </p>
              ) : showGlobalSearchHits ? (
                <ul className="space-y-1">
                  {searchFilteredRows.map((row) => {
                    const lbl = resolvePoolEntryLabel(row.entry);
                    const id = resolvePoolEntryId(row.entry);
                    const sel = normPoolId(id) === vi && vi !== '';
                    const hint = [row.phaseShort, row.groupHint].filter(Boolean).join(' · ');
                    return (
                      <li key={row.key}>
                        <button
                          type="button"
                          disabled={disabled}
                          role="option"
                          aria-selected={sel}
                          title={lbl}
                          onClick={() => pick(row, id)}
                          className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                            sel
                              ? 'bg-accent-soft font-medium text-text-primary ring-1 ring-accent-primary/25'
                              : 'text-text-primary hover:bg-surface-3'
                          }`}
                        >
                          <span className="block truncate text-xs font-medium">{lbl}</span>
                          <span className="block truncate text-[10px] text-text-muted">{hint}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : showGlobalSearchEmpty ? (
                <p className="px-2 py-2 text-[11px] text-text-muted">
                  No encontramos ese equipo o plaza en ningún origen.
                </p>
              ) : browsingList && browsingList.length > 0 ? (
                <ul className="space-y-0.5">
                  {browsingList.map((en) => {
                    const lbl = resolvePoolEntryLabel(en);
                    const id = resolvePoolEntryId(en);
                    const sel = normPoolId(id) === vi && vi !== '';
                    return (
                      <li key={`${id}:${lbl.slice(0, 40)}`}>
                        <button
                          type="button"
                          disabled={disabled}
                          role="option"
                          aria-selected={sel}
                          title={lbl}
                          onClick={() => pick(null, id)}
                          className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                            sel
                              ? 'bg-accent-soft font-semibold text-text-primary ring-1 ring-accent-primary/25'
                              : 'text-text-primary hover:bg-surface-3'
                          }`}
                        >
                          {lbl}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-2 py-2 text-[11px] text-text-muted">
                  Todas las plazas están asignadas en otras llaves. Podés quitar una asignación con el botón «Quitar».
                </p>
              )}
            </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
