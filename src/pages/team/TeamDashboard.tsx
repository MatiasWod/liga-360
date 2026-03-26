import React from 'react';
import type { TeamInfo, TeamParticipant } from '../../types/domain';
import { CreateParticipantModal, type CreateParticipantPayload } from '../../components/team/CreateParticipantModal';
import { TeamHeaderCard } from '../../components/team/TeamHeaderCard';
import { TeamMembersSection } from '../../components/team/TeamMembersSection';

interface TeamDashboardProps {
  team: TeamInfo | null;
  participants: TeamParticipant[];
  loading?: boolean;
  error?: string;
  onCreateParticipant: (payload: CreateParticipantPayload) => Promise<void>;
  onRemoveParticipant: (id: string) => Promise<void>;
  onRotateCode: () => Promise<void>;
  onCopyCode: () => Promise<void>;
  onEditTeam: () => Promise<void>;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  team,
  participants,
  loading = false,
  error = '',
  onCreateParticipant,
  onRemoveParticipant,
  onRotateCode,
  onCopyCode,
  onEditTeam,
}) => {
  const [search, setSearch] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);

  const filteredParticipants = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return participants;
    return participants.filter((participant) => {
      const fullName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
      return (
        fullName.includes(needle) ||
        (participant.nickname || '').toLowerCase().includes(needle) ||
        (participant.dni || '').includes(needle)
      );
    });
  }, [participants, search]);

  async function handleCreateParticipant(payload: CreateParticipantPayload) {
    await onCreateParticipant(payload);
  }

  async function handleRemoveParticipant(id: string) {
    await onRemoveParticipant(id);
  }

  function handleEditParticipant(_id: string) {
    // Puede evolucionar a modal de edicion.
  }

  if (loading) return <div className="rounded-xl bg-white p-5 shadow-md">Cargando equipo...</div>;
  if (!team) return <div className="rounded-xl bg-white p-5 shadow-md">No hay equipo activo todavia.</div>;

  return (
    <>
      <TeamHeaderCard
        team={team}
        onRotateCode={onRotateCode}
        onCopyCode={onCopyCode}
        onEditTeam={onEditTeam}
      />
      {error && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <TeamMembersSection
        participants={filteredParticipants}
        search={search}
        onSearchChange={setSearch}
        onOpenCreateModal={() => setModalOpen(true)}
        onEditParticipant={handleEditParticipant}
        onRemoveParticipant={handleRemoveParticipant}
      />
      <CreateParticipantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateParticipant}
      />
    </>
  );
};

