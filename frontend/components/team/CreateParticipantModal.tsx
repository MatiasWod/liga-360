import React from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface CreateParticipantPayload {
  firstName: string;
  lastName: string;
  nickname: string;
  dni: string;
  avatarUrl: string;
  addToTeam: boolean;
}

interface CreateParticipantModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateParticipantPayload) => void;
}

const initialForm: CreateParticipantPayload = {
  firstName: '',
  lastName: '',
  nickname: '',
  dni: '',
  avatarUrl: '',
  addToTeam: true,
};

export const CreateParticipantModal: React.FC<CreateParticipantModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const [form, setForm] = React.useState<CreateParticipantPayload>(initialForm);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setError('');
      setSuccess('');
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Nombre y apellido son obligatorios.');
      return;
    }
    if (form.dni && !/^\d{7,8}$/.test(form.dni.replace(/\D/g, ''))) {
      setError('El DNI debe tener 7 u 8 digitos.');
      return;
    }
    onCreate(form);
    setSuccess('Participante creado correctamente.');
    setTimeout(() => onClose(), 500);
  }

  return (
    <Modal open={open} title="Agregar integrante" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Apodo</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.nickname}
              onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">DNI</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={form.dni}
              onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value }))}
              placeholder="Opcional"
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Avatar URL</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.avatarUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.addToTeam}
            onChange={(e) => setForm((prev) => ({ ...prev, addToTeam: e.target.checked }))}
          />
          Agregar a este equipo
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {success && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Crear integrante</Button>
        </div>
      </form>
    </Modal>
  );
};

