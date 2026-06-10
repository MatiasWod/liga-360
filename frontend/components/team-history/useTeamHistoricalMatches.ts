import React from 'react';
import { listTeamInscriptions, type TeamInscriptionItem } from '../../services/inscriptions/teamInscriptions';
import { getMatchesByInscriptionIds, type HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';
import { isPhysicalInscriptionId } from './historicalTotals';

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
        const inscriptionIds = physical.map((i) => Number(i.id)).filter((n) => n > 0);
        const matches = inscriptionIds.length
          ? await getMatchesByInscriptionIds(inscriptionIds)
          : [];
        return { inscriptions: physical, inscriptionIds, matches };
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
