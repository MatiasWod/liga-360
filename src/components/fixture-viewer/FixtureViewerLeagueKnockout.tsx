import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { RoundSelector } from '../tournament-schedule/RoundSelector';
import { Button } from '../ui/Button';
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from '../tournament-schedule/matchScheduleUtils';
import {
  addEmptyMatch,
  addRound,
  findRoundContainingMatch,
  moveMatch,
  removeMatch,
  reorderWithinRound,
  updateMatch,
} from './fixtureMutations';
import type { FixtureSchedulingAssist, FixtureViewerLeagueKnockoutProps, Match, Round, Team } from './types';
import { combineDateYmdAndTime, enumerateDaysInclusive } from '../../modules/tournaments-list/useFixtureSchedulingPrefs';

const DEFAULT_SHIELD_SRC = '/predeterminado.png';

function resolveTeam(teams: Team[], id: string | null): Team | null {
  if (!id) return null;
  return teams.find((t) => t.id === id) ?? { id, name: id };
}

function TeamFace({
  teamId,
  teams,
  theme,
  size = 'md',
}: {
  teamId: string | null;
  teams: Team[];
  theme: 'light' | 'dark';
  size?: 'sm' | 'md';
}) {
  const isDark = theme === 'dark';
  const t = resolveTeam(teams, teamId);
  const badge = t?.badgeUrl;
  const src = badge && String(badge).trim() ? String(badge).trim() : DEFAULT_SHIELD_SRC;
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <span className="relative inline-flex shrink-0">
      <img
        src={src}
        alt=""
        className={`${dim} rounded-full border object-cover ${
          isDark ? 'border-white/20 bg-white/10' : 'border-slate-100 bg-white shadow-sm'
        }`}
        onError={(e) => {
          const el = e.currentTarget;
          if (el.src.endsWith(DEFAULT_SHIELD_SRC)) return;
          el.src = DEFAULT_SHIELD_SRC;
        }}
      />
    </span>
  );
}

function teamLabel(teams: Team[], id: string | null): string {
  if (!id) return '—';
  return teams.find((t) => t.id === id)?.name ?? id;
}

function formatMatchDate(date?: string): string {
  if (!date) return 'Sin horario';
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

/** Ej. "lunes, 15 de abril de 2026" */
function formatDayOptionLabel(ymd: string): string {
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return ymd;
  }
}

function datePartFromMatchIso(match: Match): string {
  const dt = isoToDatetimeLocalValue(match.date);
  if (!dt) return '';
  return dt.split('T')[0] ?? '';
}

function timePartFromMatchIso(match: Match): string {
  const dt = isoToDatetimeLocalValue(match.date);
  if (!dt || !dt.includes('T')) return '';
  return dt.split('T')[1]?.slice(0, 5) ?? '';
}

function RoundTailDrop({ roundId, disabled }: { roundId: string; disabled?: boolean }) {
  const id = `round-tail-${roundId}`;
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2.5rem] rounded-lg border border-dashed px-2 py-2 text-center text-xs transition-colors ${
        isOver ? 'border-brand-green bg-brand-green/5 text-brand-greenDark' : 'border-slate-200 text-slate-400'
      }`}
    >
      Soltar aquí al final
    </div>
  );
}

const matchCardShell = (isDark: boolean) =>
  isDark
    ? 'border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02]'
    : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm';

function ViewMatchRow({ match, teams, theme }: { match: Match; teams: Team[]; theme: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  const hasScore = match.homeScore != null && match.awayScore != null;
  const centerScore = hasScore ? (
    <span className={`text-2xl font-bold tabular-nums ${isDark ? 'text-white' : 'text-brand-dark'}`}>
      {match.homeScore} – {match.awayScore}
    </span>
  ) : match.statusLabel ? (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        isDark ? 'bg-white/10 text-white/80 ring-white/20' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      }`}
    >
      {match.statusLabel}
    </span>
  ) : (
    <span className={`text-sm font-semibold ${isDark ? 'text-white/35' : 'text-slate-400'}`}>vs</span>
  );

  return (
    <div className={`rounded-xl border px-4 py-4 ${matchCardShell(isDark)}`}>
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <TeamFace teamId={match.homeTeamId} teams={teams} theme={theme} />
          <p className={`max-w-[10rem] truncate text-center text-sm font-semibold sm:text-right ${isDark ? 'text-white' : 'text-brand-dark'}`}>
            {teamLabel(teams, match.homeTeamId)}
          </p>
        </div>
        <div className="flex justify-center">{centerScore}</div>
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <p className={`max-w-[10rem] truncate text-center text-sm font-semibold sm:text-left ${isDark ? 'text-white' : 'text-brand-dark'}`}>
            {teamLabel(teams, match.awayTeamId)}
          </p>
          <TeamFace teamId={match.awayTeamId} teams={teams} theme={theme} />
        </div>
      </div>
      <p className={`mt-3 text-center text-sm ${isDark ? 'text-white/60' : 'text-slate-500'}`}>{formatMatchDate(match.date)}</p>
    </div>
  );
}

