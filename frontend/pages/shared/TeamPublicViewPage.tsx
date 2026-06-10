import React from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TeamMembersSection } from '../../components/team/TeamMembersSection';
import { TeamHistorySection } from '../../components/team-history/TeamHistorySection';
import { getTeamDetail } from '../../services/teamsApi';
import type { TeamInfo, TeamParticipant } from '../../types/domain';

interface TeamPublicViewPageProps {
  teamId: string;
  onBack: () => void;
}

/**
 * Vista de un equipo para cualquier usuario logueado: plantel (solo lectura)
 * y estadísticas históricas. Se llega desde cualquier nombre de equipo clickeable.
 */
export const TeamPublicViewPage: React.FC<TeamPublicViewPageProps> = ({ teamId, onBack }) => {
  const [team, setTeam] = React.useState<TeamInfo | null>(null);
  const [participants, setParticipants] = React.useState<TeamParticipant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');

  const filteredParticipants = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.nickname} ${p.dni}`.toLowerCase().includes(q),
    );
  }, [participants, search]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setTeam(null);
      setParticipants([]);
      try {
        const detail = await getTeamDetail(teamId);
        if (cancelled) return;
        setTeam(detail.team);
        setParticipants(detail.participants);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el equipo');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="secondary" onClick={onBack}>
          ← Volver
        </Button>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-text-muted">Cargando equipo…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      ) : team ? (
        <>
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={team.name} imageUrl={team.badgeUrl || undefined} size="xl" />
              <div>
                <h1 className="text-2xl font-semibold text-text-primary">{team.name}</h1>
                <p className="text-sm text-text-muted">
                  {participants.length} integrante{participants.length === 1 ? '' : 's'} en el plantel
                </p>
              </div>
            </div>
          </Card>

          <TeamMembersSection
            participants={filteredParticipants}
            search={search}
            onSearchChange={setSearch}
            onOpenCreateModal={() => undefined}
            onEditParticipant={() => undefined}
            onRemoveParticipant={() => undefined}
            readOnly
          />

          <TeamHistorySection teamId={Number(teamId)} teamName={team.name} />
        </>
      ) : null}
    </div>
  );
};
