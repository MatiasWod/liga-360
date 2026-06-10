import React from 'react';
import { Card } from '../ui/Card';
import { FilterDropdown } from '../ui/FilterDropdown';
import { SearchField } from '../ui/SearchField';
import { Badge } from '../ui/Badge';
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
import { TeamHistoryKpiGrid } from './TeamHistoryKpiGrid';
import { useTeamHistoricalMatches, type TeamHistoricalData } from './useTeamHistoricalMatches';

const EVENT_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  goal: { label: 'Gol', variant: 'success' },
  yellow_card: { label: 'Amarilla', variant: 'warning' },
  red_card: { label: 'Roja', variant: 'danger' },
  suspension: { label: 'Suspensión', variant: 'default' },
  other_sanction: { label: 'Sanción', variant: 'default' },
};

interface RivalOption {
  teamId: number;
  name: string;
}

function formatMatchScore(homeScore: number | null | undefined, awayScore: number | null | undefined): string {
  return `${homeScore ?? 0}–${awayScore ?? 0}`;
}

function myInscriptionIdInMatch(
  m: TeamHistoricalData['matches'][number],
  myIds: Set<number>
): number | null {
  const h = m.homeAssignedInscription?.inscriptionId;
  const a = m.awayAssignedInscription?.inscriptionId;
  if (h != null && isPhysicalInscriptionId(h) && myIds.has(Number(h))) return Number(h);
  if (a != null && isPhysicalInscriptionId(a) && myIds.has(Number(a))) return Number(a);
  return null;
}

function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message !== '[object Object]') return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

export interface HeadToHeadPanelProps {
  teamId: number;
  embedded?: boolean;
  /** Datos compartidos desde TeamHistorySection (evita doble fetch). */
  data?: TeamHistoricalData | null;
  loading?: boolean;
  error?: string;
  /** Si true, no repite la nota de filtros globales arriba. */
  skipOuterFiltersNote?: boolean;
}

/**
 * Mano a mano contra otro equipo: selector de rival, resumen W/D/L y cruces con eventos.
 */
