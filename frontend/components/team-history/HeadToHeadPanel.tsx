import React from 'react';
import { Card } from '../ui/Card';
import { getEventsByInscription } from '../../services/matchEvents/stats';
import type { MatchEvent } from '../../services/matchEvents/types';
import { lookupInscriptions, listTeamInscriptions } from '../../services/inscriptions/teamInscriptions';
import { lookupTeamsByIds } from '../../services/teams/teams';
import {
  computeHeadToHeadSummary,
  extractOpponentInscriptionIds,
  filterHeadToHeadMatches,
  isPhysicalInscriptionId,
} from './historicalTotals';
import { formatTotalsLine } from './formatTotals';
import { useTeamHistoricalMatches } from './useTeamHistoricalMatches';
import type { HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';

const EVENT_BADGES: Record<string, { label: string; className: string }> = {
  goal: { label: 'Gol', className: 'bg-emerald-100 text-emerald-800' },
  yellow_card: { label: 'Amarilla', className: 'bg-amber-100 text-amber-800' },
  red_card: { label: 'Roja', className: 'bg-red-100 text-red-800' },
  suspension: { label: 'Suspensión', className: 'bg-purple-100 text-purple-800' },
  other_sanction: { label: 'Sanción', className: 'bg-slate-100 text-slate-700' },
};

interface RivalOption {
  teamId: number;
  name: string;
}

function formatMatchScore(m: HistoricalMatchRow): string {
  return `${m.homeScore ?? 0}–${m.awayScore ?? 0}`;
}

function myInscriptionIdInMatch(m: HistoricalMatchRow, myIds: Set<number>): number | null {
  const h = m.homeAssignedInscription?.inscriptionId;
  const a = m.awayAssignedInscription?.inscriptionId;
  if (h != null && isPhysicalInscriptionId(h) && myIds.has(Number(h))) return Number(h);
  if (a != null && isPhysicalInscriptionId(a) && myIds.has(Number(a))) return Number(a);
  return null;
}

export interface HeadToHeadPanelProps {
  teamId: number;
}

/**
 * Mano a mano contra otro equipo: selector de rival, resumen W/D/L y cruces con eventos.
 */
export const HeadToHeadPanel: React.FC<HeadToHeadPanelProps> = ({ teamId }) => {
  const { data, loading, error } = useTeamHistoricalMatches(teamId);
  const [rivals, setRivals] = React.useState<RivalOption[]>([]);
  const [rivalsLoading, setRivalsLoading] = React.useState(false);
  const [rivalsError, setRivalsError] = React.useState('');
  const [selectedRivalId, setSelectedRivalId] = React.useState<number | ''>('');
  const [rivalInscriptionIds, setRivalInscriptionIds] = React.useState<number[]>([]);
  const [eventsByMatch, setEventsByMatch] = React.useState<Map<string, MatchEvent[]>>(new Map());
  const [eventsLoading, setEventsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!data?.inscriptionIds.length || !data.matches.length) {
      setRivals([]);
      return;
    }
    let cancelled = false;
    setRivalsLoading(true);
    setRivalsError('');
    const opponentIds = extractOpponentInscriptionIds(data.matches, data.inscriptionIds);
    lookupInscriptions(opponentIds)
      .then(async (rows) => {
        const teamIds = [
          ...new Set(
            rows
              .map((r) => r.linked_team_id)
              .filter((id): id is number => id != null && Number(id) > 0 && Number(id) !== Number(teamId))
          ),
        ];
        if (!teamIds.length) return [];
        const teams = await lookupTeamsByIds(teamIds);
        return teams
          .map((t) => ({ teamId: t.id, name: t.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
      })
      .then((options) => {
        if (!cancelled) setRivals(options);
      })
      .catch((e) => {
        if (!cancelled) setRivalsError(e instanceof Error ? e.message : 'No se pudieron cargar rivales');
      })
      .finally(() => {
        if (!cancelled) setRivalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, teamId]);

  React.useEffect(() => {
    if (selectedRivalId === '') {
      setRivalInscriptionIds([]);
      return;
    }
    let cancelled = false;
    listTeamInscriptions(Number(selectedRivalId))
      .then((rows) => {
        if (cancelled) return;
        const ids = rows.filter((r) => isPhysicalInscriptionId(r.id)).map((r) => Number(r.id));
        setRivalInscriptionIds(ids);
      })
      .catch(() => {
        if (!cancelled) setRivalInscriptionIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRivalId]);

  const h2hMatches = React.useMemo(() => {
    if (!data || !rivalInscriptionIds.length) return [];
    return filterHeadToHeadMatches(data.matches, data.inscriptionIds, rivalInscriptionIds).sort((a, b) => {
      const da = a.scheduledAt ? Date.parse(a.scheduledAt) : 0;
      const db = b.scheduledAt ? Date.parse(b.scheduledAt) : 0;
      return db - da;
    });
  }, [data, rivalInscriptionIds]);

  const summary = React.useMemo(() => {
    if (!data || !rivalInscriptionIds.length) return null;
    return computeHeadToHeadSummary(data.matches, data.inscriptionIds, rivalInscriptionIds);
  }, [data, rivalInscriptionIds]);

  React.useEffect(() => {
    if (!h2hMatches.length || !data) {
      setEventsByMatch(new Map());
      return;
    }
    let cancelled = false;
    setEventsLoading(true);
    const mySet = new Set(data.inscriptionIds);
    const pairs = new Map<string, { tournamentId: string; inscriptionId: number }>();
    for (const m of h2hMatches) {
      const insId = myInscriptionIdInMatch(m, mySet);
      const tid = m.tournamentId;
      if (insId == null || !tid) continue;
      pairs.set(`${tid}|${insId}`, { tournamentId: tid, inscriptionId: insId });
    }
    Promise.all(
      [...pairs.values()].map(({ tournamentId, inscriptionId }) =>
        getEventsByInscription(tournamentId, inscriptionId).catch(() => [] as MatchEvent[])
      )
    )
      .then((lists) => {
        if (cancelled) return;
        const map = new Map<string, MatchEvent[]>();
        for (const events of lists) {
          for (const ev of events) {
            const arr = map.get(ev.match_id) ?? [];
            arr.push(ev);
            map.set(ev.match_id, arr);
          }
        }
        setEventsByMatch(map);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [h2hMatches, data]);

  return (
    <Card>
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Mano a mano</h2>
      <p className="mt-1 text-xs text-slate-500">
        Compará enfrentamientos históricos contra otro equipo de la plataforma.
      </p>

      {loading ? <p className="mt-3 text-sm text-slate-500">Cargando cruces…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {rivalsLoading ? <p className="mt-3 text-sm text-slate-500">Buscando rivales…</p> : null}
      {rivalsError ? <p className="mt-3 text-sm text-red-700">{rivalsError}</p> : null}

      {!loading && !error && data && data.inscriptionIds.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Este equipo todavía no tiene inscripciones registradas.</p>
      ) : null}

      {!loading && !error && data && data.inscriptionIds.length > 0 && !rivalsLoading && rivals.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Sin enfrentamientos previos contra otros equipos vinculados.</p>
      ) : null}

      {rivals.length > 0 ? (
        <div className="mt-3">
          <label htmlFor="h2h-rival" className="text-xs font-medium text-slate-600">
            Elegí un rival
          </label>
          <select
            id="h2h-rival"
            className="mt-1 block w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={selectedRivalId}
            onChange={(e) => setSelectedRivalId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— Seleccionar —</option>
            {rivals.map((r) => (
              <option key={r.teamId} value={r.teamId}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedRivalId !== '' && summary ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-[#0F2A33]">
              {summary.myWins} G · {summary.draws} E · {summary.rivalWins} P
            </span>
            <span className="ml-2 text-slate-500">({formatTotalsLine(summary)})</span>
          </p>

          {h2hMatches.length === 0 ? (
            <p className="text-sm text-slate-500">Sin partidos finalizados entre ambos equipos.</p>
          ) : (
            <ul className="space-y-2">
              {h2hMatches.map((m) => {
                const home = m.homeAssignedInscription?.displayName ?? 'Local';
                const away = m.awayAssignedInscription?.displayName ?? 'Visitante';
                const matchEvents = eventsByMatch.get(m.id) ?? [];
                return (
                  <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[11px] text-slate-500">
                      {m.tournamentName || m.tournamentId}
                      {m.stageName ? ` · ${m.stageName}` : ''}
                      {m.round != null ? ` · Fecha ${m.round}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-right text-slate-800">{home}</span>
                      <span className="flex-none font-bold tabular-nums text-[#0F2A33]">{formatMatchScore(m)}</span>
                      <span className="flex-1 truncate text-left text-slate-800">{away}</span>
                    </div>
                    {eventsLoading ? (
                      <p className="mt-1 text-[11px] text-slate-400">Cargando eventos…</p>
                    ) : matchEvents.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        {matchEvents.map((ev) => {
                          const badge = EVENT_BADGES[ev.event_type] ?? EVENT_BADGES.other_sanction;
                          return (
                            <li key={ev.id} className="flex items-center gap-1.5 text-[11px]">
                              <span className={`rounded-full px-1.5 py-0.5 font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                              <span className="text-slate-700">{ev.display_name}</span>
                              {ev.minute != null ? <span className="text-slate-400">{ev.minute}&apos;</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
};
