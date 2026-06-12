import React from 'react';
import {
  EMPTY_TENNIS_SET_ROWS,
  saveTennisScore,
  tennisSetsToFormRows,
  type TennisSetInput,
} from '../../services/matchEvents/tennisScore';
import { listMatchEvents } from '../../services/matchEvents/matchEvents';
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
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const effectiveStatus =
        status === 'scheduled' &&
        sets.some((row) => row.homeGames !== '' && row.awayGames !== '')
          ? 'completed'
          : status;
      await saveTennisScore(matchId, {
        tournament_id: tournamentId,
        competition_id: competitionId ?? null,
        status: effectiveStatus,
        sets,
      });
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
        <div className="space-y-3">
          {sets.map((row, index) => (
            <div key={row.setNumber} className="rounded-lg border border-border-subtle bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold text-text-secondary">Set {row.setNumber}</p>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label className="block truncate text-xs text-text-muted" title={homeDisplayName}>
                    {homeDisplayName}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.homeGames}
                    onChange={(e) => updateSet(index, 'homeGames', e.target.value)}
                    placeholder="—"
                    className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-center text-sm font-semibold text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                  />
                </div>
                <span className="mb-2 text-sm font-semibold text-text-muted">–</span>
                <div className="flex-1 space-y-1">
                  <label className="block truncate text-xs text-text-muted" title={awayDisplayName}>
                    {awayDisplayName}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.awayGames}
                    onChange={(e) => updateSet(index, 'awayGames', e.target.value)}
                    placeholder="—"
                    className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-center text-sm font-semibold text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                  />
                </div>
              </div>
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
