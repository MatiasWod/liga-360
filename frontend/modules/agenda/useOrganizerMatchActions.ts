import React from 'react';
import type { MatchQuickAction } from '../../components/tournament-schedule/MatchCard';
import { bothTeamsResolvedFromSlots } from '../../components/tournament-schedule/matchParticipantUtils';
import { updateMatchResult } from '../../services/tournaments/matchResult';
import type { TournamentMatchRow } from '../tournaments-list/types';

export function useOrganizerMatchActions(
  matches: TournamentMatchRow[],
  options: {
    onRefresh: () => Promise<void>;
    setSaving?: (v: boolean) => void;
    setError?: (msg: string) => void;
    isBlocked?: boolean;
  }
) {
  const { onRefresh, setSaving, setError, isBlocked = false } = options;
  const matchById = React.useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  const handleQuickMatchAction = React.useCallback(
    async (matchId: string, action: MatchQuickAction) => {
      if (isBlocked) {
        const msg = 'Esta etapa no puede recibir resultados hasta que finalice la etapa anterior';
        setError?.(msg);
        throw new Error(msg);
      }
      const row = matchById.get(matchId);
      if (!row || !bothTeamsResolvedFromSlots(row.homeAssignedInscription, row.awayAssignedInscription)) {
        const msg = 'Asigná local y visitante antes de gestionar el partido';
        setError?.(msg);
        throw new Error(msg);
      }
      setSaving?.(true);
      setError?.('');
      try {
        if (action.type === 'start') {
          await updateMatchResult(matchId, 0, 0, 'live');
        } else if (action.type === 'save_score') {
          await updateMatchResult(matchId, action.homeScore, action.awayScore, 'live');
        } else if (action.type === 'finish') {
          await updateMatchResult(matchId, action.homeScore, action.awayScore, 'completed');
        }
        await onRefresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al guardar resultado';
        setError?.(msg);
        throw e;
      } finally {
        setSaving?.(false);
      }
    },
    [isBlocked, matchById, onRefresh, setError, setSaving]
  );

  return { handleQuickMatchAction, matchById };
}
