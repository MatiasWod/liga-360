import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table } from '../ui/Table';
import { FilterDropdown } from '../ui/FilterDropdown';
import { SearchField } from '../ui/SearchField';
import { getParticipantStats, type ParticipantTournamentStats } from '../../services/matchEvents/presences';
import { getEventsByInscription } from '../../services/matchEvents/stats';
import { getTournamentDetailById } from '../../services/tournamentsApi';
import { listTournamentInscriptions } from '../../services/inscriptionsApi';
import { collectMatchesForInscription, type TeamMatchItem } from '../../modules/team-presences/teamMatches';
import { matchFixtureKey } from '../../modules/team-presences/matchDedupe';
import type { TournamentEntity } from '../../modules/tournaments-list/types';
import type { MatchEvent } from '../../services/matchEvents/types';
import type { LinkedTeam, TeamParticipant } from '../../types/domain';
import {
  ALL_FILTER,
  collectTournamentFilterOptions,
  collectYearFilterOptions,
  countMyStatsMatches,
  filterMyStatsBlocks,
  formatMatchesPlayed,
  groupMyEventsByMatch,
  hasActiveMyStatsFilters,
  mergeMyStats,
  type MyStatsMatchBlock,
  type MyTotals,
} from './myStats';

const EVENT_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  goal: { label: 'Gol', variant: 'success' },
  yellow_card: { label: 'Amarilla', variant: 'warning' },
  red_card: { label: 'Roja', variant: 'danger' },
  suspension: { label: 'Suspensión', variant: 'default' },
  other_sanction: { label: 'Sanción', variant: 'default' },
};

const KPI_ITEMS: { key: keyof MyTotals; label: string; help: string }[] = [
  {
    key: 'goals',
    label: 'Goles',
    help: 'Goles registrados con tu ficha vinculada al perfil.',
  },
  {
    key: 'yellowCards',
    label: 'Amarillas',
    help: 'Tarjetas amarillas acumuladas en todos los torneos.',
  },
  {
    key: 'redCards',
    label: 'Rojas',
    help: 'Tarjetas rojas y expulsiones directas.',
  },
  {
    key: 'matchesPlayed',
    label: 'Presencias (PJ)',
    help: 'Partidos donde el equipo cargó tu presencia. "—" significa que aún no hay registro.',
  },
];

interface TeamTournamentBlock extends MyStatsMatchBlock {
  myEventsByMatch: Map<string, MatchEvent[]>;
}

export interface MyStatsSectionProps {
  /** Participants vinculados al perfil (sus ids son linked_member_id en matchevents). */
  participants: TeamParticipant[];
  /** Equipos vinculados al perfil (para listar los partidos de sus inscripciones). */
  teams: LinkedTeam[];
}

function formatKpiValue(key: keyof MyTotals, totals: MyTotals): string {
  if (key === 'matchesPlayed') return formatMatchesPlayed(totals.matchesPlayed);
  return String(totals[key]);
}

function matchIsPlayed(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'finished';
}

