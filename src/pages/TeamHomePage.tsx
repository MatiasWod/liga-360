import React from 'react';
import { Card } from '../components/ui/Card';
import { acceptMyTeamInvite, listMyTeamInvites, rejectMyTeamInvite } from '../services/inscriptionsApi';
import type { TeamInfo, TeamParticipant } from '../types/domain';

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
      const tournamentIds = Array.from(new Set(rawInvites.map((invite: any) => String(invite.tournament_id || '')).filter(Boolean)));
      const tournamentById = new Map<string, { name: string; competitions: Array<{ id: string; name: string }> }>();
      await Promise.all(
        tournamentIds.map(async (tournamentId) => {
          const res = await fetch('http://localhost:4000/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `
                query TeamInviteTournament($id: ID!) {
                  tournament(id: $id) {
                    id
                    name
                    competitions { id name }
                  }
                }`,
              variables: { id: tournamentId },
            }),
          });
          const json = await res.json();
          const t = json?.data?.tournament;
          if (t?.id) {
            tournamentById.set(String(t.id), {
              name: String(t.name || ''),
              competitions: Array.isArray(t.competitions) ? t.competitions : [],
            });
          }
        })
      );
      const enrichedInvites = rawInvites.map((invite: any) => {
        const tournament = tournamentById.get(String(invite.tournament_id || ''));
        const competition = tournament?.competitions?.find((c) => String(c.id) === String(invite.competition_id || ''));
        const responseStatus = String(invite.invite_response_status || '').toLowerCase();
        const inviteStatus = String(invite.status || '').toLowerCase();
        let viewStatus: 'en_curso' | 'aceptada' | 'rechazada' = 'en_curso';
        if (responseStatus === 'accepted') viewStatus = 'aceptada';
        else if (responseStatus === 'rejected') viewStatus = 'rechazada';
        else if (inviteStatus !== 'active') viewStatus = 'rechazada';
        return {
          ...invite,
          tournament_name: tournament?.name || null,
          competition_name: competition?.name || null,
          view_status: viewStatus,
        };
      });
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
          <h1 className="text-2xl font-semibold text-[#0F2A33]">Dashboard de equipo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Todavia no hay un equipo activo. Este panel muestra resumen de plantilla y torneos cuando exista uno.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Equipo activo</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{team?.name || 'Sin equipo'}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Integrantes</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{participants.length}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Torneos vinculados</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{tournamentsCount}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Código único de invitación del equipo</h2>
        <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{team?.inviteCode || 'No disponible'}</p>
        <p className="mt-1 text-xs text-slate-500">Compartí este código para recibir invitaciones dirigidas.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Invitaciones recibidas</h2>
          <button
            type="button"
            onClick={loadInvites}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Refrescar
          </button>
        </div>
        {loadingInvites && <p className="mt-2 text-sm text-slate-500">Cargando invitaciones...</p>}
        {inviteError && <p className="mt-2 text-sm text-red-700">{inviteError}</p>}
        {!loadingInvites && !inviteError && invites.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">No tenés invitaciones.</p>
        )}
        <div className="mt-3 space-y-2">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">
                {invite.competition_name || invite.competition_id
                  ? `Invitación a competición: ${invite.competition_name || invite.competition_id}`
                  : 'Invitación al torneo'}
              </p>
              <p className="text-xs text-slate-500">
                Torneo: {invite.tournament_name || invite.tournament_id}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
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
                    className="rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#256628]"
                    onClick={async () => {
                      await acceptMyTeamInvite(Number(invite.id));
                      await loadInvites();
                    }}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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

