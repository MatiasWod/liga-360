import React from 'react';
import type { TeamInfo, TeamParticipant } from '../types/domain';
import { CreateParticipantModal, type CreateParticipantPayload } from '../components/team/CreateParticipantModal';
import { TeamMembersSection } from '../components/team/TeamMembersSection';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

const DEFAULT_SHIELD_SRC = '/predeterminado.png';
const MIN_LOGO_ZOOM = 0.3;
const MAX_LOGO_ZOOM = 3;

interface TeamParticipantsPageProps {
  team: TeamInfo | null;
  participants: TeamParticipant[];
  loading?: boolean;
  error?: string;
  onCreateParticipant: (payload: CreateParticipantPayload) => Promise<void>;
  onUpdateParticipant: (id: string, payload: CreateParticipantPayload) => Promise<void>;
  onRemoveParticipant: (id: string) => Promise<void>;
  onRotateCode: () => Promise<void>;
  onCopyCode: () => Promise<void>;
  onUpdateTeamLogo: (badgeUrl: string) => Promise<void>;
}

export const TeamParticipantsPage: React.FC<TeamParticipantsPageProps> = ({
  team,
  participants,
  loading = false,
  error = '',
  onCreateParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  onRotateCode,
  onCopyCode,
  onUpdateTeamLogo,
}) => {
  const [search, setSearch] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [deletingParticipant, setDeletingParticipant] = React.useState<TeamParticipant | null>(null);
  const [editingParticipant, setEditingParticipant] = React.useState<TeamParticipant | null>(null);
  const [editError, setEditError] = React.useState('');
  const [logoModalOpen, setLogoModalOpen] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState('');
  const [logoSource, setLogoSource] = React.useState('');
  const [logoRenderedPreview, setLogoRenderedPreview] = React.useState(DEFAULT_SHIELD_SRC);
  const [logoError, setLogoError] = React.useState('');
  const [logoZoom, setLogoZoom] = React.useState(1);
  const [logoOffsetX, setLogoOffsetX] = React.useState(0);
  const [logoOffsetY, setLogoOffsetY] = React.useState(0);
  const [editForm, setEditForm] = React.useState<CreateParticipantPayload>({
    firstName: '',
    lastName: '',
    nickname: '',
    dni: '',
    avatarUrl: '',
    addToTeam: true,
  });

  const filtered = React.useMemo(() => {
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

  React.useEffect(() => {
    const fallback = team?.badgeUrl || DEFAULT_SHIELD_SRC;
    setLogoUrl(fallback);
    setLogoSource(fallback);
    setLogoRenderedPreview(fallback);
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
  }, [team?.badgeUrl]);

  if (loading) return <Card>Cargando plantilla del equipo...</Card>;
  if (!team) return <Card>No hay equipo activo para gestionar participantes.</Card>;

  function openEditModal(participantId: string) {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;
    setEditError('');
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

  async function submitEdition(e: React.FormEvent) {
    e.preventDefault();
    if (!editingParticipant) return;
    setEditError('');
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError('Nombre y apellido son obligatorios.');
      return;
    }
    if (editForm.dni && !/^\d{7,8}$/.test(editForm.dni.replace(/\D/g, ''))) {
      setEditError('El DNI debe tener 7 u 8 digitos.');
      return;
    }
    try {
      await onUpdateParticipant(editingParticipant.id, editForm);
      setEditingParticipant(null);
    } catch (err: any) {
      setEditError(err?.message || 'No se pudo editar el integrante');
    }
  }

  async function confirmDelete() {
    if (!deletingParticipant) return;
    await onRemoveParticipant(deletingParticipant.id);
    setDeletingParticipant(null);
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  }

  async function renderShieldFromPreview(source: string): Promise<string> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = source;
    });

    const targetSize = 320;
    // Base "contain": permite ver la imagen completa y dejar margenes vacios al hacer zoom out.
    const baseScale = Math.min(targetSize / image.width, targetSize / image.height);
    const finalScale = baseScale * Math.min(MAX_LOGO_ZOOM, Math.max(MIN_LOGO_ZOOM, logoZoom));
    const width = Math.max(1, Math.round(image.width * finalScale));
    const height = Math.max(1, Math.round(image.height * finalScale));
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar el compresor de imagen.');

    const x = (targetSize - width) / 2 + logoOffsetX;
    const y = (targetSize - height) / 2 + logoOffsetY;
    ctx.drawImage(image, x, y, width, height);

    let quality = 0.88;
    let output = canvas.toDataURL('image/webp', quality);
    while (output.length > 90_000 && quality > 0.5) {
      quality -= 0.08;
      output = canvas.toDataURL('image/webp', quality);
    }
    return output;
  }

  React.useEffect(() => {
    const source = logoSource || logoUrl || team?.badgeUrl || DEFAULT_SHIELD_SRC;
    let cancelled = false;
    (async () => {
      try {
        const rendered = await renderShieldFromPreview(source);
        if (!cancelled) setLogoRenderedPreview(rendered);
      } catch {
        if (!cancelled) setLogoRenderedPreview(source);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logoSource, logoUrl, logoZoom, logoOffsetX, logoOffsetY, team?.badgeUrl]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Avatar
                name={team.name}
                imageUrl={team.badgeUrl || DEFAULT_SHIELD_SRC}
                size="xl"
              />
              <button
                type="button"
                onClick={() => setLogoModalOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                title="Editar escudo"
                aria-label="Editar escudo"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </button>
            </div>
            <h1 className="text-2xl font-semibold text-[#0F2A33]">Plantilla</h1>
            <p className="mt-1 text-sm text-slate-600">
              Plantilla de {team.name}. Gestiona altas, ediciones y bajas desde esta vista.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Codigo de edicion:</span>{' '}
            {team.secretCode ? (
              <span className="font-mono">{team.secretCode}</span>
            ) : (
              <span className="text-slate-500">oculto (rotar para generar uno nuevo)</span>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onRotateCode}>Rotar codigo</Button>
              <Button onClick={onCopyCode}>Copiar codigo</Button>
            </div>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <TeamMembersSection
        participants={filtered}
        search={search}
        onSearchChange={setSearch}
        onOpenCreateModal={() => setModalOpen(true)}
        onEditParticipant={openEditModal}
        onRemoveParticipant={(id) => {
          const participant = participants.find((item) => item.id === id);
          if (participant) setDeletingParticipant(participant);
        }}
        readOnly={false}
      />

      <CreateParticipantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={onCreateParticipant}
      />

      <Modal
        open={logoModalOpen}
        title="Editar escudo del equipo"
        onClose={() => {
          setLogoModalOpen(false);
          setLogoError('');
        }}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLogoError('');
            try {
              const renderedLogo = await renderShieldFromPreview(logoSource || logoUrl || DEFAULT_SHIELD_SRC);
              setLogoUrl(renderedLogo);
              setLogoRenderedPreview(renderedLogo);
              await onUpdateTeamLogo(renderedLogo);
              setLogoModalOpen(false);
            } catch (err: any) {
              const raw = String(err?.message || '');
              if (raw.includes('HTTP 413')) {
                setLogoError('La imagen es muy pesada. Probá con una más chica o comprimida.');
              } else {
                setLogoError(raw || 'No se pudo actualizar el escudo');
              }
            }
          }}
        >
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Avatar name={team.name} imageUrl={logoRenderedPreview || DEFAULT_SHIELD_SRC} size="xl" />
            <div>
              <p className="text-sm font-medium text-slate-800">{team.name}</p>
              <p className="text-xs text-slate-500">Asi se vera en el resto de la pagina</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mx-auto relative h-36 w-36 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              <img
                src={logoSource || logoUrl || team.badgeUrl || DEFAULT_SHIELD_SRC}
                alt="Previsualizacion escudo"
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  transform: `translate(${logoOffsetX}px, ${logoOffsetY}px) scale(${logoZoom})`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Zoom</span>
                <input
                  type="range"
                  min={MIN_LOGO_ZOOM}
                  max={MAX_LOGO_ZOOM}
                  step={0.05}
                  value={logoZoom}
                  onChange={(e) => setLogoZoom(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Mover horizontal</span>
                <input
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={logoOffsetX}
                  onChange={(e) => setLogoOffsetX(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Mover vertical</span>
                <input
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={logoOffsetY}
                  onChange={(e) => setLogoOffsetY(Number(e.target.value))}
                  className="w-full"
                />
              </label>
            </div>
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Adjuntar imagen de escudo</span>
            <input
              type="file"
              accept="image/*"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                  setLogoError('El archivo debe ser una imagen valida.');
                  return;
                }
                try {
                  const source = await readFileAsDataUrl(file);
                  setLogoError('');
                  setLogoSource(source);
                  setLogoZoom(1);
                  setLogoOffsetX(0);
                  setLogoOffsetY(0);
                } catch (err: any) {
                  setLogoError(err?.message || 'No se pudo procesar la imagen seleccionada.');
                }
              }}
            />
          </label>
          <div className="flex justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLogoUrl(DEFAULT_SHIELD_SRC);
                setLogoSource(DEFAULT_SHIELD_SRC);
                setLogoZoom(1);
                setLogoOffsetX(0);
                setLogoOffsetY(0);
              }}
            >
              Usar escudo predeterminado
            </Button>
          </div>
          {logoError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{logoError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setLogoModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar escudo</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingParticipant)}
        title="Editar integrante"
        onClose={() => {
          setEditingParticipant(null);
          setEditError('');
        }}
      >
        <form onSubmit={submitEdition} className="space-y-4">
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
          {editError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingParticipant(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deletingParticipant)}
        title="Confirmar eliminacion"
        onClose={() => setDeletingParticipant(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Vas a quitar de la plantilla a{' '}
            <span className="font-semibold">
              {deletingParticipant?.firstName} {deletingParticipant?.lastName}
            </span>
            . Esta accion puede revertirse agregandolo nuevamente.
          </p>
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aviso: si tiene reclamo por DNI, ese vinculo de perfil no se elimina con esta accion.
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeletingParticipant(null)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Eliminar participante
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

