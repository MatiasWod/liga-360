import React from 'react';
import { Card } from '../../components/ui/Card';
import { TeamHistorySection } from '../../components/team-history/TeamHistorySection';
import { acceptMyTeamInvite, listMyTeamInvites, rejectMyTeamInvite } from '../../services/inscriptionsApi';
import { enrichInvitesWithTournamentData } from '../../services/tournamentsApi';
import type { TeamInfo, TeamParticipant } from '../../types/domain';

interface TeamHomePageProps {
  team: TeamInfo | null;
  participants: TeamParticipant[];
  tournamentsCount: number;
}

export const TeamHomePage: React.FC<TeamHomePageProps> = ({
  team,
  participants,
  tournamentsCount,
}) => {
  const [invites, setInvites] = React.useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = React.useState(false);
  const [inviteError, setInviteError] = React.useState('');

  async function loadInvites() {
    setLoadingInvites(true);
    setInviteError('');
    try {
      const data = await listMyTeamInvites();
      const rawInvites = data?.invites || [];
      const enrichedInvites = await enrichInvitesWithTournamentData(rawInvites);
      setInvites(enrichedInvites);
    } catch (e: any) {
      setInviteError(e?.message || 'No se pudieron cargar invitaciones');
    } finally {
      setLoadingInvites(false);
    }
  }

  React.useEffect(() => {
    if (!team) return;
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  return (
    <div className="space-y-4">
      {!team && (
        <Card>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard de equipo</h1>
          <p className="mt-2 text-sm text-text-muted">
            Todavia no hay un equipo activo. Este panel muestra resumen de plantilla y torneos cuando exista uno.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Equipo activo</h2>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{team?.name || 'Sin equipo'}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Integrantes</h2>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{participants.length}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Torneos vinculados</h2>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{tournamentsCount}</p>
        </Card>
      </div>

      {team?.id ? (
        <TeamHistorySection teamId={Number(team.id)} teamName={team.name} />
      ) : null}

      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Código único de invitación del equipo</h2>
        <p className="mt-2 text-2xl font-semibold text-text-primary">{team?.inviteCode || 'No disponible'}</p>
        <p className="mt-1 text-xs text-text-muted">Compartí este código para recibir invitaciones dirigidas.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">Invitaciones recibidas</h2>
          <button
            type="button"
            onClick={loadInvites}
            className="rounded-md border border-border-subtle px-2 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text-primary"
          >
            Refrescar
          </button>
        </div>
        {loadingInvites && <p className="mt-2 text-sm text-text-muted">Cargando invitaciones...</p>}
        {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
        {!loadingInvites && !inviteError && invites.length === 0 && (
          <p className="mt-2 text-sm text-text-muted">No tenés invitaciones.</p>
        )}
        <div className="mt-3 space-y-2">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-border-subtle bg-surface-1 p-3">
              <p className="text-sm font-medium text-text-primary">
                {invite.competition_name || invite.competition_id
                  ? `Invitación a competición: ${invite.competition_name || invite.competition_id}`
                  : 'Invitación al torneo'}
              </p>
              <p className="text-xs text-text-muted">
                Torneo: {invite.tournament_name || invite.tournament_id}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Estado:{' '}
                {invite.view_status === 'en_curso'
                  ? 'En curso'
                  : invite.view_status === 'aceptada'
                    ? 'Aceptada'
                    : 'Rechazada'}
              </p>
              {invite.view_status === 'en_curso' ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                    onClick={async () => {
                      await acceptMyTeamInvite(Number(invite.id));
                      await loadInvites();
                    }}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-2"
                    onClick={async () => {
                      await rejectMyTeamInvite(Number(invite.id));
                      await loadInvites();
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
