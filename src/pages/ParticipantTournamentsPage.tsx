import React from 'react';
import { Card } from '../components/ui/Card';
import { TournamentDetail } from '../modules/tournaments-list/TournamentDetail';
import { TournamentsList } from '../modules/tournaments-list/TournamentsList';
import {
  acceptMyParticipantInvite,
  claimCompetitionByInviteCode,
  createPublicParticipantInscription,
  listTournamentInscriptions,
  listMyParticipantInvites,
  rejectMyParticipantInvite,
} from '../services/inscriptionsApi';

type InviteItem = {
  id: number;
  token: string;
  tournament_id: string;
  competition_id: string | null;
  status: string;
  invite_response_status?: string;
  tournament_name?: string | null;
  competition_name?: string | null;
  view_status?: 'en_curso' | 'aceptada' | 'rechazada';
};

export const ParticipantTournamentsPage: React.FC = () => {
  const [tab, setTab] = React.useState<'inscriptos' | 'disponibles'>('inscriptos');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [myTournamentIds, setMyTournamentIds] = React.useState<Set<string>>(new Set());
  const [loadingMyTournaments, setLoadingMyTournaments] = React.useState(false);
  const [requestLoading, setRequestLoading] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = React.useState<string | null>(null);
  const [inviteCode, setInviteCode] = React.useState('');
  const [claimLoading, setClaimLoading] = React.useState(false);
  const [claimMsg, setClaimMsg] = React.useState<string | null>(null);
  const [claimErr, setClaimErr] = React.useState<string | null>(null);
  const [invites, setInvites] = React.useState<InviteItem[]>([]);
  const [invitesLoading, setInvitesLoading] = React.useState(false);
  const [invitesErr, setInvitesErr] = React.useState<string | null>(null);

  const participantName = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('liga360:user');
      if (!raw) return 'Participante';
      const parsed = JSON.parse(raw);
      return String(parsed?.username || 'Participante');
    } catch {
      return 'Participante';
    }
  }, []);

  const participantUserId = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('liga360:user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const id = Number(parsed?.id || 0);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }, []);

  async function loadMyTournaments() {
    if (!participantUserId) {
      setMyTournamentIds(new Set());
      return;
    }
    setLoadingMyTournaments(true);
    try {
      const query = `
        query ParticipantTournamentsList {
          tournaments {
            id
          }
        }`;
      const res = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      const tournaments: Array<{ id: string }> = Array.isArray(json?.data?.tournaments) ? json.data.tournaments : [];
      const acceptedOrPendingIds = new Set<string>();
      for (const tournament of tournaments) {
        const tournamentId = String(tournament.id || '');
        if (!tournamentId) continue;
        const inscriptions = await listTournamentInscriptions(tournamentId);
        const match = inscriptions.some(
          (item) =>
            Number(item.linked_participant_user_id || 0) === Number(participantUserId) &&
            String(item.status || '').toUpperCase() !== 'RECHAZADO'
        );
        if (match) acceptedOrPendingIds.add(tournamentId);
      }
      setMyTournamentIds(acceptedOrPendingIds);
    } catch {
      setMyTournamentIds(new Set());
    } finally {
      setLoadingMyTournaments(false);
    }
  }

  async function loadInvites() {
    setInvitesLoading(true);
    setInvitesErr(null);
    try {
      const data = await listMyParticipantInvites();
      const rawInvites = (data?.invites || []) as InviteItem[];
      const tournamentIds = Array.from(
        new Set(rawInvites.map((invite) => String(invite.tournament_id || '')).filter(Boolean))
      );
      const tournamentById = new Map<string, { name: string; competitions: Array<{ id: string; name: string }> }>();

      await Promise.all(
        tournamentIds.map(async (tournamentId) => {
          const res = await fetch('http://localhost:4000/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `
                query ParticipantInviteTournament($id: ID!) {
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

      const enrichedInvites = rawInvites.map((invite) => {
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
      setInvitesErr(e?.message || 'No se pudieron cargar invitaciones');
    } finally {
      setInvitesLoading(false);
    }
  }

  React.useEffect(() => {
    loadInvites();
    loadMyTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantUserId]);

  async function handleRequestInscription() {
    if (!selectedId) {
      setRequestError('Seleccioná primero un torneo.');
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      await createPublicParticipantInscription({
        tournamentId: selectedId,
        competitionId: null,
        displayName: participantName,
      });
      setRequestSuccess('Solicitud enviada al torneo. El organizador ya la puede aprobar o rechazar en gestión general.');
    } catch (e: any) {
      setRequestError(e?.message || 'No se pudo enviar la solicitud');
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleClaimByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setClaimLoading(true);
    setClaimErr(null);
    setClaimMsg(null);
    try {
      await claimCompetitionByInviteCode(code);
      setClaimMsg('Inscripción enviada por código. Queda pendiente de aprobación del organizador.');
      setInviteCode('');
    } catch (e: any) {
      setClaimErr(e?.message || 'No se pudo usar el código de invitación');
    } finally {
      setClaimLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A33]">Torneos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Explorá torneos públicos disponibles y gestioná tus invitaciones.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setTab('inscriptos');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === 'inscriptos' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
            >
              Mis torneos
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setTab('disponibles');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === 'disponibles' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
            >
              Disponibles
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {tab === 'inscriptos' && (
          loadingMyTournaments ? (
            <p className="text-sm text-slate-500">Cargando tus torneos...</p>
          ) : selectedId ? (
            <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <TournamentsList
              participantTypeFilter="individuals"
              onOpen={(id) => setSelectedId(id)}
              idsFilter={Array.from(myTournamentIds)}
            />
          )
        )}

        {tab === 'disponibles' && (
          <div className="mb-4">
            <form onSubmit={handleClaimByCode} className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex-1">
                <span className="mb-1 block text-sm text-slate-600">Inscribirse mediante código de invitación</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Ej: A7K2P9QX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </label>
              <button
                type="submit"
                disabled={claimLoading || !inviteCode.trim()}
                className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {claimLoading ? 'Enviando...' : 'Usar código'}
              </button>
            </form>
            {claimErr && <div className="mt-2 text-sm text-red-700">{claimErr}</div>}
            {claimMsg && <div className="mt-2 text-sm text-emerald-700">{claimMsg}</div>}
          </div>
        )}

        {tab === 'disponibles' && (
          !selectedId ? (
            <TournamentsList
              inscriptionModeFilter="public"
              participantTypeFilter="individuals"
              onOpen={(id) => setSelectedId(id)}
              excludeIdsFilter={Array.from(myTournamentIds)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestInscription}
                  disabled={requestLoading}
                  className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {requestLoading ? 'Enviando...' : 'Solicitar inscripción'}
                </button>
              </div>
              {requestError && <div className="text-sm text-red-700">{requestError}</div>}
              {requestSuccess && <div className="text-sm text-emerald-700">{requestSuccess}</div>}
              <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
            </div>
          )
        )}

        {tab === 'inscriptos' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Invitaciones dirigidas recibidas por tu perfil.</p>
              <button
                type="button"
                onClick={loadInvites}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Refrescar
              </button>
            </div>
            {invitesLoading && <p className="text-sm text-slate-500">Cargando invitaciones...</p>}
            {invitesErr && <p className="text-sm text-red-700">{invitesErr}</p>}
            {!invitesLoading && !invitesErr && invites.length === 0 && (
              <p className="text-sm text-slate-500">No tenés invitaciones.</p>
            )}
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-800">
                    {invite.competition_name || invite.competition_id
                      ? `Invitación a competición: ${invite.competition_name || invite.competition_id}`
                      : 'Invitación al torneo'}
                  </p>
                  <p className="text-xs text-slate-500">Torneo: {invite.tournament_name || invite.tournament_id}</p>
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
                          await acceptMyParticipantInvite(Number(invite.id));
                          await loadInvites();
                        }}
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={async () => {
                          await rejectMyParticipantInvite(Number(invite.id));
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
          </div>
        )}
      </Card>
    </div>
  );
};

