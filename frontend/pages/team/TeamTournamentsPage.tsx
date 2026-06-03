import React from 'react';
import { Card } from '../../components/ui/Card';
import { TournamentDetail, TournamentsList } from '../../modules/tournaments-list';
import { claimCompetitionByInviteCode, createPublicTeamInscription } from '../../services/inscriptionsApi';
import { listTournamentIdsByInscriptionPredicate } from '../../services/tournamentsApi';
import { useTournamentRoute } from '../../hooks/useTournamentRoute';

interface TeamTournamentsPageProps {
  activeTeamId?: string | null;
  activeTeamName?: string | null;
}

export const TeamTournamentsPage: React.FC<TeamTournamentsPageProps> = ({ activeTeamId, activeTeamName }) => {
  const [tab, setTab] = React.useState<'inscriptos' | 'disponibles' | 'publicos'>('inscriptos');
  const [selectedId, setSelectedId] = useTournamentRoute('torneos');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [myTournamentIds, setMyTournamentIds] = React.useState<Set<string>>(new Set());
  const [loadingMyTournaments, setLoadingMyTournaments] = React.useState(false);
  const [requestLoading, setRequestLoading] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = React.useState<string | null>(null);
  const [inviteCode, setInviteCode] = React.useState('');
  const [claimLoading, setClaimLoading] = React.useState(false);
  const [claimMsg, setClaimMsg] = React.useState<string | null>(null);
  const [claimErr, setClaimErr] = React.useState<string | null>(null);

  async function handleRequestInscription() {
    if (!selectedId || !activeTeamId || !activeTeamName) {
      setRequestError('No hay equipo activo para solicitar la inscripcion.');
      return;
    }
    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      await createPublicTeamInscription({
        tournamentId: selectedId,
        competitionId: null,
        teamId: Number(activeTeamId),
        teamName: activeTeamName,
      });
      setRequestSuccess('Solicitud enviada al torneo. El organizador ya la puede aprobar o rechazar en gestión general.');
    } catch (e: any) {
      setRequestError(e?.message || 'No se pudo enviar la solicitud');
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleInscribeFromCard(tournamentId: string) {
    if (!activeTeamId || !activeTeamName) throw new Error('No hay equipo activo para inscribir.');
    await createPublicTeamInscription({
      tournamentId,
      competitionId: null,
      teamId: Number(activeTeamId),
      teamName: activeTeamName,
    });
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

  async function loadMyTournaments() {
    if (!activeTeamId) {
      setMyTournamentIds(new Set());
      return;
    }
    setLoadingMyTournaments(true);
    try {
      const acceptedOrPendingIds = await listTournamentIdsByInscriptionPredicate(
        (item) =>
          Number(item.linked_team_id || 0) === Number(activeTeamId) &&
          String(item.status || '').toUpperCase() !== 'RECHAZADO'
      );
      setMyTournamentIds(acceptedOrPendingIds);
    } catch {
      setMyTournamentIds(new Set());
    } finally {
      setLoadingMyTournaments(false);
    }
  }

  React.useEffect(() => {
    loadMyTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#0F2A33]">Torneos</h1>
              <p className="mt-1 text-sm text-slate-600">
                Explora torneos públicos y los torneos donde participa tu equipo.
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
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setTab('publicos');
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === 'publicos' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
              >
                Públicos
              </button>
            </div>
          </div>

          <label className="block md:max-w-xl">
            <span className="mb-1 block text-sm text-slate-600">Buscar torneos, organización, equipos o etapas</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej: Copa, Club Sur"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Card>

      <Card>
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
      </Card>

      <Card>
        {tab === 'inscriptos' && (
          loadingMyTournaments ? (
            <p className="text-sm text-slate-500">Cargando torneos del equipo...</p>
          ) : selectedId ? (
            <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <TournamentsList
              participantTypeFilter="teams"
              searchTerm={searchTerm}
              onOpen={(id) => setSelectedId(id)}
              idsFilter={Array.from(myTournamentIds)}
            />
          )
        )}

        {tab === 'disponibles' && (
          !selectedId ? (
            <TournamentsList
              inscriptionModeFilter="public"
              participantTypeFilter="teams"
              searchTerm={searchTerm}
              onOpen={(id) => setSelectedId(id)}
              onInscribe={handleInscribeFromCard}
              excludeIdsFilter={Array.from(myTournamentIds)}
              hideFinished
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestInscription}
                  disabled={requestLoading || !activeTeamId}
                  className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {requestLoading ? 'Enviando...' : 'Solicitar inscripción'}
                </button>
                {!activeTeamId && (
                  <span className="text-xs text-red-700">No hay equipo activo para inscribir.</span>
                )}
              </div>
              {requestError && <div className="text-sm text-red-700">{requestError}</div>}
              {requestSuccess && <div className="text-sm text-emerald-700">{requestSuccess}</div>}
              <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
            </div>
          )
        )}

        {tab === 'publicos' && (
          !selectedId ? (
            <TournamentsList
              inscriptionModeFilter="public"
              searchTerm={searchTerm}
              onOpen={(id) => setSelectedId(id)}
              hideFinished
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Vista pública en modo solo lectura.
              </div>
              <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
            </div>
          )
        )}
      </Card>
    </div>
  );
};

