import React from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { claimGeneralInvite, claimTeamInvite, getInviteByToken } from '../services/inscriptionsApi';

interface InviteLandingPageProps {
  token: string;
  isAuthenticated: boolean;
  pendingClaimMode?: 'general_with_account' | 'team_claim' | null;
  onRequireAuth: (mode: 'general_with_account' | 'team_claim') => void;
  onConsumePendingClaim: () => void;
  onExit: () => void;
}

type TournamentSummary = {
  id: string;
  name: string;
  organizer?: string | null;
  venue?: string | null;
  participantType?: string | null;
};

export const InviteLandingPage: React.FC<InviteLandingPageProps> = ({
  token,
  isAuthenticated,
  pendingClaimMode = null,
  onRequireAuth,
  onConsumePendingClaim,
  onExit,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [tournament, setTournament] = React.useState<TournamentSummary | null>(null);
  const [inviteType, setInviteType] = React.useState<'general' | 'team'>('general');
  const [targetTeamName, setTargetTeamName] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const invite = await getInviteByToken(token);
        const query = `
          query($id: ID!) {
            tournament(id: $id) { id name organizer venue participantType }
          }
        `;
        const res = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id: invite.tournamentId } }),
        });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors?.[0]?.message || 'No se pudo cargar el torneo');
        setTournament(json.data?.tournament || null);
        setInviteType((invite.inviteType || 'general') as 'general' | 'team');
        setTargetTeamName(invite.target?.display_name || '');
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar la invitación');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  React.useEffect(() => {
    if (!isAuthenticated || !pendingClaimMode) return;
    (async () => {
      setError('');
      try {
        if (pendingClaimMode === 'general_with_account') {
          await claimGeneralInvite(token, { mode: 'with_account' });
          setSuccess('Invitación general asociada correctamente con tu cuenta de equipo.');
        } else if (pendingClaimMode === 'team_claim') {
          await claimTeamInvite(token);
          setSuccess('Invitación por equipo asociada correctamente.');
        }
      } catch (err: any) {
        setError(err?.message || 'No se pudo completar la asociación pendiente.');
      } finally {
        onConsumePendingClaim();
      }
    })();
  }, [isAuthenticated, pendingClaimMode, token, onConsumePendingClaim]);

  if (loading) return <Card>Cargando invitación...</Card>;
  if (error) return <Card>{error}</Card>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Card>
        <h1 className="text-2xl font-semibold text-[#0F2A33]">Invitación al torneo</h1>
        <p className="mt-2 text-sm text-slate-600">
          {tournament?.name || `Torneo #${token.slice(0, 8)}`} {tournament?.organizer ? `• Organiza: ${tournament.organizer}` : ''}
        </p>
        <p className="text-sm text-slate-600">
          {tournament?.venue ? `Sede: ${tournament.venue}` : 'Sede no definida'} • Participantes: {tournament?.participantType || 'N/D'}
        </p>
      </Card>

      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card>
        <h2 className="text-lg font-semibold text-[#0F2A33]">Elegí cómo continuar</h2>
        {inviteType === 'general' && (
          <>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Inscribir sin cuenta</h3>
              <form
                className="flex flex-col gap-3 md:flex-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!displayName.trim()) return;
                  setError('');
                  try {
                    await claimGeneralInvite(token, {
                      mode: 'without_account',
                      displayName: displayName.trim(),
                    });
                    setSuccess('Equipo inscripto correctamente sin cuenta.');
                    setDisplayName('');
                  } catch (err: any) {
                    setError(err?.message || 'No se pudo completar la inscripción');
                  }
                }}
              >
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nombre del equipo"
                  required
                />
                <Button type="submit">Inscribir sin cuenta</Button>
              </form>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Inscribir con cuenta de equipo</h3>
              {!isAuthenticated ? (
                <Button type="button" onClick={() => onRequireAuth('general_with_account')}>
                  Iniciar sesión / Registrarme
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    setError('');
                    try {
                      await claimGeneralInvite(token, { mode: 'with_account' });
                      setSuccess('Invitación general asociada correctamente con tu cuenta de equipo.');
                    } catch (err: any) {
                      setError(err?.message || 'No se pudo asociar con cuenta');
                    }
                  }}
                >
                  Asociar con mi cuenta de equipo
                </Button>
              )}
            </div>
          </>
        )}

        {inviteType === 'team' && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Invitación por equipo</h3>
            <p className="text-sm text-slate-600">
              Debes asociar esta invitación con una cuenta de tipo equipo.
              {targetTeamName ? ` Equipo objetivo: ${targetTeamName}.` : ''}
            </p>
            {!isAuthenticated ? (
              <Button type="button" onClick={() => onRequireAuth('team_claim')}>
                Iniciar sesión / Registrarme
              </Button>
            ) : (
              <Button
                type="button"
                onClick={async () => {
                  setError('');
                  try {
                    await claimTeamInvite(token);
                    setSuccess('Invitación por equipo asociada correctamente.');
                  } catch (err: any) {
                    setError(err?.message || 'No se pudo asociar la invitación por equipo');
                  }
                }}
              >
                Asociar este equipo con mi cuenta
              </Button>
            )}
          </div>
        )}
      </Card>

      <Button type="button" variant="ghost" onClick={onExit}>Volver al inicio</Button>
    </div>
  );
};

