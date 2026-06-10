import React from 'react';
import { Card } from '../ui/Card';
import { getParticipantStats, type ParticipantTournamentStats } from '../../services/matchEvents/presences';
import { getEventsByInscription } from '../../services/matchEvents/stats';
import { getTournamentDetailById } from '../../services/tournamentsApi';
import { listTournamentInscriptions } from '../../services/inscriptionsApi';
import { collectMatchesForInscription, type TeamMatchItem } from '../../modules/team-presences/teamMatches';
import type { TournamentEntity } from '../../modules/tournaments-list/types';
import type { MatchEvent } from '../../services/matchEvents/types';
import type { LinkedTeam, TeamParticipant } from '../../types/domain';
import { formatMatchesPlayed, groupMyEventsByMatch, mergeMyStats, type MyTotals } from './myStats';

const EVENT_LABELS: Record<string, string> = {
  goal: 'Gol',
  yellow_card: 'Amarilla',
  red_card: 'Roja',
  suspension: 'Suspensión',
  other_sanction: 'Sanción',
};

interface TournamentMatchesBlock {
  tournamentId: string;
  tournamentName: string;
  matches: TeamMatchItem[];
  myEventsByMatch: Map<string, MatchEvent[]>;
}

export interface MyStatsSectionProps {
  /** Participants vinculados al perfil (sus ids son linked_member_id en matchevents). */
  participants: TeamParticipant[];
  /** Equipos vinculados al perfil (para listar los partidos de sus inscripciones). */
  teams: LinkedTeam[];
}

/**
 * Panel "Mis estadísticas" del perfil del participante: totales (goles,
 * tarjetas, presencias) + "Partidos de tus equipos" con los eventos propios
 * resaltados. Etiquetado honesto: PJ "—" cuando el equipo no carga presencias.
 */
export const MyStatsSection: React.FC<MyStatsSectionProps> = ({ participants, teams }) => {
  const memberIds = React.useMemo(
    () => participants.map((p) => Number(p.id)).filter((n) => Number.isFinite(n) && n > 0),
    [participants]
  );
  const teamIds = React.useMemo(() => teams.map((t) => Number(t.id)).filter((n) => n > 0), [teams]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [totals, setTotals] = React.useState<MyTotals | null>(null);
  const [byTournament, setByTournament] = React.useState<ParticipantTournamentStats[]>([]);
  const [blocks, setBlocks] = React.useState<TournamentMatchesBlock[]>([]);

  React.useEffect(() => {
    if (memberIds.length === 0) {
      setLoading(false);
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
        setTotals(merged.totals);
        setByTournament(merged.byTournament);

        // Partidos de tus equipos: por cada torneo con actividad, inscripciones
        // de los equipos vinculados y sus partidos con mis eventos resaltados.
        const tournamentIds = [...new Set(merged.byTournament.map((r) => r.tournamentId))];
        const blockResults = await Promise.allSettled(
          tournamentIds.map(async (tid): Promise<TournamentMatchesBlock | null> => {
            const [tournament, inscriptions] = await Promise.all([
              getTournamentDetailById(tid) as Promise<TournamentEntity | null>,
              listTournamentInscriptions(tid),
            ]);
            const myInscriptions = (inscriptions as any[]).filter(
              (i) => teamIds.includes(Number(i.linked_team_id || 0)) && String(i.status || '').toUpperCase() !== 'RECHAZADO'
            );
            if (myInscriptions.length === 0) return null;
            const matches = myInscriptions.flatMap((i) =>
              collectMatchesForInscription(tournament, Number(i.id))
            );
            const eventLists = await Promise.allSettled(
              myInscriptions.map((i) => getEventsByInscription(tid, Number(i.id)))
            );
            const events = eventLists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
            return {
              tournamentId: tid,
              tournamentName: tournament?.name ?? tid,
              matches,
              myEventsByMatch: groupMyEventsByMatch(events, memberIds),
            };
          })
        );
        if (cancelled) return;
        setBlocks(
          blockResults
            .map((r) => (r.status === 'fulfilled' ? r.value : null))
            .filter((b): b is TournamentMatchesBlock => b != null && b.matches.length > 0)
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
  }, [memberIds.join(','), teamIds.join(',')]);

  if (memberIds.length === 0) return null;

  return (
    <Card>
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Mis estadísticas</h2>
      {loading && <p className="mt-2 text-sm text-slate-500">Cargando estadísticas…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!loading && !error && totals && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Goles', value: String(totals.goals) },
              { label: 'Amarillas', value: String(totals.yellowCards) },
              { label: 'Rojas', value: String(totals.redCards) },
              { label: 'Presencias', value: formatMatchesPlayed(totals.matchesPlayed) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#0F2A33]">{kpi.value}</p>
              </div>
            ))}
          </div>

          {byTournament.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1.5">Torneo</th>
                    <th className="px-2 py-1.5 text-center">PJ</th>
                    <th className="px-2 py-1.5 text-center">Goles</th>
                    <th className="px-2 py-1.5 text-center">Amarillas</th>
                    <th className="px-2 py-1.5 text-center">Rojas</th>
                  </tr>
                </thead>
                <tbody>
                  {byTournament.map((row) => {
                    const block = blocks.find((b) => b.tournamentId === row.tournamentId);
                    return (
                      <tr key={`${row.tournamentId}|${row.competitionId ?? ''}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-1.5 text-slate-800">{block?.tournamentName ?? row.tournamentId}</td>
                        <td className="px-2 py-1.5 text-center">{formatMatchesPlayed(row.matchesPlayed)}</td>
                        <td className="px-2 py-1.5 text-center">{row.goals}</td>
                        <td className="px-2 py-1.5 text-center">{row.yellowCards}</td>
                        <td className="px-2 py-1.5 text-center">{row.redCards}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Etiquetado honesto: son los partidos de los equipos, no necesariamente jugados */}
          {blocks.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0F2A33]">Partidos de tus equipos</h3>
              {blocks.map((block) => (
                <div key={block.tournamentId}>
                  <p className="text-xs font-medium text-slate-500">{block.tournamentName}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {block.matches.map((item) => {
                      const home = item.match.homeAssignedInscription?.displayName ?? 'Por definir';
                      const away = item.match.awayAssignedInscription?.displayName ?? 'Por definir';
                      const myEvents = block.myEventsByMatch.get(item.match.id) ?? [];
                      const status = String(item.match.status || '').toLowerCase();
                      const played = status === 'completed' || status === 'finished';
                      return (
                        <li key={item.match.id} className="rounded-xl border border-slate-200 px-3 py-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate text-right text-slate-800">{home}</span>
                            <span className="w-12 text-center font-semibold tabular-nums text-slate-700">
                              {played ? `${item.match.homeScore ?? 0}–${item.match.awayScore ?? 0}` : 'vs'}
                            </span>
                            <span className="flex-1 truncate text-slate-800">{away}</span>
                          </div>
                          {myEvents.length > 0 && (
                            <p className="mt-1 text-xs text-emerald-700">
                              {myEvents
                                .map((ev) => `${EVENT_LABELS[ev.event_type] ?? ev.event_type}${ev.minute != null ? ` ${ev.minute}'` : ''}`)
                                .join(' · ')}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
};
