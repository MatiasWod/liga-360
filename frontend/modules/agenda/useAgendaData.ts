import React from 'react';
import { listTeamInscriptions } from '../../services/inscriptions/teamInscriptions';
import { listTournamentInscriptions } from '../../services/inscriptionsApi';
import { buildCompetitorImageMap } from '../../services/inscriptions/competitorImages';
import { listTournamentsGraphql } from '../../services/tournamentsApi';
import type { LinkedTeam } from '../../types/domain';
import type { TournamentEntity } from '../tournaments-list/types';
import {
  collectTeamTournamentBindings,
  findIndividualParticipantBindings,
  isPublishedTournamentStatus,
  loadTournamentsByIdsBatched,
} from './agendaLoaders';
import {
  buildOrganizerRowsFromTournament,
  buildParticipantRowsFromTournament,
  sortAgendaRows,
  type AgendaOrganizerRowData,
  type AgendaParticipantRowData,
  type AgendaRow,
} from './agendaPickers';

export type AgendaRole = 'organizer' | 'team' | 'participant';

export interface UseAgendaDataOptions {
  role: AgendaRole;
  teamId?: number | null;
  participantUserId?: number | null;
  linkedTeams?: LinkedTeam[];
  organizerName?: string;
}

function linkedTeamsKey(teams: LinkedTeam[]): string {
  return teams.map((t) => t.id).join(',');
}

export function useAgendaData({
  role,
  teamId,
  participantUserId,
  linkedTeams = [],
  organizerName = '',
}: UseAgendaDataOptions) {
  const [rows, setRows] = React.useState<AgendaRow[]>([]);
  const [tournamentsById, setTournamentsById] = React.useState<Map<string, TournamentEntity>>(new Map());
  // Imagen por inscripción (escudo/avatar) por torneo, para las tarjetas vs.
  const [imagesByTournamentId, setImagesByTournamentId] = React.useState<Map<string, Map<string, string>>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [reloadToken, setReloadToken] = React.useState(0);

  const teamIdsKey = linkedTeamsKey(linkedTeams);

  const refresh = React.useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        let participantRows: AgendaParticipantRowData[] = [];
        let organizerRows: AgendaOrganizerRowData[] = [];
        const tournamentMap = new Map<string, TournamentEntity>();

        if (role === 'team' && teamId && teamId > 0) {
          const inscriptions = await listTeamInscriptions(teamId);
          const active = inscriptions.filter(
            (i) => String(i.status || '').toUpperCase() !== 'RECHAZADO' && i.tournament_id
          );
          const tournamentIds = [...new Set(active.map((i) => String(i.tournament_id)))];
          const tournaments = await loadTournamentsByIdsBatched(tournamentIds);
          for (const t of tournaments) tournamentMap.set(t.id, t);

          for (const ins of active) {
            const t = tournaments.find((row) => row.id === String(ins.tournament_id));
            if (!t) continue;
            const insId = Number(ins.id);
            if (!Number.isFinite(insId) || insId <= 0) continue;
            participantRows.push(...buildParticipantRowsFromTournament(t, insId, 'Mi equipo'));
          }
        }

        if (role === 'participant') {
          const bindings: { tournamentId: string; inscriptionId: number; badge: string }[] = [];

          if (linkedTeams.length > 0) {
            bindings.push(...(await collectTeamTournamentBindings(linkedTeams)));
          }

          if (participantUserId && participantUserId > 0) {
            const individualBindings = await findIndividualParticipantBindings(participantUserId);
            for (const b of individualBindings) {
              bindings.push({
                tournamentId: b.tournamentId,
                inscriptionId: b.inscriptionId,
                badge: 'Individual',
              });
            }
          }

          const tournamentIds = [...new Set(bindings.map((b) => b.tournamentId))];
          const tournaments = await loadTournamentsByIdsBatched(tournamentIds);
          for (const t of tournaments) tournamentMap.set(t.id, t);

          for (const b of bindings) {
            const t = tournaments.find((row) => row.id === b.tournamentId);
            if (!t) continue;
            participantRows.push(
              ...buildParticipantRowsFromTournament(t, b.inscriptionId, b.badge)
            );
          }
        }

        if (role === 'organizer') {
          const needle = organizerName.trim().toLowerCase();
          const list = await listTournamentsGraphql();
          const mine = list.filter((t) => {
            if (!isPublishedTournamentStatus(t.status)) return false;
            if (!needle) return true;
            return String(t.organizer || '').trim().toLowerCase() === needle;
          });
          const tournaments = await loadTournamentsByIdsBatched(mine.map((t) => t.id));
          for (const t of tournaments) tournamentMap.set(t.id, t);
          organizerRows = tournaments.flatMap((t) => buildOrganizerRowsFromTournament(t));
        }

        // Imágenes de competidores por torneo (degradación: sin imágenes si falla).
        const imageEntries = await Promise.all(
          [...tournamentMap.keys()].map(async (tid) => {
            const inscriptions = await listTournamentInscriptions(tid).catch(() => []);
            return [tid, buildCompetitorImageMap(inscriptions)] as const;
          })
        );

        if (cancelled) return;
        const merged: AgendaRow[] =
          role === 'organizer' ? organizerRows : participantRows;
        setRows(sortAgendaRows(merged));
        setTournamentsById(tournamentMap);
        setImagesByTournamentId(new Map(imageEntries));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar la agenda');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, teamId, participantUserId, teamIdsKey, organizerName, reloadToken]);

  const refreshTournament = React.useCallback(
    async (tournamentId: string) => {
      const { loadTournamentDetail } = await import('./agendaLoaders');
      const t = await loadTournamentDetail(tournamentId);
      if (!t) return;
      setTournamentsById((prev) => new Map(prev).set(t.id, t));
      if (role !== 'organizer') {
        refresh();
        return;
      }
      setRows((prev) => {
        const rest = prev.filter((r) => r.tournamentId !== tournamentId);
        return sortAgendaRows([...rest, ...buildOrganizerRowsFromTournament(t)]);
      });
    },
    [role, refresh]
  );

  return { rows, tournamentsById, imagesByTournamentId, loading, error, refresh, refreshTournament };
}
