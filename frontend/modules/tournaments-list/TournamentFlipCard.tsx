import React from 'react';
import { getTournamentDetailById } from '../../services/tournamentsApi';
import { formatSeriesEditionBadge } from './editionDisplay';
import { CategoryLabelBadge } from './CategoryLabelBadge';
import { SeriesEditionBadge } from './SeriesEditionBadge';
import type { TournamentCompetition, TournamentEntity, TournamentStage, TournamentTransition } from './types';

interface TournamentFlipCardProps {
  tournament: TournamentEntity;
  currentOrganizer?: string;
  onOpen?: (id: string, name?: string) => void;
  onDelete?: (id: string, name: string) => Promise<void> | void;
  onInscribe?: (tournamentId: string) => Promise<void>;
  onConfig?: (id: string, name: string) => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPin() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21C12 21 5 13.5 5 9a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
}
function IconUser() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a8.5 8.5 0 0 1 13 0" /></svg>;
}
function IconUsers() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3.5" /><path d="M3 21a7 7 0 0 1 12 0" /><path d="M15.5 4.5a3.5 3.5 0 1 1 0 7" /><path d="M21 21a5 5 0 0 0-5-5" /></svg>;
}
function IconTrophy() {
  return <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v6a6 6 0 0 1-12 0V3z" /><path d="M6 5H3v2a3 3 0 0 0 3 3" /><path d="M18 5h3v2a3 3 0 0 1-3 3" /><path d="M12 15v4" /><path d="M8 19h8" /></svg>;
}
function IconGlobe() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
}
function IconCalendar() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
function IconLock() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
}
function IconChevronLeft() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>;
}
function IconCheck() {
  return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IconArrowRight() {
  return <svg viewBox="0 0 16 16" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="8" x2="14" y2="8" /><polyline points="9,3 14,8 9,13" /></svg>;
}
function IconExternalLink() {
  return <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}

// ── Stage format diagrams ─────────────────────────────────────────────────────

function DiagramGroups() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
      <rect x="3" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="18" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="18" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="18" y="18" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="20" y1="8" x2="27" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="20" y1="11" x2="24" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function DiagramLeague() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
      <rect x="3" y="4" width="26" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="12" width="26" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="20" width="26" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="7" cy="14.5" r="1.5" fill="currentColor" />
      <circle cx="7" cy="22.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
function DiagramElimination() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
      <rect x="2" y="3" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="18" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="25" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5 H13 V12 H9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20 H13 V27 H9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="9" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="18" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 11.5 H24 V20.5 H20" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24" y="14" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function DiagramComposed() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
      <rect x="2" y="4" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="17" y="4" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="18" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 14 L16 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M23.5 14 L16 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const FORMAT_CONFIG = {
  groups:      { diagram: DiagramGroups,      label: 'Grupos',      color: 'text-sky-400',    bg: 'bg-sky-400/10 border-sky-400/25',    dot: 'bg-sky-400'    },
  league:      { diagram: DiagramLeague,      label: 'Liga',        color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/25',dot: 'bg-amber-400'  },
  elimination: { diagram: DiagramElimination, label: 'Eliminación', color: 'text-emerald-400',bg: 'bg-emerald-400/10 border-emerald-400/25',dot: 'bg-emerald-400'},
  composed:    { diagram: DiagramComposed,    label: 'Compuesto',   color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/25',dot: 'bg-violet-400' },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusConfig(status?: string | null) {
  switch (status) {
    case 'published': return { label: 'Inscripciones abiertas', dot: 'bg-accent-primary',  text: 'text-accent-primary',  bg: 'bg-accent-soft border-accent-primary/20' };
    case 'active':    return { label: 'En curso',               dot: 'bg-warning-base',    text: 'text-warning-base',    bg: 'bg-warning-soft border-warning-base/20'  };
    case 'finished':
    case 'closed':    return { label: 'Finalizado',             dot: 'bg-text-subtle',     text: 'text-text-subtle',     bg: 'bg-white/5 border-white/10'              };
    default:          return { label: 'Borrador',               dot: 'bg-text-subtle/50',  text: 'text-text-subtle',     bg: 'bg-white/[0.04] border-white/[0.07]'     };
  }
}

function stageStatusLabel(s?: string | null) {
  switch (s) {
    case 'pending':     return 'Pendiente';
    case 'active':      return 'En curso';
    case 'finished':    return 'Finalizada';
    case 'not_started': return 'Sin iniciar';
    default: return s ?? null;
  }
}

function participantTypeLabel(type?: string | null) {
  const raw = String(type ?? '').trim().toLowerCase();
  if (raw === 'team' || raw === 'teams') return 'Equipos';
  if (['participant', 'participants', 'individual', 'individuals'].includes(raw)) return 'Participantes';
  return type ?? null;
}

function inscriptionModeLabel(mode?: string | null) {
  if (mode === 'invitation') return 'Por invitación';
  if (mode === 'public') return 'Público';
  return null;
}

function transitionSelectionLabel(t: TournamentTransition): string {
  if (t.topN != null) return `Top ${t.topN}`;
  if (t.bottomN != null) return `Últ. ${t.bottomN}`;
  if (t.rangeFrom != null && t.rangeTo != null) return `${t.rangeFrom}°–${t.rangeTo}°`;
  if (t.label) return t.label;
  if (t.selectionKind === 'winner') return 'Ganador';
  return 'Clasificados';
}

// ── Stage list item ───────────────────────────────────────────────────────────

function stageStatusBadge(s?: string | null) {
  switch (s) {
    case 'active':      return { label: 'En juego',    cls: 'text-warning-base bg-warning-soft border-warning-base/25' };
    case 'finished':    return { label: 'Finalizada',  cls: 'text-text-subtle bg-white/5 border-white/10' };
    case 'not_started':
    case 'pending':
    default:            return null;
  }
}

function StageListItem({
  stage,
  active,
  onClick,
}: {
  stage: TournamentStage;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = FORMAT_CONFIG[stage.format] ?? FORMAT_CONFIG.elimination;
  const badge = stageStatusBadge(stage.stageStatus);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 border transition-all text-left ${
        active
          ? `${cfg.bg} ${cfg.color}`
          : 'border-border-subtle bg-surface-2 text-text-primary hover:border-border-strong'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-medium truncate">{stage.name}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </button>
  );
}

// ── Stage detail panel ────────────────────────────────────────────────────────

function StageDetailPanel({
  stage,
  allStages,
}: {
  stage: TournamentStage;
  allStages: TournamentStage[];
}) {
  const cfg        = FORMAT_CONFIG[stage.format] ?? FORMAT_CONFIG.elimination;
  const isActive   = stage.stageStatus === 'active';

  const inscribedCount   = stage.assignedInscriptions?.length ?? 0;
  const completedMatches = (stage.matches ?? []).filter((m) => m.status === 'completed').length;
  const totalMatches     = stage.matches?.length ?? 0;

  // Lowest round with pending matches → current round in play
  const pendingRounds = (stage.matches ?? [])
    .filter((m) => m.status !== 'completed')
    .map((m) => m.round ?? 0)
    .filter((r) => r > 0);
  const currentRound =
    pendingRounds.length > 0
      ? Math.min(...pendingRounds)
      : totalMatches > 0
      ? Math.max(...(stage.matches!.map((m) => m.round ?? 0)))
      : null;

  const roundLabel =
    currentRound != null
      ? stage.format === 'league' || stage.format === 'groups'
        ? `Fecha ${currentRound}`
        : `Ronda ${currentRound}`
      : null;

  const transitions = stage.transitions ?? [];
  const stageById   = Object.fromEntries(allStages.map((s) => [s.id, s]));

  return (
    <div className={`rounded-lg border p-2.5 text-[11px] space-y-2 ${cfg.bg}`}>
      {/* Teams + active progress */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-text-muted">
        {inscribedCount > 0 && (
          <span className="flex items-center gap-1">
            <IconUsers />
            {inscribedCount} {inscribedCount === 1 ? 'equipo' : 'equipos'}
          </span>
        )}
        {isActive && totalMatches > 0 && (
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="14" height="10" rx="1.5" /><path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /></svg>
            {completedMatches}/{totalMatches} partidos
          </span>
        )}
        {isActive && roundLabel && (
          <span className={`font-semibold ${cfg.color}`}>{roundLabel}</span>
        )}
      </div>

      {/* Outgoing transitions */}
      {transitions.length > 0 && (
        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <p className="text-text-subtle font-medium mb-0.5">Pasajes:</p>
          {transitions.map((tr) => {
            const targetStage = tr.toStageId ? stageById[tr.toStageId] : null;
            return (
              <div key={tr.id} className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${cfg.bg} ${cfg.color}`}>
                  {transitionSelectionLabel(tr)}
                </span>
                <IconArrowRight />
                {targetStage ? (
                  <span className="text-text-primary font-medium">{targetStage.name}</span>
                ) : tr.toExternalTournamentName ? (
                  <span className="flex items-center gap-1 text-text-muted">
                    <IconExternalLink />
                    {tr.toExternalTournamentName}
                  </span>
                ) : (
                  <span className="text-text-subtle italic">Destino externo</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function BackSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-1">
      <div className="h-3 w-2/3 rounded-full bg-surface-3 animate-pulse" />
      <div className="flex gap-2 mt-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="w-[72px] h-[80px] rounded-xl bg-surface-3 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Competition back view ─────────────────────────────────────────────────────

function CompetitionView({
  competition,
  detailStages,
}: {
  competition: TournamentCompetition;
  detailStages: TournamentStage[] | null;
}) {
  const [activeStageId, setActiveStageId] = React.useState<string | null>(null);

  const detailById = React.useMemo(() => {
    if (!detailStages) return {} as Record<string, TournamentStage>;
    return Object.fromEntries(detailStages.map((s) => [s.id, s]));
  }, [detailStages]);

  const enriched: TournamentStage[] = React.useMemo(
    () =>
      [...competition.stages]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({ ...s, ...(detailById[s.id] ?? {}) })),
    [competition.stages, detailById]
  );

  return (
    <div className="flex flex-col gap-0 min-h-0">
      <p className="text-xs font-semibold text-text-primary mb-2 truncate" title={competition.name}>
        {competition.name}
      </p>

      {enriched.length === 0 ? (
        <p className="text-xs text-text-subtle">Sin etapas configuradas</p>
      ) : (
        <div className="flex flex-col gap-1">
          {enriched.map((stage) => (
            <React.Fragment key={stage.id}>
              <StageListItem
                stage={stage}
                active={activeStageId === stage.id}
                onClick={() => setActiveStageId((p) => (p === stage.id ? null : stage.id))}
              />
              {activeStageId === stage.id && (
                <StageDetailPanel stage={stage} allStages={enriched} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const TournamentFlipCard: React.FC<TournamentFlipCardProps> = ({
  tournament: t,
  currentOrganizer,
  onOpen,
  onDelete,
  onInscribe,
  onConfig,
}) => {
  const [flipped, setFlipped]                 = React.useState(false);
  const [menuOpen, setMenuOpen]               = React.useState(false);
  const [compIndex, setCompIndex]             = React.useState(0);
  const [inscribeLoading, setInscribeLoading] = React.useState(false);
  const [inscribeSuccess, setInscribeSuccess] = React.useState(false);
  const [inscribeError, setInscribeError]     = React.useState<string | null>(null);
  const [detailData, setDetailData]           = React.useState<any | null>(null);
  const [detailLoading, setDetailLoading]     = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const editionBadge = formatSeriesEditionBadge(t.seriesName, t.editionLabel, t.season);

  const isOrganizer =
    !!currentOrganizer &&
    (t.organizer ?? '').trim().toLowerCase() === currentOrganizer.trim().toLowerCase();

  const status   = statusConfig(t.status);
  const typeLabel = participantTypeLabel(t.participantType);
  const modeLabel = inscriptionModeLabel(t.inscriptionMode);
  const safeCompIndex = Math.min(compIndex, Math.max(0, t.competitions.length - 1));
  const currentComp   = t.competitions[safeCompIndex];

  // Lazy-load detail on first flip
  React.useEffect(() => {
    if (!flipped || detailData || detailLoading) return;
    let cancelled = false;
    setDetailLoading(true);
    getTournamentDetailById(t.id)
      .then((data) => { if (!cancelled) { setDetailData(data); setDetailLoading(false); } })
      .catch(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [flipped]);

  // Close menu on outside click
  React.useEffect(() => {
    if (!menuOpen) return;
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  React.useEffect(() => {
    if (!flipped) { setCompIndex(0); setInscribeError(null); }
  }, [flipped]);

  async function handleInscribe() {
    if (!onInscribe || inscribeLoading || inscribeSuccess) return;
    setInscribeLoading(true);
    setInscribeError(null);
    try {
      await onInscribe(t.id);
      setInscribeSuccess(true);
    } catch (e: any) {
      setInscribeError(e?.message ?? 'No se pudo enviar la solicitud');
    } finally {
      setInscribeLoading(false);
    }
  }

  // Get detail stages for the current competition
  function detailStagesForComp(compId: string): TournamentStage[] | null {
    if (!detailData?.competitions) return null;
    const comp = (detailData.competitions as TournamentCompetition[]).find((c) => c.id === compId);
    return comp?.stages ?? null;
  }

  return (
    <div style={{ perspective: '1200px' }} className="min-h-[320px]">
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
          minHeight: '320px',
          height: '100%',
        }}
      >

        {/* ═════════════════════════ FRENTE ═════════════════════════════════ */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="absolute inset-0 rounded-xl border border-border-subtle bg-surface-1 shadow-lg shadow-black/30 cursor-pointer flex flex-col overflow-hidden"
          onClick={() => !menuOpen && setFlipped(true)}
        >
          {/* Header gradiente */}
          <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-accent-primary/20 via-surface-3/60 to-transparent border-b border-border-subtle/60">
            {isOrganizer && (
              <div ref={menuRef} className="absolute top-3.5 right-3.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  aria-label="Opciones"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-subtle hover:text-text-primary hover:bg-white/10 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 z-20 w-40 rounded-xl border border-border-subtle bg-surface-0 p-1.5 shadow-xl shadow-black/50">
                    {onConfig && (
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-2"
                        onClick={() => { setMenuOpen(false); onConfig(t.id, t.name); }}
                      >
                        Configurar torneo
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger-base transition-colors hover:bg-danger-soft"
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm(`¿Eliminar torneo "${t.name}"? Esta acción no se puede deshacer.`))
                          onDelete?.(t.id, t.name);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )}
            <h3 className="text-base font-bold text-text-primary leading-snug pr-8 mb-2" title={t.name}>{t.name}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${status.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                <span className={status.text}>{status.label}</span>
              </span>
              <SeriesEditionBadge
                seriesName={t.seriesName}
                editionLabel={t.editionLabel}
                season={t.season}
              />
              <CategoryLabelBadge label={t.categoryLabel} />
            </div>
          </div>

          {/* Body 2 cols */}
          <div className="flex-1 px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-2.5 content-start">
            {editionBadge ? (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-brand-greenAccent"><IconCalendar /></span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">
                    {t.seriesName ? 'Serie · Edición' : 'Edición'}
                  </p>
                  <p className="text-xs font-semibold text-brand-greenAccent">{editionBadge.text}</p>
                </div>
              </div>
            ) : null}
            {t.venue && (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-text-subtle"><IconPin /></span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">Sede</p>
                  <p className="text-xs text-text-primary truncate">{t.venue}</p>
                </div>
              </div>
            )}
            {typeLabel && (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-text-subtle"><IconUsers /></span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">Tipo</p>
                  <p className="text-xs text-text-primary">{typeLabel}</p>
                </div>
              </div>
            )}
            {t.organizer && (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-text-subtle"><IconUser /></span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">Organiza</p>
                  <p className="text-xs text-text-primary truncate">{t.organizer}</p>
                </div>
              </div>
            )}
            {modeLabel && (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-text-subtle">{t.inscriptionMode === 'invitation' ? <IconLock /> : <IconGlobe />}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">Inscripción</p>
                  <p className="text-xs text-text-primary">{modeLabel}</p>
                </div>
              </div>
            )}
            {t.competitions.length > 0 && (
              <div className="flex items-start gap-1.5 min-w-0">
                <span className="mt-0.5 text-text-subtle"><IconTrophy /></span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider leading-none mb-0.5">Competencias</p>
                  <p className="text-xs text-text-primary">{t.competitions.length}</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-3 flex items-center justify-end gap-1 text-[11px] text-text-subtle">
            <span>Ver detalle</span>
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </div>
        </div>

        {/* ═════════════════════════ DORSO ══════════════════════════════════ */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0 rounded-xl border border-border-subtle bg-surface-1 shadow-lg shadow-black/30 flex flex-col"
        >
          {/* Header */}
          <div className="px-4 pt-3.5 pb-3 border-b border-border-subtle/60 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-text-primary truncate" title={t.name}>{t.name}</h3>
              {editionBadge ? (
                <p className="mt-0.5 text-[10px] font-medium text-brand-greenAccent truncate">{editionBadge.text}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="flex-shrink-0 flex items-center gap-0.5 text-[11px] text-text-subtle hover:text-text-primary transition-colors"
            >
              <IconChevronLeft /><span>Volver</span>
            </button>
          </div>

          {/* Competition content */}
          <div className="flex-1 px-4 py-3 min-h-0 overflow-y-auto">
            {detailLoading ? (
              <BackSkeleton />
            ) : t.competitions.length === 0 ? (
              <p className="text-sm text-text-muted">Sin competencias configuradas.</p>
            ) : currentComp ? (
              <CompetitionView
                key={`${currentComp.id}-${safeCompIndex}`}
                competition={currentComp}
                detailStages={detailStagesForComp(currentComp.id)}
              />
            ) : null}
          </div>

          {/* Dots */}
          {t.competitions.length > 1 && (
            <div className="px-4 pb-2 flex items-center justify-center gap-1.5 flex-shrink-0">
              {t.competitions.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Competencia ${i + 1}`}
                  onClick={() => setCompIndex(i)}
                  className={`transition-all rounded-full ${i === safeCompIndex ? 'w-4 h-2 bg-accent-primary' : 'w-2 h-2 bg-border-strong hover:bg-text-subtle'}`}
                />
              ))}
            </div>
          )}

          {/* CTAs */}
          <div className="px-4 pb-4 flex flex-col gap-2 flex-shrink-0">
            {inscribeError && <p className="text-[11px] text-danger-base text-center">{inscribeError}</p>}
            {onInscribe && !isOrganizer && (
              <button
                type="button"
                onClick={handleInscribe}
                disabled={inscribeLoading || inscribeSuccess}
                className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 flex items-center justify-center gap-1.5 ${
                  inscribeSuccess
                    ? 'bg-success-soft border border-success-base/30 text-success-base cursor-default'
                    : 'bg-surface-3 border border-border-strong text-text-primary hover:bg-surface-2 disabled:opacity-60 disabled:cursor-not-allowed'
                }`}
              >
                {inscribeSuccess ? (<><IconCheck /><span>Solicitud enviada</span></>) : inscribeLoading ? 'Enviando...' : 'Solicitar inscripción'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpen?.(t.id, t.name)}
              className="w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              Ver torneo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
