import React from 'react';
import {
  getCardStats,
  getScorerStats,
  getTeamStats,
  type CardStatsRow,
  type ScorerStatsRow,
  type TeamStatsRow,
} from '../../../services/matchEvents/stats';
import type { SportScoreLabels } from '../sportScoreLabels';
import { resolveSportScoreLabels } from '../sportScoreLabels';
import type { TournamentCompetition } from '../types';
import { ScorersTable } from './ScorersTable';
import { CardsTable } from './CardsTable';
import { TeamStatsDetail } from './TeamStatsDetail';
import {
  aggregateCompetitionStandings,
  collectCompetitionMatchesForInscription,
  mergeTeamStats,
  type TeamStatsTableRow,
} from './teamStatsMerge';

export interface CompetitionStatsPanelProps {
  tournamentId: string;
  competition: TournamentCompetition | null;
  /** Lookup inscriptionId → nombre (Postgres + grafo) ya armado por TournamentDetail. */
  nameById: Map<string, string>;
  /** Lookup inscriptionId → imagen (escudo/avatar) ya armado por TournamentDetail. */
  imageById?: ReadonlyMap<string, string>;
  scoreLabels?: SportScoreLabels;
}

/**
 * Sección Estadísticas a nivel Competencia: goleadores, amonestados y tabla
 * por equipo (standings agregados + tarjetas mergeadas client-side, ADR-0001).
 * Lecturas públicas: funciona sin sesión.
 */
export const CompetitionStatsPanel: React.FC<CompetitionStatsPanelProps> = ({
  tournamentId,
  competition,
  nameById,
  imageById,
  scoreLabels = resolveSportScoreLabels(),
}) => {
  const competitionId = competition?.id ?? null;
  const [scorers, setScorers] = React.useState<ScorerStatsRow[]>([]);
  const [cards, setCards] = React.useState<CardStatsRow[]>([]);
  const [teamStats, setTeamStats] = React.useState<TeamStatsRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getScorerStats(tournamentId, competitionId),
      getCardStats(tournamentId, competitionId),
      getTeamStats(tournamentId, competitionId),
    ])
      .then(([s, c, ts]) => {
        if (cancelled) return;
        setScorers(s);
        setCards(c);
        setTeamStats(ts);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar estadísticas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, competitionId]);

  const teamRows: TeamStatsTableRow[] = React.useMemo(
    () => mergeTeamStats(aggregateCompetitionStandings(competition), teamStats, nameById),
    [competition, teamStats, nameById]
  );

  if (!competitionId) {
    return <p className="py-3 text-sm text-text-muted">No hay competencias en este torneo.</p>;
  }
  if (loading) return <p className="py-3 text-sm text-text-muted">Cargando estadísticas…</p>;
  if (error) return <p className="py-3 text-sm text-red-400">{error}</p>;

  const selectedTeamName = selectedTeamId
    ? teamRows.find((r) => r.inscriptionId === selectedTeamId)?.displayName ||
      nameById.get(selectedTeamId) ||
      `Equipo #${selectedTeamId}`
    : '';

  return (
    <div className="space-y-4">
      {scoreLabels.hideGoalEvents ? (
        <p className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-muted">
          En tenis el marcador son <span className="font-medium text-text-primary">sets ganados</span>. Goleadores y tarjetas no aplican.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs text-text-muted font-medium">Goleadores</p>
            <ScorersTable rows={scorers} nameById={nameById} onSelectTeam={setSelectedTeamId} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-text-muted font-medium">Amonestados y sanciones</p>
            <CardsTable rows={cards} nameById={nameById} onSelectTeam={setSelectedTeamId} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-text-muted font-medium">Tabla por {scoreLabels.entityColumn.toLowerCase()}</p>
        {teamRows.length === 0 ? (
          <p className="py-3 text-xs text-text-muted">Todavía no hay datos de {scoreLabels.entityColumn.toLowerCase()}s en esta competencia.</p>
        ) : (
          <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
            <table className="w-full text-xs text-text-primary">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="px-2 py-1 text-left font-medium">{scoreLabels.entityColumn}</th>
                  <th className="px-2 py-1 text-center font-medium w-8">PJ</th>
                  <th className="px-2 py-1 text-center font-medium w-8">PG</th>
                  <th className="px-2 py-1 text-center font-medium w-8">PE</th>
                  <th className="px-2 py-1 text-center font-medium w-8">PP</th>
                  <th className="px-2 py-1 text-center font-medium w-8" title={scoreLabels.scoreUnit}>{scoreLabels.forShort}</th>
                  <th className="px-2 py-1 text-center font-medium w-8" title={scoreLabels.scoreUnit}>{scoreLabels.againstShort}</th>
                  {!scoreLabels.hideGoalEvents ? (
                    <>
                      <th className="px-2 py-1 text-center font-medium w-10" title="Tarjetas amarillas">
                        <span className="inline-block h-2.5 w-2 rounded-[2px] bg-amber-400 align-middle" />
                      </th>
                      <th className="px-2 py-1 text-center font-medium w-10" title="Tarjetas rojas">
                        <span className="inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
                      </th>
                    </>
                  ) : null}
                  <th className="px-2 py-1 text-center font-semibold w-10">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((row) => (
                  <tr key={row.inscriptionId} className="border-b last:border-b-0 border-border-subtle">
                    <td className="px-2 py-1 font-medium truncate">
                      <button
                        type="button"
                        onClick={() => setSelectedTeamId(row.inscriptionId)}
                        className="text-left hover:text-accent-primary hover:underline transition-colors"
                      >
                        {row.displayName}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-center">{row.played}</td>
                    <td className="px-2 py-1 text-center">{row.won}</td>
                    <td className="px-2 py-1 text-center">{row.drawn}</td>
                    <td className="px-2 py-1 text-center">{row.lost}</td>
                    <td className="px-2 py-1 text-center">{row.goalsFor}</td>
                    <td className="px-2 py-1 text-center">{row.goalsAgainst}</td>
                    {!scoreLabels.hideGoalEvents ? (
                      <>
                        <td className="px-2 py-1 text-center tabular-nums">{row.yellowCards || ''}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{row.redCards || ''}</td>
                      </>
                    ) : null}
                    <td className="px-2 py-1 text-center font-bold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTeamId ? (
        <TeamStatsDetail
          tournamentId={tournamentId}
          inscriptionId={selectedTeamId}
          teamName={selectedTeamName}
          imageById={imageById}
          matches={collectCompetitionMatchesForInscription(competition, selectedTeamId)}
          onClose={() => setSelectedTeamId(null)}
        />
      ) : null}
    </div>
  );
};