function RoundAgendaToolbar({
  roundId,
  roundLabel,
  assist,
  theme,
}: {
  roundId: string;
  roundLabel: string;
  assist: FixtureSchedulingAssist;
  theme: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  const w = assist.getPlayWindow(roundId);
  const [timeInput, setTimeInput] = React.useState('');

  const labelCls = isDark ? 'text-white/70' : 'text-slate-600';
  const boxCls = isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-brand-dark';

  return (
    <div
      className={`mb-4 space-y-3 rounded-xl border p-4 ${
        isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-200 bg-brand-bg/80'
      }`}
    >
      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-brand-dark'}`}>
        Agenda · {roundLabel}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={`flex flex-col text-xs ${labelCls}`}>
          Desde
          <input
            type="date"
            className={`mt-1 rounded-lg border px-2 py-1.5 text-sm ${boxCls}`}
            value={w.start}
            onChange={(e) => assist.setPlayWindowForRound(roundId, e.target.value, w.end)}
          />
        </label>
        <label className={`flex flex-col text-xs ${labelCls}`}>
          Hasta
          <input
            type="date"
            className={`mt-1 rounded-lg border px-2 py-1.5 text-sm ${boxCls}`}
            value={w.end}
            onChange={(e) => assist.setPlayWindowForRound(roundId, w.start, e.target.value)}
          />
        </label>
        <p className={`max-w-xs text-[11px] ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
          Definí el rango de días de esta fecha; abajo en cada partido vas a ver atajos para elegir día y horario.
        </p>
      </div>
      <div>
        <p className={`mb-1.5 text-xs font-medium ${labelCls}`}>Horarios sugeridos (reutilizables)</p>
        <div className="flex flex-wrap items-center gap-2">
          {assist.presetTimes.map((t) => (
            <span
              key={t}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                isDark ? 'bg-white/10 text-white ring-white/20' : 'bg-white text-brand-dark ring-slate-200'
              }`}
            >
              {t}
              <button
                type="button"
                className="ml-0.5 rounded-full px-1 text-slate-400 hover:text-red-600"
                aria-label={`Quitar ${t}`}
                onClick={() => assist.removePresetTime(t)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="time"
            className={`rounded-lg border px-2 py-1 text-sm ${boxCls}`}
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            className="!py-1 !text-xs"
            onClick={() => {
              if (!timeInput) return;
              const [hh, mm] = timeInput.split(':');
              if (hh == null || mm == null) return;
              assist.addPresetTime(`${Number(hh)}:${mm}`);
              setTimeInput('');
            }}
          >
            Agregar horario
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchEditFields({
  match,
  teams,
  theme,
  saveLocked,
  scoreEditing,
  onPatch,
  quickDays,
  presetTimes,
}: {
  match: Match;
  teams: Team[];
  theme: 'light' | 'dark';
  saveLocked?: boolean;
  scoreEditing?: { canEdit: boolean; saveLocked?: boolean };
  onPatch: (patch: Partial<Match>) => void;
  quickDays: string[];
  presetTimes: string[];
}) {
  const isDark = theme === 'dark';
  const scoreFieldDisabled = Boolean(saveLocked);
  const canScores = Boolean(scoreEditing?.canEdit && !saveLocked);

  const applyLocal = (local: string) => {
    const iso = datetimeLocalValueToIso(local);
    onPatch({ date: iso ?? undefined });
  };

  const labelMuted = isDark ? 'text-white/70' : 'text-slate-600';
  const currentDateYmd = datePartFromMatchIso(match);
  const currentTimeHm = timePartFromMatchIso(match) || '18:00';

  const inputScoreCls = `w-12 rounded-xl border-2 bg-white py-2 text-center text-2xl font-bold tabular-nums shadow-inner sm:w-14 sm:text-3xl ${
    isDark ? 'border-white/25 text-white' : 'border-slate-200 text-brand-dark'
  }`;

  const displayScore =
    match.homeScore != null && match.awayScore != null ? (
      <span className={`text-2xl font-bold tabular-nums sm:text-3xl ${isDark ? 'text-white' : 'text-brand-dark'}`}>
        {match.homeScore} – {match.awayScore}
      </span>
    ) : (
      <span className={`text-sm font-semibold ${isDark ? 'text-white/35' : 'text-slate-400'}`}>vs</span>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <TeamFace teamId={match.homeTeamId} teams={teams} theme={theme} />
          <p
            className={`max-w-[11rem] truncate text-center text-sm font-semibold sm:text-right ${isDark ? 'text-white' : 'text-brand-dark'}`}
          >
            {teamLabel(teams, match.homeTeamId)}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {canScores ? (
            <>
              <input
                type="number"
                min={0}
                step={1}
                className={inputScoreCls}
                value={match.homeScore ?? ''}
                placeholder="·"
                aria-label="Goles local"
                onChange={(e) => {
                  const v = e.target.value;
                  onPatch({ homeScore: v === '' ? undefined : Number(v) });
                }}
                disabled={scoreFieldDisabled}
              />
              <span className={`select-none text-2xl font-light sm:text-3xl ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                –
              </span>
              <input
                type="number"
                min={0}
                step={1}
                className={inputScoreCls}
                value={match.awayScore ?? ''}
                placeholder="·"
                aria-label="Goles visitante"
                onChange={(e) => {
                  const v = e.target.value;
                  onPatch({ awayScore: v === '' ? undefined : Number(v) });
                }}
                disabled={scoreFieldDisabled}
              />
            </>
          ) : (
            displayScore
          )}
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <p
            className={`max-w-[11rem] truncate text-center text-sm font-semibold sm:text-left ${isDark ? 'text-white' : 'text-brand-dark'}`}
          >
            {teamLabel(teams, match.awayTeamId)}
          </p>
          <TeamFace teamId={match.awayTeamId} teams={teams} theme={theme} />
        </div>
      </div>

      {quickDays.length > 0 ? (
        <div>
          <p className={`mb-1.5 text-xs font-medium ${labelMuted}`}>Día del partido</p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            {quickDays.map((day) => {
              const selected = day === currentDateYmd;
              return (
                <Button
                  key={day}
                  type="button"
                  variant={selected ? 'primary' : 'secondary'}
                  className="!h-auto !min-h-0 !whitespace-normal !py-2 !text-left !text-xs sm:!text-sm"
                  onClick={() => {
                    applyLocal(combineDateYmdAndTime(day, currentTimeHm.includes(':') ? currentTimeHm.slice(0, 5) : '18:00'));
                  }}
                >
                  {formatDayOptionLabel(day)}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className={`flex flex-col text-xs font-medium ${labelMuted}`}>
            Fecha
            <input
              type="date"
              className={`mt-1 rounded-lg border px-3 py-2 text-sm ${
                isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-brand-dark'
              }`}
              value={currentDateYmd}
              onChange={(e) => {
                const d = e.target.value;
                if (!d) {
                  onPatch({ date: undefined });
                  return;
                }
                applyLocal(combineDateYmdAndTime(d, currentTimeHm || '18:00'));
              }}
            />
          </label>
          <label className={`flex flex-col text-xs font-medium ${labelMuted}`}>
            Hora
            <input
              type="time"
              className={`mt-1 rounded-lg border px-3 py-2 text-sm ${
                isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-brand-dark'
              }`}
              value={currentTimeHm || ''}
              onChange={(e) => {
                const t = e.target.value;
                if (!t) return;
                const dp = currentDateYmd;
                if (!dp) return;
                applyLocal(combineDateYmdAndTime(dp, t));
              }}
            />
          </label>
        </div>
      )}

      {presetTimes.length > 0 ? (
        <div>
          <p className={`mb-1 text-xs font-medium ${labelMuted}`}>Horario</p>
          <div className="flex flex-wrap gap-1.5">
            {presetTimes.map((t) => (
              <Button
                key={t}
                type="button"
                variant="secondary"
                className="!py-1 !text-xs"
                onClick={() => {
                  const datePart = currentDateYmd || quickDays[0];
                  if (!datePart) return;
                  applyLocal(combineDateYmdAndTime(datePart, t));
                }}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {match.date ? (
        <p className={`text-center text-xs ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{formatMatchDate(match.date)}</p>
      ) : null}
    </div>
  );
}

function StaticEditMatchRow({
  match,
  teams,
  theme,
  disableStructureEdit,
  scoreEditing,
  onPatch,
  onRemove,
  quickDays,
  presetTimes,
}: {
  match: Match;
  teams: Team[];
  theme: 'light' | 'dark';
  disableStructureEdit?: boolean;
  scoreEditing?: { canEdit: boolean; saveLocked?: boolean };
  onPatch: (patch: Partial<Match>) => void;
  onRemove: () => void;
  quickDays: string[];
  presetTimes: string[];
}) {
  const isDark = theme === 'dark';
  return (
    <div className={`rounded-xl border p-3 ${matchCardShell(isDark)}`}>
      {!disableStructureEdit ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" className="!py-1 !text-xs text-red-600" onClick={onRemove}>
            Quitar
          </Button>
        </div>
      ) : null}
      <MatchEditFields
        match={match}
        teams={teams}
        theme={theme}
        scoreEditing={scoreEditing}
        onPatch={onPatch}
        quickDays={quickDays}
        presetTimes={presetTimes}
      />
    </div>
  );
}

function SortableEditMatchRow({
  match,
  teams,
  theme,
  disableStructureEdit,
  scoreEditing,
  onPatch,
  onRemove,
  quickDays,
  presetTimes,
}: {
  match: Match;
  teams: Team[];
  theme: 'light' | 'dark';
  disableStructureEdit?: boolean;
  scoreEditing?: { canEdit: boolean; saveLocked?: boolean };
  onPatch: (patch: Partial<Match>) => void;
  onRemove: () => void;
  quickDays: string[];
  presetTimes: string[];
}) {
  const isDark = theme === 'dark';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border p-3 ${matchCardShell(isDark)}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className={`cursor-grab touch-none rounded px-2 py-1 text-lg active:cursor-grabbing ${
            isDark ? 'text-white/50 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'
          }`}
          aria-label="Arrastrar partido"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        {!disableStructureEdit ? (
          <Button type="button" variant="ghost" className="!py-1 !text-xs text-red-600" onClick={onRemove}>
            Quitar
          </Button>
        ) : (
          <span />
        )}
      </div>
      <MatchEditFields
        match={match}
        teams={teams}
        theme={theme}
        scoreEditing={scoreEditing}
        onPatch={onPatch}
        quickDays={quickDays}
        presetTimes={presetTimes}
      />
    </div>
  );
}

export const FixtureViewerLeagueKnockout: React.FC<FixtureViewerLeagueKnockoutProps> = ({
  mode,
  layout,
  fixture,
  teams,
  onChange,
  theme = 'light',
  className = '',
  disableDragDrop = false,
  disableStructureEdit = false,
  scoreEditing,
  schedulingAssist = null,
}) => {
  const [selectedRoundId, setSelectedRoundId] = React.useState<string | null>(() => fixture[0]?.id ?? null);

  React.useEffect(() => {
    if (fixture.some((r) => r.id === selectedRoundId)) return;
    setSelectedRoundId(fixture[0]?.id ?? null);
  }, [fixture, selectedRoundId]);

  const selectedRound = fixture.find((r) => r.id === selectedRoundId) ?? fixture[0];
  const selectedRoundIndex = Math.max(
    0,
    fixture.findIndex((r) => r.id === selectedRound?.id)
  );
  const isDark = theme === 'dark';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      if (mode !== 'edit' || !onChange || disableDragDrop) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      const sr = fixture[selectedRoundIndex];
      if (!sr) return;

      const from = findRoundContainingMatch(fixture, activeId);
      if (!from || from.roundIndex !== selectedRoundIndex) return;

      const overIsTail = overId.startsWith('round-tail-');
      if (overIsTail) {
        const tailRid = overId.slice('round-tail-'.length);
        if (tailRid !== sr.id) return;
        onChange(moveMatch(fixture, activeId, overId));
        return;
      }

      onChange(reorderWithinRound(fixture, sr.id, activeId, overId));
    },
    [fixture, mode, onChange, disableDragDrop, selectedRoundIndex]
  );

  const roundsNav = fixture.map((r) => ({ id: r.id, label: r.name }));

  const playWindow = schedulingAssist && selectedRound ? schedulingAssist.getPlayWindow(selectedRound.id) : { start: '', end: '' };
  const quickDays = schedulingAssist ? enumerateDaysInclusive(playWindow.start, playWindow.end) : [];

  const renderEditMatchRow = (m: Match) => {
    const patch = (p: Partial<Match>) => onChange?.(updateMatch(fixture, m.id, p));
    const common = {
      key: m.id,
      match: m,
      teams,
      theme,
      disableStructureEdit,
      scoreEditing,
      onPatch: patch,
      onRemove: () => onChange?.(removeMatch(fixture, m.id)),
      quickDays,
      presetTimes: schedulingAssist?.presetTimes ?? [],
    };
    if (disableDragDrop) return <StaticEditMatchRow {...common} />;
    return <SortableEditMatchRow {...common} />;
  };

  const tabbedEditInner = selectedRound ? (
    <>
      {schedulingAssist && mode === 'edit' ? (
        <RoundAgendaToolbar
          roundId={selectedRound.id}
          roundLabel={selectedRound.name}
          assist={schedulingAssist}
          theme={theme}
        />
      ) : null}
      {disableDragDrop ? (
        <div className="space-y-3">{selectedRound.matches.map((m) => renderEditMatchRow(m))}</div>
      ) : (
        <SortableContext items={selectedRound.matches.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {selectedRound.matches.map((m) => renderEditMatchRow(m))}
            <RoundTailDrop roundId={selectedRound.id} />
          </div>
        </SortableContext>
      )}
    </>
  ) : null;

  const editToolbar =
    mode === 'edit' && onChange && !disableStructureEdit ? (
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" className="!text-xs" onClick={() => onChange(addRound(fixture))}>
          + Fecha / ronda
        </Button>
        {selectedRound ? (
          <Button
            type="button"
            variant="secondary"
            className="!text-xs"
            onClick={() => onChange(addEmptyMatch(fixture, selectedRound.id))}
          >
            + Partido en esta fecha
          </Button>
        ) : null}
      </div>
    ) : null;

  const editTabbedBlock = (
    <>
      {editToolbar}
      {fixture.length > 1 ? (
        <RoundSelector rounds={roundsNav} selectedId={selectedRoundId} onChange={setSelectedRoundId} theme={theme} className="mb-4" />
      ) : selectedRound ? (
        <h3 className={`mb-3 text-sm font-semibold ${isDark ? 'text-white' : 'text-brand-dark'}`}>{selectedRound.name}</h3>
      ) : null}
      {disableDragDrop ? (
        <div>{tabbedEditInner}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {tabbedEditInner}
        </DndContext>
      )}
    </>
  );

  const viewBody = (
    <div className={layout === 'knockout' ? 'flex gap-4 overflow-x-auto pb-2' : 'space-y-8'}>
      {layout === 'knockout'
        ? fixture.map((round) => (
            <div
              key={round.id}
              className={`w-[min(100%,280px)] shrink-0 rounded-xl border p-3 ${
                isDark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <h4 className={`mb-3 text-center text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                {round.name}
              </h4>
              <div className="space-y-2">
                {round.matches.map((m) => (
                  <ViewMatchRow key={m.id} match={m} teams={teams} theme={theme} />
                ))}
              </div>
            </div>
          ))
        : fixture.map((round) => (
            <section key={round.id}>
              <h3 className={`mb-3 text-sm font-semibold ${isDark ? 'text-white' : 'text-brand-dark'}`}>{round.name}</h3>
              <div className="space-y-2">
                {round.matches.map((m) => (
                  <ViewMatchRow key={m.id} match={m} teams={teams} theme={theme} />
                ))}
              </div>
            </section>
          ))}
    </div>
  );

  const leagueTabsAndList = (
    <>
      {fixture.length > 1 ? (
        <RoundSelector rounds={roundsNav} selectedId={selectedRoundId} onChange={setSelectedRoundId} theme={theme} className="mb-4" />
      ) : null}
      <div className="space-y-2">
        {(selectedRound?.matches ?? []).map((m) => (
          <ViewMatchRow key={m.id} match={m} teams={teams} theme={theme} />
        ))}
        {selectedRound && selectedRound.matches.length === 0 ? (
          <p className={`text-center text-sm ${isDark ? 'text-white/45' : 'text-slate-400'}`}>No hay partidos en esta fecha.</p>
        ) : null}
      </div>
    </>
  );

  if (fixture.length === 0) {
    return (
      <div className={`fixture-viewer ${className}`}>
        <p className={`mb-3 text-center text-sm ${isDark ? 'text-white/55' : 'text-slate-500'}`}>No hay fechas en el fixture.</p>
        {mode === 'edit' && onChange && !disableStructureEdit ? (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => onChange(addRound([]))}>
              Crear primera fecha
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`fixture-viewer ${className}`}>
      {mode === 'view' ? (
        layout === 'league' ? (
          <div className={isDark ? 'text-white' : ''}>{leagueTabsAndList}</div>
        ) : (
          <div className={isDark ? 'text-white' : ''}>{viewBody}</div>
        )
      ) : (
        <div className={isDark ? 'text-white' : ''}>{editTabbedBlock}</div>
      )}
    </div>
  );
};
