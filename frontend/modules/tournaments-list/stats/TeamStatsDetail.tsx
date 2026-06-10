import React from 'react';
import { getEventsByInscription } from '../../../services/matchEvents/stats';
import type { MatchEvent } from '../../../services/matchEvents/types';
import type { TournamentMatchRow } from '../types';

const EVENT_BADGES: Record<string, { label: string; className: string }> = {
  goal: { label: 'Gol', className: 'bg-emerald-500/20 text-emerald-300' },
  yellow_card: { label: 'Amarilla', className: 'bg-amber-500/20 text-amber-300' },
  red_card: { label: 'Roja', className: 'bg-red-500/20 text-red-300' },
  suspension: { label: 'Suspensión', className: 'bg-purple-500/20 text-purple-300' },
  other_sanction: { label: 'Sanción', className: 'bg-surface-3 text-text-secondary' },
};

export interface TeamStatsDetailProps {
  tournamentId: string;
  inscriptionId: string;
  teamName: string;
  /** Partidos de la Competencia donde juega el equipo (resultado incluido). */
  matches: TournamentMatchRow[];
  onClose: () => void;
}

/**
 * Drill-down de equipo dentro del torneo: partidos con resultado y los
 * eventos del equipo resaltados por partido. Drawer state-driven (sin rutas).
 */
export const TeamStatsDetail: React.FC<TeamStatsDetailProps> = ({
  tournamentId,
  inscriptionId,
  teamName,
  matches,
  onClose,
}) => {
  const [events, setEvents] = React.useState<MatchEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getEventsByInscription(tournamentId, Number(inscriptionId))
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar eventos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, inscriptionId]);

  const eventsByMatch = React.useMemo(() => {
    const map = new Map<string, MatchEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.match_id) ?? [];
      arr.push(ev);
      map.set(ev.match_id, arr);
    }
    return map;
  }, [events]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-1 shadow-2xl shadow-black/40">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{teamName}</h3>
            <p className="mt-0.5 text-xs text-text-muted">Partidos y eventos en el torneo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? <p className="text-xs text-text-muted">Cargando eventos…</p> : null}
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          {!loading && matches.length === 0 ? (
            <p className="text-xs text-text-muted">Este equipo todavía no tiene partidos en la competencia.</p>
          ) : null}

          {matches.map((m) => {
            const homeName = m.homeAssignedInscription?.displayName ?? 'Por definir';
            const awayName = m.awayAssignedInscription?.displayName ?? 'Por definir';
            const status = String(m.status || '').toLowerCase();
            const isPlayed = status === 'completed' || status === 'finished' || status === 'live';
            const matchEvents = eventsByMatch.get(m.id) ?? [];
            return (
              <div key={m.id} className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="flex-1 min-w-0 text-right truncate text-text-primary">{homeName}</span>
                  <span className={`flex-none w-11 text-center font-bold tabular-nums ${isPlayed ? 'text-text-primary' : 'text-text-muted font-normal'}`}>
                    {isPlayed ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : 'vs'}
                  </span>
                  <span className="flex-1 min-w-0 text-left truncate text-text-primary">{awayName}</span>
                </div>
                {matchEvents.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 border-t border-border-subtle pt-1.5">
                    {matchEvents.map((ev) => {
                      const badge = EVENT_BADGES[ev.event_type] ?? EVENT_BADGES.other_sanction;
                      return (
                        <li key={ev.id} className="flex items-center gap-1.5 text-[11px]">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="truncate text-text-primary">{ev.display_name}</span>
                          {ev.minute != null ? <span className="text-text-muted">{ev.minute}'</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