function MatchRow({
  item,
  block,
  myEvents,
  showTeam,
}: {
  item: TeamMatchItem;
  block: TeamTournamentBlock;
  myEvents: MatchEvent[];
  showTeam: boolean;
}) {
  const home = item.match.homeAssignedInscription?.displayName ?? 'Por definir';
  const away = item.match.awayAssignedInscription?.displayName ?? 'Por definir';
  const played = matchIsPlayed(item.match.status);
  const year = item.match.scheduledAt
    ? new Date(item.match.scheduledAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <li className="rounded-xl border border-border-subtle bg-surface-1 p-3 transition-colors hover:border-white/20">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="font-medium text-text-primary">{block.tournamentName}</span>
        {showTeam ? (
          <>
            <span aria-hidden>·</span>
            <span>{block.teamName}</span>
          </>
        ) : null}
        {item.competitionName ? (
          <>
            <span aria-hidden>·</span>
            <span>{item.competitionName}</span>
          </>
        ) : null}
        {item.match.round != null ? (
          <>
            <span aria-hidden>·</span>
            <span>Fecha {item.match.round}</span>
          </>
        ) : null}
        {year ? (
          <>
            <span aria-hidden>·</span>
            <span>{year}</span>
          </>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="flex-1 truncate text-right font-medium text-text-primary">{home}</span>
        <span className="flex-none rounded-md bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums text-text-primary">
          {played ? `${item.match.homeScore ?? 0}–${item.match.awayScore ?? 0}` : 'vs'}
        </span>
        <span className="flex-1 truncate text-left font-medium text-text-primary">{away}</span>
      </div>
      {myEvents.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-border-subtle pt-2">
          {myEvents.map((ev) => {
            const badge = EVENT_BADGE[ev.event_type] ?? EVENT_BADGE.other_sanction;
            return (
              <li key={ev.id} className="flex items-center gap-1">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {ev.minute != null ? (
                  <span className="text-[11px] tabular-nums text-text-muted">{ev.minute}&apos;</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-text-muted">
          Sin eventos tuyos registrados en este partido.
        </p>
      )}
    </li>
  );
}

/**
 * Panel "Mis estadísticas" del perfil del participante: totales (goles,
 * tarjetas, presencias) + partidos de tus equipos con filtros y búsqueda.
 */
export const MyStatsSection: React.FC<MyStatsSectionProps> = ({ participants, teams }) => {
  const memberIds = React.useMemo(
    () => participants.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0),
    [participants]
  );
  const teamIds = React.useMemo(() => teams.map((t) => Number(t.id)).filter((n) => n > 0), [teams]);
  const teamNameById = React.useMemo(
    () => new Map(teams.map((t) => [Number(t.id), t.name])),
    [teams]
  );

  const [teamFilter, setTeamFilter] = React.useState<number | 'all'>(ALL_FILTER);
  const [tournamentFilter, setTournamentFilter] = React.useState(ALL_FILTER);
  const [yearFilter, setYearFilter] = React.useState(ALL_FILTER);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [globalTotals, setGlobalTotals] = React.useState<MyTotals | null>(null);
  const [globalByTournament, setGlobalByTournament] = React.useState<ParticipantTournamentStats[]>([]);
  const [filteredTotals, setFilteredTotals] = React.useState<MyTotals | null>(null);
  const [filteredByTournament, setFilteredByTournament] = React.useState<ParticipantTournamentStats[]>([]);
  const [blocks, setBlocks] = React.useState<TeamTournamentBlock[]>([]);

  React.useEffect(() => {
    if (memberIds.length === 0) {
      setLoading(false);
      setGlobalTotals(null);
      setGlobalByTournament([]);
      setFilteredTotals(null);
      setFilteredByTournament([]);
      setBlocks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const statsList = await Promise.all(memberIds.map((id) => getParticipantStats(id)));
        if (cancelled) return;
        const merged = mergeMyStats(statsList);
        setGlobalTotals(merged.totals);
        setGlobalByTournament(merged.byTournament);

        const filterTeamId = teamFilter === ALL_FILTER ? null : Number(teamFilter);
        if (filterTeamId != null && teamIds.includes(filterTeamId)) {
          const filteredList = await Promise.all(
            memberIds.map((id) => getParticipantStats(id, { teamId: filterTeamId }))
          );
          if (cancelled) return;
          const filteredMerged = mergeMyStats(filteredList);
          setFilteredTotals(filteredMerged.totals);
          setFilteredByTournament(filteredMerged.byTournament);
        } else {
          setFilteredTotals(null);
          setFilteredByTournament([]);
        }

        const tournamentIds = [...new Set(merged.byTournament.map((r) => r.tournamentId))];
        const blockResults = await Promise.allSettled(
          tournamentIds.flatMap((tid) =>
            teamIds.map(async (teamId): Promise<TeamTournamentBlock | null> => {
              const [tournament, inscriptions] = await Promise.all([
                getTournamentDetailById(tid) as Promise<TournamentEntity | null>,
                listTournamentInscriptions(tid),
              ]);
              const teamIns = (inscriptions as any[]).find(
                (i) =>
                  Number(i.linked_team_id || 0) === teamId &&
                  String(i.status || '').toUpperCase() !== 'RECHAZADO'
              );
              if (!teamIns) return null;
              const insId = Number(teamIns.id);
              const matches = collectMatchesForInscription(tournament, insId);
              if (matches.length === 0) return null;
              const eventsResult = await getEventsByInscription(tid, insId).catch(() => [] as MatchEvent[]);
              return {
                tournamentId: tid,
                tournamentName: tournament?.name ?? tid,
                teamId,
                teamName: teamNameById.get(teamId) || `Equipo ${teamId}`,
                matches,
                myEventsByMatch: groupMyEventsByMatch(eventsResult, memberIds),
              };
            })
          )
        );
        if (cancelled) return;
        setBlocks(
          blockResults
            .map((r) => (r.status === 'fulfilled' ? r.value : null))
            .filter((b): b is TeamTournamentBlock => b != null)
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus estadísticas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds.join(','), teamIds.join(','), teamFilter, teamNameById]);

  const showingTeamFilter = teamFilter !== ALL_FILTER;
  const displayTotals = showingTeamFilter ? filteredTotals : globalTotals;
  const displayByTournament = showingTeamFilter ? filteredByTournament : globalByTournament;

  const teamScopedBlocks =
    teamFilter === ALL_FILTER ? blocks : blocks.filter((b) => b.teamId === Number(teamFilter));

  const tournamentOptions = React.useMemo(
    () => collectTournamentFilterOptions(teamScopedBlocks),
    [teamScopedBlocks]
  );
  const yearOptions = React.useMemo(() => collectYearFilterOptions(teamScopedBlocks), [teamScopedBlocks]);

  const viewFilters = React.useMemo(
    () => ({
      teamId: teamFilter,
      tournamentId: tournamentFilter,
      year: yearFilter,
      search: searchQuery,
    }),
    [teamFilter, tournamentFilter, yearFilter, searchQuery]
  );

  const displayBlocks = React.useMemo(() => {
    const filtered = filterMyStatsBlocks(teamScopedBlocks, viewFilters);
    return filtered
      .map((fb) => {
        const full = teamScopedBlocks.find(
          (b) => b.tournamentId === fb.tournamentId && b.teamId === fb.teamId
        );
        if (!full) return null;
        return { ...full, matches: fb.matches };
      })
      .filter((b): b is TeamTournamentBlock => b != null && b.matches.length > 0);
  }, [teamScopedBlocks, viewFilters]);

  const visibleMatchCount = countMyStatsMatches(displayBlocks);
  const filtersActive = hasActiveMyStatsFilters(viewFilters);
  const filterTeamName = teamFilter === ALL_FILTER ? null : teamNameById.get(Number(teamFilter));

  const tournamentTableRows = React.useMemo(() => {
    if (tournamentFilter === ALL_FILTER) return displayByTournament;
    return displayByTournament.filter((row) => row.tournamentId === tournamentFilter);
  }, [displayByTournament, tournamentFilter]);

  function clearFilters() {
    setTeamFilter(ALL_FILTER);
    setTournamentFilter(ALL_FILTER);
    setYearFilter(ALL_FILTER);
    setSearchQuery('');
  }

  if (memberIds.length === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-text-primary">Mis estadísticas</h2>
        <p className="mt-2 text-sm text-text-muted">
          Acá verás goles, tarjetas y presencias acumuladas en los torneos donde jugás.
        </p>
        <p className="mt-3 text-sm text-text-primary">
          Todavía no vinculamos tu plantilla a este perfil.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Editá tu perfil y guardá un DNI válido para reclamar tu ficha en los equipos donde jugás.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-lg font-semibold text-text-primary">Mis estadísticas</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Resumen de tu actividad deportiva: goles y tarjetas registrados con tu ficha, más los partidos de
          tus equipos. <strong className="font-medium text-text-primary">PJ</strong> cuenta presencias cargadas
          por el club; si aparece <strong className="font-medium text-text-primary">—</strong>, ese equipo aún
          no registra presencias.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {teams.length > 0 ? (
          <FilterDropdown
            label="Equipo"
            value={teamFilter === ALL_FILTER ? ALL_FILTER : String(teamFilter)}
            onChange={(id) => setTeamFilter(id === ALL_FILTER ? ALL_FILTER : Number(id))}
            options={[
              { id: ALL_FILTER, label: 'Todos los equipos' },
              ...teams.map((t) => ({ id: String(t.id), label: t.name })),
            ]}
            placeholder="Todos los equipos"
            searchable={teams.length > 4}
          />
        ) : null}
        {tournamentOptions.length > 0 ? (
          <FilterDropdown
            label="Torneo"
            value={
              tournamentFilter === ALL_FILTER || tournamentOptions.some((o) => o.id === tournamentFilter)
                ? tournamentFilter
                : ALL_FILTER
            }
            onChange={setTournamentFilter}
            options={[{ id: ALL_FILTER, label: 'Todos los torneos' }, ...tournamentOptions]}
            placeholder="Todos los torneos"
            searchable={tournamentOptions.length > 4}
          />
        ) : null}
        {yearOptions.length > 0 ? (
          <FilterDropdown
            label="Año"
            value={
              yearFilter === ALL_FILTER || yearOptions.some((o) => o.id === yearFilter)
                ? yearFilter
                : ALL_FILTER
            }
            onChange={setYearFilter}
            options={[{ id: ALL_FILTER, label: 'Todos los años' }, ...yearOptions]}
            placeholder="Todos los años"
          />
        ) : null}
        <SearchField
          label="Buscar partido"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rival, torneo, fecha…"
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      {filtersActive ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Filtros activos:</span>
          {teamFilter !== ALL_FILTER && filterTeamName ? (
            <button
              type="button"
              onClick={() => setTeamFilter(ALL_FILTER)}
              className="inline-flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-success-base hover:bg-accent-soft/80"
            >
              {filterTeamName}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {tournamentFilter !== ALL_FILTER ? (
            <button
              type="button"
              onClick={() => setTournamentFilter(ALL_FILTER)}
              className="inline-flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-success-base hover:bg-accent-soft/80"
            >
              {tournamentOptions.find((o) => o.id === tournamentFilter)?.label ?? 'Torneo'}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {yearFilter !== ALL_FILTER ? (
            <button
              type="button"
              onClick={() => setYearFilter(ALL_FILTER)}
              className="inline-flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-success-base hover:bg-accent-soft/80"
            >
              {yearOptions.find((o) => o.id === yearFilter)?.label ?? yearFilter}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-success-base hover:bg-accent-soft/80"
            >
              &quot;{searchQuery.trim()}&quot;
              <span aria-hidden>×</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-accent-primary hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      ) : null}

      {showingTeamFilter && filterTeamName ? (
        <p className="mt-3 text-xs text-text-muted">
          Totales filtrados por <span className="font-medium text-text-primary">{filterTeamName}</span>.
        </p>
      ) : null}

      {loading && <p className="mt-4 text-sm text-text-muted">Cargando estadísticas…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && displayTotals && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {KPI_ITEMS.map((kpi) => (
              <div
                key={kpi.key}
                className="rounded-xl border border-border-subtle bg-surface-2 p-3"
                title={kpi.help}
              >
                <p className="text-xs font-medium text-text-muted">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                  {formatKpiValue(kpi.key, displayTotals)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">{kpi.help}</p>
              </div>
            ))}
          </div>

          {tournamentTableRows.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium text-text-muted">Desglose por torneo</p>
              <Table headers={['Torneo', 'PJ', 'Goles', 'Amarillas', 'Rojas']}>
                {tournamentTableRows.map((row) => {
                  const block = teamScopedBlocks.find((b) => b.tournamentId === row.tournamentId);
                  return (
                    <tr key={`${row.tournamentId}|${row.competitionId ?? ''}`}>
                      <td className="px-4 py-2.5 text-sm text-text-primary">
                        {block?.tournamentName ?? row.tournamentId}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm tabular-nums text-text-muted">
                        {formatMatchesPlayed(row.matchesPlayed)}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm font-semibold tabular-nums">
                        {row.goals}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.yellowCards}</td>
                      <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.redCards}</td>
                    </tr>
                  );
                })}
              </Table>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Partidos de tus equipos</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  Cruces donde participó tu club. Tus goles y tarjetas aparecen resaltados abajo de cada
                  resultado.
                </p>
              </div>
              {!loading && teamScopedBlocks.length > 0 ? (
                <p className="text-xs tabular-nums text-text-muted">
                  {visibleMatchCount} de {countMyStatsMatches(teamScopedBlocks)} partidos
                </p>
              ) : null}
            </div>

            {displayBlocks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
                {filtersActive
                  ? 'Ningún partido coincide con los filtros. Probá ampliar la búsqueda o limpiar filtros.'
                  : showingTeamFilter
                    ? `Todavía no hay partidos registrados para ${filterTeamName || 'este equipo'}.`
                    : 'Todavía no hay partidos registrados para tus equipos.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {displayBlocks.flatMap((block) =>
                  block.matches.map((item) => (
                    <MatchRow
                      key={matchFixtureKey(item.match)}
                      item={item}
                      block={block}
                      myEvents={block.myEventsByMatch.get(item.match.id) ?? []}
                      showTeam={teamFilter === ALL_FILTER}
                    />
                  ))
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
