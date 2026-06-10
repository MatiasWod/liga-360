import React from 'react';
import { getTournamentDetailById } from '../../services/tournamentsApi';
import { listTournamentInscriptions } from '../../services/inscriptionsApi';
import { getTeamDetail } from '../../services/teams/teams';
import type { TournamentEntity } from '../tournaments-list/types';
import type { TeamParticipant } from '../../types/domain';
import { collectMatchesForInscription, findTeamInscriptionId, type TeamMatchItem } from './teamMatches';
import { matchFixtureKey } from './matchDedupe';
import { MatchPresenceEditor } from './MatchPresenceEditor';

export interface TeamPresencesPanelProps {
  tournamentId: string;
  teamId: number;
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return 'Sin fecha';
  try {
    return new Date(dt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dt;
  }
}

/**
 * Panel del equipo: lista los partidos de su inscripción en el torneo
 * (con o sin fecha, ordenados por ronda) y abre el editor de presencias.
 */
export const TeamPresencesPanel: React.FC<TeamPresencesPanelProps> = ({ tournamentId, teamId }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [inscriptionId, setInscriptionId] = React.useState<number | null>(null);
  const [matches, setMatches] = React.useState<TeamMatchItem[]>([]);
  const [roster, setRoster] = React.useState<TeamParticipant[]>([]);
  const [editing, setEditing] = React.useState<TeamMatchItem | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getTournamentDetailById(tournamentId),
      listTournamentInscriptions(tournamentId),
      getTeamDetail(String(teamId)).catch(() => ({ participants: [] as TeamParticipant[] })),
    ])
      .then(([tournament, inscriptions, teamDetail]) => {
        if (cancelled) return;
        const insId = findTeamInscriptionId(inscriptions as any[], teamId);
        setInscriptionId(insId);
        setMatches(insId != null ? collectMatchesForInscription(tournament as TournamentEntity | null, insId) : []);
        setRoster(teamDetail.participants ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar los partidos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, teamId]);

  if (loading) return <p className="text-sm text-text-muted">Cargando partidos del equipo…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (inscriptionId == null) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Presencias de tu equipo</h3>
        <p className="text-xs text-text-muted">
          Marcá quiénes jugaron cada partido (antes o después de jugarlo). Solo el dueño del equipo puede cargarlas.
        </p>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-text-muted">Tu equipo todavía no tiene partidos asignados en este torneo.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((item) => {
            const home = item.match.homeAssignedInscription?.displayName ?? 'Por definir';
            const away = item.match.awayAssignedInscription?.displayName ?? 'Por definir';
            return (
              <li
                key={matchFixtureKey(item.match)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {home} vs {away}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {item.competitionName} · {item.stageName}
                    {item.match.round != null ? ` · Fecha ${item.match.round}` : ''} · {formatDate(item.match.scheduledAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="shrink-0 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                >
                  Presencias
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <MatchPresenceEditor
          matchId={editing.match.id}
          tournamentId={tournamentId}
          competitionId={editing.competitionId}
          inscriptionId={inscriptionId}
          matchLabel={`${editing.match.homeAssignedInscription?.displayName ?? 'Por definir'} vs ${editing.match.awayAssignedInscription?.displayName ?? 'Por definir'}`}
          roster={roster}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
};