export const HeadToHeadPanel: React.FC<HeadToHeadPanelProps> = ({
  teamId,
  embedded = false,
  data: externalData,
  loading: externalLoading,
  error: externalError,
  skipOuterFiltersNote = false,
}) => {
  const internal = useTeamHistoricalMatches(externalData !== undefined ? null : teamId);
  const data = externalData !== undefined ? externalData : internal.data;
  const loading = externalLoading ?? internal.loading;
  const error = externalError ?? internal.error;

  const [rivals, setRivals] = React.useState<RivalOption[]>([]);
  const [rivalsLoading, setRivalsLoading] = React.useState(false);
  const [rivalsError, setRivalsError] = React.useState('');
  const [selectedRivalId, setSelectedRivalId] = React.useState<string>('');
  const [matchSearch, setMatchSearch] = React.useState('');
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
        if (!cancelled) setRivalsError(formatErrorMessage(e, 'No se pudieron cargar rivales'));
      })
      .finally(() => {
        if (!cancelled) setRivalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, teamId]);

  React.useEffect(() => {
    if (rivals.length === 1 && selectedRivalId === '') {
      setSelectedRivalId(String(rivals[0].teamId));
    }
  }, [rivals, selectedRivalId]);

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

  const visibleH2hMatches = React.useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    if (!q) return h2hMatches;
    return h2hMatches.filter((m) => {
      const home = m.homeAssignedInscription?.displayName ?? '';
      const away = m.awayAssignedInscription?.displayName ?? '';
      const haystack = [
        m.tournamentName,
        m.stageName,
        home,
        away,
        m.round != null ? `fecha ${m.round}` : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [h2hMatches, matchSearch]);

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

  const selectedRivalName = rivals.find((r) => String(r.teamId) === selectedRivalId)?.name;

  const h2hKpiTotals = summary
    ? {
        played: summary.played,
        won: summary.myWins,
        drawn: summary.draws,
        lost: summary.rivalWins,
        goalsFor: summary.goalsFor,
        goalsAgainst: summary.goalsAgainst,
        points: summary.myWins * 3 + summary.draws,
      }
    : null;

  const body = (
    <>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Mano a mano</h3>
          <p className="mt-1 text-sm text-text-muted">
            Compará el historial de enfrentamientos contra un rival concreto: balance de victorias, goles y
            partidos disputados.
          </p>
        </div>
      </div>

      {skipOuterFiltersNote ? (
        <p className="mt-2 text-xs text-text-muted">
          Los filtros de torneo, año y búsqueda de arriba también aplican acá.
        </p>
      ) : null}

      {loading ? <p className="mt-3 text-sm text-text-muted">Cargando cruces…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {rivalsLoading ? <p className="mt-3 text-sm text-text-muted">Buscando rivales…</p> : null}
      {rivalsError ? <p className="mt-3 text-sm text-red-600">{rivalsError}</p> : null}

      {!loading && !error && data && data.inscriptionIds.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Este equipo todavía no tiene inscripciones registradas.</p>
      ) : null}

      {!loading && !error && data && data.inscriptionIds.length > 0 && !rivalsLoading && rivals.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border-subtle bg-surface-2/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-primary">Sin rivales vinculados todavía</p>
          <p className="mt-1 text-sm text-text-muted">
            Aparecerán equipos cuando juegues partidos finalizados contra clubes registrados en la plataforma.
          </p>
        </div>
      ) : null}

      {rivals.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FilterDropdown
            label="Rival"
            value={selectedRivalId || ''}
            onChange={setSelectedRivalId}
            options={[
              { id: '', label: '— Elegí un equipo —' },
              ...rivals.map((r) => ({ id: String(r.teamId), label: r.name })),
            ]}
            placeholder="— Elegí un equipo —"
            searchable={rivals.length > 4}
            searchPlaceholder="Buscar rival…"
            minWidthClass="min-w-full"
          />
          {selectedRivalId ? (
            <SearchField
              label="Buscar partido"
              value={matchSearch}
              onChange={setMatchSearch}
              placeholder="Torneo, fecha, resultado…"
            />
          ) : (
            <div className="flex items-end">
              <div className="w-full rounded-xl border border-dashed border-border-subtle bg-surface-2/30 px-4 py-3 text-sm text-text-muted">
                Elegí un rival para ver el balance y los partidos jugados entre ambos.
              </div>
            </div>
          )}
        </div>
      ) : null}

      {selectedRivalId !== '' && summary && h2hKpiTotals ? (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-medium text-text-muted">
            Balance vs <span className="text-text-primary">{selectedRivalName || 'rival'}</span>
          </p>
          <TeamHistoryKpiGrid totals={h2hKpiTotals} />

          {visibleH2hMatches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
              {matchSearch.trim()
                ? 'Ningún partido coincide con la búsqueda.'
                : 'Sin partidos finalizados entre ambos equipos con los filtros actuales.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleH2hMatches.map((m) => {
                const home = m.homeAssignedInscription?.displayName ?? 'Local';
                const away = m.awayAssignedInscription?.displayName ?? 'Visitante';
                const matchEvents = eventsByMatch.get(m.id) ?? [];
                const dateLabel = m.scheduledAt
                  ? new Date(m.scheduledAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : null;
                return (
                  <li
                    key={m.id}
                    className="rounded-xl border border-border-subtle bg-surface-1 p-3 transition-colors hover:border-white/20"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                      <span className="font-medium text-text-primary">{m.tournamentName || m.tournamentId}</span>
                      {m.stageName ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{m.stageName}</span>
                        </>
                      ) : null}
                      {m.round != null ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>Fecha {m.round}</span>
                        </>
                      ) : null}
                      {dateLabel ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{dateLabel}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-right font-medium text-text-primary">{home}</span>
                      <span className="flex-none rounded-md bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums text-text-primary">
                        {formatMatchScore(m.homeScore, m.awayScore)}
                      </span>
                      <span className="flex-1 truncate text-left font-medium text-text-primary">{away}</span>
                    </div>
                    {eventsLoading ? (
                      <p className="mt-2 text-[11px] text-text-muted">Cargando eventos…</p>
                    ) : matchEvents.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-border-subtle pt-2">
                        {matchEvents.map((ev) => {
                          const badge = EVENT_BADGES[ev.event_type] ?? EVENT_BADGES.other_sanction;
                          return (
                            <li key={ev.id} className="flex items-center gap-1">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                              <span className="text-[11px] text-text-primary">{ev.display_name}</span>
                              {ev.minute != null ? (
                                <span className="text-[11px] tabular-nums text-text-muted">{ev.minute}&apos;</span>
                              ) : null}
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
    </>
  );

  if (embedded) return <div>{body}</div>;
  return <Card>{body}</Card>;
};
