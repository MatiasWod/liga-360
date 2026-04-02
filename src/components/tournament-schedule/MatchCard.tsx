import React from 'react';
import { Button } from '../ui/Button';
import type { MatchFixtureEditingOptions, MatchRecord, MatchStatus, TeamRef } from './types';
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from './matchScheduleUtils';

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  completed: 'Finalizado',
  postponed: 'Aplazado',
};

const STATUS_RING: Record<MatchStatus, string> = {
  scheduled: 'ring-slate-200/80 bg-slate-50 text-slate-700',
  live: 'ring-red-200/80 bg-red-50 text-red-900',
  completed: 'ring-emerald-200/80 bg-emerald-50 text-emerald-900',
  postponed: 'ring-amber-200/80 bg-amber-50 text-amber-900',
};

const STATUS_RING_DARK: Record<MatchStatus, string> = {
  scheduled: 'ring-white/20 bg-white/10 text-white/90',
  live: 'ring-red-400/40 bg-red-500/15 text-red-100',
  completed: 'ring-emerald-400/35 bg-emerald-500/15 text-emerald-100',
  postponed: 'ring-amber-400/35 bg-amber-500/15 text-amber-100',
};

function formatDateTimeDisplay(iso?: string): string {
  if (!iso) return 'Sin fecha ni hora';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

function formatAudit(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

interface MatchCardProps {
  match: MatchRecord;
  theme?: 'light' | 'dark';
  fixtureEditing?: MatchFixtureEditingOptions | null;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, theme = 'light', fixtureEditing = null }) => {
  const isDark = theme === 'dark';
  const [datetimeLocal, setDatetimeLocal] = React.useState(() => isoToDatetimeLocalValue(match.scheduledAt));
  const [homeInput, setHomeInput] = React.useState(() => String(match.homeScore ?? ''));
  const [awayInput, setAwayInput] = React.useState(() => String(match.awayScore ?? ''));
  const [schedErr, setSchedErr] = React.useState('');
  const [resErr, setResErr] = React.useState('');
  const [savingSched, setSavingSched] = React.useState(false);
  const [savingRes, setSavingRes] = React.useState(false);

  React.useEffect(() => {
    setDatetimeLocal(isoToDatetimeLocalValue(match.scheduledAt));
    setHomeInput(String(match.homeScore ?? ''));
    setAwayInput(String(match.awayScore ?? ''));
    setSchedErr('');
    setResErr('');
  }, [match.id, match.scheduledAt, match.homeScore, match.awayScore]);

  const canInteract = Boolean(fixtureEditing && (fixtureEditing.canSchedule || fixtureEditing.canEditResults));
  const saveLocked = Boolean(fixtureEditing?.saveLocked);

  const scoreLine =
    match.status === 'completed' && match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} – ${match.awayScore}`
      : null;

  const statusRing = isDark ? STATUS_RING_DARK[match.status] : STATUS_RING[match.status];

  const shell = isDark
    ? 'border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-none'
    : 'border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm hover:shadow-md';

  /** En configuración del torneo: card ~el doble de ancho y campos siempre visibles. */
  const shellWidth = canInteract ? 'w-full max-w-5xl mx-auto' : 'w-full max-w-lg mx-auto';

  async function handleSaveSchedule() {
    if (!fixtureEditing?.canSchedule) return;
    setSchedErr('');
    const iso = datetimeLocalValueToIso(datetimeLocal);
    if (datetimeLocal.trim() && iso == null) {
      setSchedErr('Revisá la fecha y hora');
      return;
    }
    setSavingSched(true);
    try {
      await fixtureEditing.onSaveSchedule(match.id, iso);
    } catch (e) {
      setSchedErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingSched(false);
    }
  }

  async function handleClearSchedule() {
    if (!fixtureEditing?.canSchedule) return;
    setSchedErr('');
    setSavingSched(true);
    try {
      await fixtureEditing.onSaveSchedule(match.id, null);
      setDatetimeLocal('');
    } catch (e) {
      setSchedErr(e instanceof Error ? e.message : 'Error al quitar horario');
    } finally {
      setSavingSched(false);
    }
  }

  async function handleSaveResult() {
    if (!fixtureEditing?.canEditResults) return;
    setResErr('');
    const h = Number.parseInt(homeInput, 10);
    const a = Number.parseInt(awayInput, 10);
    if (!Number.isFinite(h) || h < 0 || !Number.isFinite(a) || a < 0) {
      setResErr('Marcadores enteros ≥ 0');
      return;
    }
    setSavingRes(true);
    try {
      await fixtureEditing.onSaveResult(match.id, h, a);
    } catch (e) {
      setResErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingRes(false);
    }
  }

  const busy = saveLocked || savingSched || savingRes;

  const inputCls = isDark
    ? 'border-white/20 bg-white/10 text-white placeholder:text-white/40'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-shadow sm:p-6 ${shell} ${shellWidth}`}>
      <div className={`mx-auto flex flex-col items-center text-center ${canInteract ? 'max-w-4xl' : ''}`}>
        {match.fixtureCode ? (
          <span
            className={`mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest ${
              isDark ? 'text-white/45' : 'text-slate-400'
            }`}
          >
            {match.fixtureCode}
          </span>
        ) : null}

        <div
          className={`flex w-full items-center justify-center gap-6 sm:gap-10 ${canInteract ? 'px-2 sm:px-8' : ''}`}
        >
          <TeamBlock team={match.homeTeam} side="home" theme={theme} align="right" large={canInteract} />
          <span
            className={`shrink-0 select-none text-xs font-bold uppercase tracking-widest ${
              isDark ? 'text-white/35' : 'text-slate-300'
            }`}
          >
            vs
          </span>
          <TeamBlock team={match.awayTeam} side="away" theme={theme} align="left" large={canInteract} />
        </div>

        {!canInteract || !fixtureEditing?.canSchedule ? (
          <p
            className={`mt-4 text-sm font-medium ${isDark ? 'text-white/75' : 'text-slate-600'}`}
            title={match.scheduledAt || undefined}
          >
            {formatDateTimeDisplay(match.scheduledAt)}
          </p>
        ) : null}

        <span
          className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusRing}`}
        >
          {scoreLine ?? STATUS_LABEL[match.status]}
        </span>

        {match.resultRecordedAt ? (
          <p className={`mt-2 max-w-full truncate text-[11px] ${isDark ? 'text-white/45' : 'text-slate-400'}`}>
            Resultado cargado {formatAudit(match.resultRecordedAt)}
            {match.resultRecordedBy ? ` · ${match.resultRecordedBy}` : ''}
          </p>
        ) : null}
      </div>

      {canInteract && fixtureEditing ? (
        <div
          className={`mx-auto mt-6 w-full max-w-4xl border-t pt-6 ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}
        >
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-center lg:gap-12 xl:gap-16">
            {fixtureEditing.canSchedule ? (
              <div
                className={`w-full max-w-md rounded-xl p-4 text-center lg:text-left ${
                  isDark ? 'bg-white/[0.06]' : 'bg-slate-50/90'
                }`}
              >
                <h4 className={`mb-1 text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
                  Fecha y hora
                </h4>
                <p className={`mb-3 text-center text-[11px] lg:text-left ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                  Programación del partido (independiente del marcador).
                </p>
                <input
                  type="datetime-local"
                  value={datetimeLocal}
                  onChange={(e) => setDatetimeLocal(e.target.value)}
                  disabled={busy}
                  className={`mb-3 w-full max-w-sm rounded-xl border px-3 py-2.5 text-center text-sm lg:mx-0 lg:max-w-none ${inputCls}`}
                />
                <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                  <Button type="button" className="!py-2 !text-xs" disabled={busy} onClick={() => void handleSaveSchedule()}>
                    {savingSched ? 'Guardando…' : 'Guardar horario'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!py-2 !text-xs"
                    disabled={busy}
                    onClick={() => void handleClearSchedule()}
                  >
                    Quitar horario
                  </Button>
                </div>
                {schedErr ? <p className="mt-2 text-center text-xs text-red-600 lg:text-left">{schedErr}</p> : null}
              </div>
            ) : null}

            <div
              className={`w-full max-w-md rounded-xl p-4 text-center lg:text-left ${
                isDark ? 'bg-white/[0.06]' : 'bg-slate-50/90'
              }`}
            >
              <h4 className={`mb-1 text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
                Marcador
              </h4>
              {fixtureEditing.canEditResults ? (
                <>
                  <div className="mb-3 flex flex-wrap items-end justify-center gap-4 lg:justify-start">
                    <label className={`flex flex-col items-center gap-1 text-xs lg:items-start ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                      Local
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={homeInput}
                        onChange={(e) => setHomeInput(e.target.value)}
                        disabled={busy}
                        className={`w-24 rounded-xl border py-2 text-center text-lg font-bold ${inputCls}`}
                      />
                    </label>
                    <span className={`mb-2 text-lg font-light ${isDark ? 'text-white/30' : 'text-slate-300'}`}>—</span>
                    <label className={`flex flex-col items-center gap-1 text-xs lg:items-start ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                      Visitante
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={awayInput}
                        onChange={(e) => setAwayInput(e.target.value)}
                        disabled={busy}
                        className={`w-24 rounded-xl border py-2 text-center text-lg font-bold ${inputCls}`}
                      />
                    </label>
                    <Button type="button" className="!py-2" disabled={busy} onClick={() => void handleSaveResult()}>
                      {savingRes ? 'Guardando…' : 'Guardar marcador'}
                    </Button>
                  </div>
                  {resErr ? <p className="text-center text-xs text-red-600 lg:text-left">{resErr}</p> : null}
                </>
              ) : (
                <p className={`text-center text-xs lg:text-left ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                  {fixtureEditing.canSchedule
                    ? 'Publicá el torneo para guardar el marcador. La fecha y hora la podés definir a la izquierda.'
                    : 'Publicá el torneo para guardar el marcador.'}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

function TeamBlock({
  team,
  side,
  theme = 'light',
  align,
  large = false,
}: {
  team: TeamRef;
  side: 'home' | 'away';
  theme?: 'light' | 'dark';
  align: 'left' | 'right';
  large?: boolean;
}) {
  const isDark = theme === 'dark';
  const textAlign = align === 'right' ? 'text-right' : 'text-left';
  const size = large ? 'h-12 w-12' : 'h-10 w-10';
  const initialsCls = large ? 'text-sm' : 'text-xs';
  const nameCls = large ? 'text-base sm:text-lg' : 'text-sm';
  return (
    <div className={`min-w-0 flex-1 ${textAlign}`}>
      <div className={`inline-flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
        {team.badgeUrl ? (
          <img
            src={team.badgeUrl}
            alt=""
            className={`${size} shrink-0 rounded-full object-cover ${
              isDark ? 'border border-white/20 bg-white/10' : 'border border-slate-100 bg-white shadow-sm'
            }`}
          />
        ) : (
          <span
            className={`flex ${size} shrink-0 items-center justify-center rounded-full font-bold text-white ${initialsCls} ${
              side === 'home' ? 'bg-slate-700' : 'bg-slate-500'
            }`}
          >
            {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
          </span>
        )}
        <span
          className={`line-clamp-2 font-semibold leading-tight ${nameCls} ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {team.name}
        </span>
      </div>
    </div>
  );
}
