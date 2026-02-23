import React from 'react';
import { CreateParticipantModal, type CreateParticipantPayload } from '../components/team/CreateParticipantModal';
import { TeamMembersSection } from '../components/team/TeamMembersSection';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import type { LinkedTeam, TeamInfo, TeamParticipant } from '../types/domain';
import { createParticipant, getTeamDetail, removeTeamMember, updateParticipant } from '../services/teamsApi';

const DEFAULT_SHIELD_SRC = '/predeterminado.png';

interface ParticipantTeamsPageProps {
  linkedTeams: LinkedTeam[];
}

export const ParticipantTeamsPage: React.FC<ParticipantTeamsPageProps> = ({ linkedTeams }) => {
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = React.useState<TeamInfo | null>(null);
  const [members, setMembers] = React.useState<TeamParticipant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [codeModalOpen, setCodeModalOpen] = React.useState(false);
  const [codeInput, setCodeInput] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingParticipant, setEditingParticipant] = React.useState<TeamParticipant | null>(null);
  const [editForm, setEditForm] = React.useState<CreateParticipantPayload>({
    firstName: '',
    lastName: '',
    nickname: '',
    dni: '',
    avatarUrl: '',
    addToTeam: true,
  });
  const [deleteCandidate, setDeleteCandidate] = React.useState<TeamParticipant | null>(null);

  React.useEffect(() => {
    if (linkedTeams.length === 0) {
      setSelectedTeamId(null);
      return;
    }
    setSelectedTeamId((prev) => prev || linkedTeams[0].id);
  }, [linkedTeams]);

  React.useEffect(() => {
    if (!selectedTeamId) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const detail = await getTeamDetail(selectedTeamId);
        setSelectedTeam(detail.team);
        setMembers(detail.participants);
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar el equipo');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedTeamId]);

  const filteredMembers = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((participant) => {
      const fullName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
      return (
        fullName.includes(needle) ||
        (participant.nickname || '').toLowerCase().includes(needle) ||
        (participant.dni || '').includes(needle)
      );
    });
  }, [members, search]);

  async function refreshTeam() {
    if (!selectedTeamId) return;
    const detail = await getTeamDetail(selectedTeamId);
    setSelectedTeam(detail.team);
    setMembers(detail.participants);
  }

  async function handleCreate(payload: CreateParticipantPayload) {
    if (!selectedTeamId || !editCode) return;
    await createParticipant({
      firstName: payload.firstName,
      lastName: payload.lastName,
      nickname: payload.nickname,
      dni: payload.dni,
      avatarUrl: payload.avatarUrl,
      teamId: selectedTeamId,
      teamCode: editCode,
    });
    await refreshTeam();
  }

  async function handleUpdate(participantId: string) {
    if (!selectedTeamId || !editCode || !editingParticipant) return;
    await updateParticipant(participantId, {
      teamId: selectedTeamId,
      teamCode: editCode,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      nickname: editForm.nickname,
      dni: editForm.dni,
      avatarUrl: editForm.avatarUrl,
    });
    await refreshTeam();
    setEditingParticipant(null);
  }

  async function handleRemove() {
    if (!selectedTeamId || !editCode || !deleteCandidate) return;
    await removeTeamMember(selectedTeamId, deleteCandidate.id, editCode);
    setDeleteCandidate(null);
    await refreshTeam();
  }

  function openEditModal(participantId: string) {
    const participant = members.find((item) => item.id === participantId);
    if (!participant) return;
    setEditingParticipant(participant);
    setEditForm({
      firstName: participant.firstName || '',
      lastName: participant.lastName || '',
      nickname: participant.nickname || '',
      dni: participant.dni || '',
      avatarUrl: participant.avatarUrl || '',
      addToTeam: true,
    });
  }

  if (linkedTeams.length === 0) {
    return (
      <Card>
        <h1 className="text-2xl font-semibold text-[#0F2A33]">Equipos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Aun no estas vinculado a ningun equipo. Cuando reclames o te vinculen, lo veras aqui.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCodeModalOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
              title="Ingresar codigo de edicion"
              aria-label="Ingresar codigo de edicion"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#0F2A33]">Equipos</h1>
              <p className="mt-1 text-sm text-slate-600">
                Visualiza la plantilla y habilita modo edicion con codigo cuando sea necesario.
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            {editCode ? 'Modo edicion habilitado con codigo.' : 'Modo visualizacion activo.'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {linkedTeams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setEditCode('');
                }}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selectedTeamId === team.id
                    ? 'border-[#66BB6A] bg-[#EAF7EB]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <img
                    src={team.badgeUrl || DEFAULT_SHIELD_SRC}
                    alt={`Escudo de ${team.name}`}
                    className="aspect-[5/3] w-full object-contain p-1"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
                      target.src = DEFAULT_SHIELD_SRC;
                    }}
                  />
                  <span
                    className={`text-center text-base font-semibold ${
                      selectedTeamId === team.id ? 'text-[#2E7D32]' : 'text-slate-700'
                    }`}
                  >
                    {team.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {loading && <Card>Cargando plantilla...</Card>}

      {!loading && selectedTeam && (
        <TeamMembersSection
          participants={filteredMembers}
          search={search}
          onSearchChange={setSearch}
          onOpenCreateModal={() => setCreateOpen(true)}
          onEditParticipant={openEditModal}
          onRemoveParticipant={(id) => {
            const participant = members.find((item) => item.id === id);
            if (participant) setDeleteCandidate(participant);
          }}
          readOnly={!editCode}
        />
      )}

      <CreateParticipantModal
        open={createOpen && Boolean(editCode)}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <Modal open={codeModalOpen} title="Ingresar codigo de edicion" onClose={() => setCodeModalOpen(false)}>
        <div className="space-y-4">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            placeholder="Codigo secreto del equipo"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCodeModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditCode(codeInput.trim());
                setCodeModalOpen(false);
              }}
            >
              Habilitar edicion
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editingParticipant)} title="Editar integrante" onClose={() => setEditingParticipant(null)}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingParticipant) return;
            await handleUpdate(editingParticipant.id);
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.firstName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Apellido</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.lastName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Apodo</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.nickname}
                onChange={(e) => setEditForm((prev) => ({ ...prev, nickname: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">DNI</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.dni}
                onChange={(e) => setEditForm((prev) => ({ ...prev, dni: e.target.value }))}
                placeholder="Opcional"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Avatar URL</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={editForm.avatarUrl}
              onChange={(e) => setEditForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingParticipant(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteCandidate)} title="Confirmar eliminacion" onClose={() => setDeleteCandidate(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Vas a quitar de la plantilla a{' '}
            <span className="font-semibold">
              {deleteCandidate?.firstName} {deleteCandidate?.lastName}
            </span>
            .
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteCandidate(null)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={handleRemove}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

