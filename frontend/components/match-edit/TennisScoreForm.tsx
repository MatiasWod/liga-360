import React from 'react';
import {
  computeSetsWon,
  EMPTY_TENNIS_SET_ROWS,
  filledTennisSets,
  tennisSetsToFormRows,
  validateTennisSets,
  type TennisSetInput,
} from '../../services/matchEvents/tennisScore';
import { createMatchEvent, deleteMatchEvent, listMatchEvents } from '../../services/matchEvents/matchEvents';
import { updateMatchResult } from '../../services/tournaments/matchResult';
import type { SportScoreLabels } from '../../modules/tournaments-list/sportScoreLabels';

const MATCH_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'live', label: 'En vivo' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'postponed', label: 'Aplazado' },
];

function normalizeStatusForForm(raw: string | null | undefined): string {
  const s = (raw ?? '').toLowerCase();
  if (s === 'finished' || s === 'completed') return 'completed';
  if (s === 'live' || s === 'in_progress') return 'live';
  if (s === 'postponed') return 'postponed';
  return 'scheduled';
}

const scoreInputCls =
  'w-full rounded-lg border border-border-subtle bg-surface-1 px-2 py-2 text-center text-sm font-bold tabular-nums text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40';

export type TennisScoreFormProps = {
  matchId: string;
  tournamentId: string;
  competitionId?: string | null;
  homeDisplayName?: string;
  awayDisplayName?: string;
  initialStatus?: string | null;
  scoreLabels: SportScoreLabels;
  onSaved?: () => void | Promise<void>;
};

export const TennisScoreForm: React.FC<TennisScoreFormProps> = ({
  matchId,
  tournamentId,
  competitionId,
  homeDisplayName = 'Local',
  awayDisplayName = 'Visitante',
  initialStatus,
  scoreLabels,
  onSaved,
}) => {
  const [sets, setSets] = React.useState<TennisSetInput[]>(() => EMPTY_TENNIS_SET_ROWS.map((row) => ({ ...row })));
  const [status, setStatus] = React.useState(() => normalizeStatusForForm(initialStatus));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const events = await listMatchEvents(matchId);
        if (cancelled) return;
        setSets(tennisSetsToFormRows(events));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar sets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  function updateSet(index: number, side: 'homeGames' | 'awayGames', value: string) {
    setSets((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [side]: value === '' ? '' : Number(value),
            }
          : row
      )
    );
  }

  async function handleSave() {
    const validationMessage = validateTennisSets(sets);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const filled = filledTennisSets(sets);
      const effectiveStatus =
        status === 'scheduled' && filled.length > 0 ? 'completed' : status;

      // Los sets son eventos del partido: se reemplazan vía el CRUD genérico /events.
      // (Borrar + recrear: el form representa el set completo del partido.)
      const existing = (await listMatchEvents(matchId)).filter((e) => e.event_type === 'tennis_set');
      for (const ev of existing) {
        await deleteMatchEvent(matchId, ev.id);
      }
      for (const set of filled) {
        await createMatchEvent(matchId, {
          event_type: 'tennis_set',
          tournament_id: tournamentId,
          competition_id: competitionId ?? null,
          display_name: `Set ${set.setNumber}`,
          extra_json: { setNumber: set.setNumber, homeGames: set.homeGames, awayGames: set.awayGames },
        });
      }

      // El marcador del partido en tenis = sets ganados; se persiste en tournaments-svc.
      const setsWon = computeSetsWon(sets);
      await updateMatchResult(matchId, setsWon.home, setsWon.away, effectiveStatus);

      setSuccess(true);
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-muted">
        Ingresá <span className="font-medium text-text-primary">games por set</span> (hasta 3). {scoreLabels.scoreHint}
      </p>

      {loading ? (
        <p className="text-xs text-text-muted">Cargando sets…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
          <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 border-b border-border-subtle bg-surface-3 px-3 py-2 text-xs font-semibold text-text-secondary">
            <span className="w-10">Set</span>
            <span className="truncate text-center" title={homeDisplayName}>
              {homeDisplayName}
            </span>
            <span className="truncate text-center" title={awayDisplayName}>
              {awayDisplayName}
            </span>
          </div>
          {sets.map((row, index) => (
            <div
              key={row.setNumber}
              className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 border-b border-border-subtle/70 px-3 py-2 last:border-b-0"
            >
              <span className="w-10 text-xs font-semibold text-text-muted">S{row.setNumber}</span>
              <input
                type="number"
                min="0"
                value={row.homeGames}
                onChange={(e) => updateSet(index, 'homeGames', e.target.value)}
                placeholder="—"
                aria-label={`Games local set ${row.setNumber}`}
                className={scoreInputCls}
              />
              <input
                type="number"
                min="0"
                value={row.awayGames}
                onChange={(e) => updateSet(index, 'awayGames', e.target.value)}
                placeholder="—"
                aria-label={`Games visitante set ${row.setNumber}`}
                className={scoreInputCls}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        >
          {MATCH_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">Resultado guardado</p> : null}

      <button
        type="button"
        disabled={saving || loading}
        onClick={handleSave}
        className="w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
      >
        {saving ? 'Guardando…' : 'Guardar resultado'}
      </button>
    </div>
  );
};
