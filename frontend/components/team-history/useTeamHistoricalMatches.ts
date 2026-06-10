import React from 'react';
import { listTeamInscriptions, type TeamInscriptionItem } from '../../services/inscriptions/teamInscriptions';
import { getMatchesByInscriptionIds, type HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';
import { isPhysicalInscriptionId } from './historicalTotals';
import { dedupeHistoricalMatches } from '../../modules/team-presences/matchDedupe';

export interface TeamHistoricalData {
  inscriptions: TeamInscriptionItem[];
  inscriptionIds: number[];
  matches: HistoricalMatchRow[];
}

export function useTeamHistoricalMatches(teamId: number | null | undefined) {
  const [data, setData] = React.useState<TeamHistoricalData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (teamId == null || Number(teamId) <= 0) {
      setData(null);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    listTeamInscriptions(Number(teamId))
      .then(async (inscriptions) => {
        const physical = inscriptions.filter((i) => isPhysicalInscriptionId(i.id));
        // Una inscripción por torneo (evita doble conteo si hubo re-seed duplicado).
        const byTournament = new Map<string, (typeof physical)[number]>();
        for (const ins of physical) {
          const key = String(ins.tournament_id || '');
          const prev = byTournament.get(key);
          if (!prev || Number(ins.id) < Number(prev.id)) byTournament.set(key, ins);
        }
        const uniqueInscriptions = [...byTournament.values()];
        const inscriptionIds = uniqueInscriptions.map((i) => Number(i.id)).filter((n) => n > 0);
        const rawMatches = inscriptionIds.length
          ? await getMatchesByInscriptionIds(inscriptionIds)
          : [];
        const matches = dedupeHistoricalMatches(rawMatches);
        return { inscriptions: uniqueInscriptions, inscriptionIds, matches };
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { data, loading, error };
}
