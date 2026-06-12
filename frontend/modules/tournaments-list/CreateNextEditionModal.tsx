import React from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  createNextEditionFromTournament,
  defaultNextEditionName,
  suggestNextEditionLabel,
  type CreateNextEditionResult,
  type NextEditionMode,
} from '../../services/tournaments/nextEdition';

export interface CreateNextEditionModalProps {
  open: boolean;
  onClose: () => void;
  sourceTournamentId: string;
  sourceTournamentName: string;
  sourceEditionLabel?: string | null;
  seriesId?: string | null;
  onSuccess: (result: CreateNextEditionResult) => void;
}

export const CreateNextEditionModal: React.FC<CreateNextEditionModalProps> = ({
  open,
  onClose,
  sourceTournamentId,
  sourceTournamentName,
  sourceEditionLabel,
  seriesId,
  onSuccess,
}) => {
  const [editionLabel, setEditionLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [mode, setMode] = React.useState<NextEditionMode>('full');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setEditionLabel(suggestNextEditionLabel(sourceEditionLabel));
    setName(defaultNextEditionName(sourceTournamentName));
    setMode('full');
    setError('');
  }, [open, sourceEditionLabel, sourceTournamentName]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const label = editionLabel.trim();
    if (!label) {
      setError('Ingresá una etiqueta de edición');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await createNextEditionFromTournament({
        sourceTournamentId,
        editionLabel: label,
        name: name.trim() || defaultNextEditionName(sourceTournamentName),
        mode,
        seriesId: seriesId || null,
      });
      onSuccess(result);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la próxima edición');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Crear próxima edición" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-text-muted">
          Se clonará la estructura de <strong className="text-text-primary">{sourceTournamentName}</strong> y se
          aplicarán ascensos, descensos y permanencias según las clasificaciones guardadas.
        </p>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary">Etiqueta de edición</span>
          <input
            type="text"
            value={editionLabel}
            onChange={(e) => setEditionLabel(e.target.value)}
            className="w-full rounded-xl border border-border-subtle px-3 py-2"
            placeholder="Ej: 2026"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-primary">Nombre del torneo</span>
          <p className="mb-1.5 text-xs text-text-muted">
            Por defecto se mantiene el mismo nombre de la edición anterior; podés cambiarlo si querés.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border-subtle px-3 py-2"
            placeholder={sourceTournamentName}
          />
        </label>

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium text-text-primary">Modo</legend>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="next-edition-mode"
              checked={mode === 'full'}
              onChange={() => setMode('full')}
            />
            <span>
              <span className="font-medium">Completo</span> — requiere torneo finalizado y snapshots de ascenso/descenso
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="next-edition-mode"
              checked={mode === 'structure_only'}
              onChange={() => setMode('structure_only')}
            />
            <span>
              <span className="font-medium">Solo estructura + permanencias</span> — sin aplicar ascensos/descenso
            </span>
          </label>
        </fieldset>

        {error ? <p className="text-sm text-danger-base">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear edición'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
