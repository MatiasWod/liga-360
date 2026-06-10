import React from 'react';
import type { LinkedTeam, TeamParticipant } from '../../types/domain';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LinkedTeamsSection } from '../../components/profile/LinkedTeamsSection';
import { MyStatsSection } from '../../components/profile/MyStatsSection';
import { Modal } from '../../components/ui/Modal';

const DEFAULT_AVATAR_SRC = '/predeterminado.png';

interface ProfilePageProps {
  fullName: string;
  firstName: string;
  lastName: string;
  nickname: string;
  dni: string;
  avatarUrl?: string;
  participants: TeamParticipant[];
  teams: LinkedTeam[];
  onClaim: () => Promise<void>;
  onUnlink: (participantId: string) => Promise<void>;
  onSaveProfile: (payload: { firstName: string; lastName: string; dni: string; avatarUrl: string }) => Promise<void>;
  loading?: boolean;
  error?: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  fullName,
  firstName,
  lastName,
  nickname,
  dni,
  avatarUrl,
  participants,
  teams,
  onSaveProfile,
  loading = false,
  error = '',
}) => {
  const [editOpen, setEditOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    dni: '',
    avatarUrl: '',
  });

  React.useEffect(() => {
    setForm({
      firstName: firstName || '',
      lastName: lastName || '',
      dni: dni && dni !== 'Sin DNI' ? dni : '',
      avatarUrl: avatarUrl || DEFAULT_AVATAR_SRC,
    });
  }, [firstName, lastName, dni, avatarUrl]);

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  }

  async function compressAvatar(file: File): Promise<string> {
    const rawDataUrl = await readFileAsDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = rawDataUrl;
    });

    const targetSize = 320;
    const scale = Math.min(targetSize / image.width, targetSize / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la imagen.');
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.86);
  }

  if (loading) return <div className="rounded-xl bg-white p-5 shadow-md">Cargando perfil...</div>;

  return (
    <div className="space-y-6">
      <Card className="mb-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={fullName} imageUrl={avatarUrl || DEFAULT_AVATAR_SRC} size="xl" />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{fullName}</h1>
              <p className="text-sm text-slate-600">
                Nombre: {firstName || '-'} | Apellido: {lastName || '-'} | Apodo: {nickname || '-'}
              </p>
              <p className="text-sm text-slate-600">DNI: {dni || 'Sin DNI'}</p>
            </div>
          </div>
          <Button onClick={() => setEditOpen(true)}>Editar perfil</Button>
        </div>
      </Card>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <MyStatsSection participants={participants} teams={teams} />
      <LinkedTeamsSection teams={teams} />

      <Modal open={editOpen} title="Editar datos personales" onClose={() => setEditOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaveError('');
            try {
              await onSaveProfile({
                firstName: form.firstName,
                lastName: form.lastName,
                dni: form.dni,
                avatarUrl: form.avatarUrl,
              });
              setEditOpen(false);
            } catch (err: any) {
              setSaveError(err?.message || 'No se pudo guardar el perfil');
            }
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Apellido</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">DNI</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.dni}
              onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
              placeholder="7 u 8 digitos"
            />
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Avatar name={fullName} imageUrl={form.avatarUrl || DEFAULT_AVATAR_SRC} size="md" />
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Foto de perfil</span>
              <input
                type="file"
                accept="image/*"
                className="block text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const compressed = await compressAvatar(file);
                  setForm((prev) => ({ ...prev, avatarUrl: compressed }));
                }}
              />
            </label>
          </div>

          {saveError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

