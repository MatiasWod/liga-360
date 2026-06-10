import React from 'react';
import {
  listMatchPresences,
  replaceMatchPresences,
  type MatchPresence,
  type PresenceEntry,
} from '../../services/matchEvents/presences';
import { rosterMemberName } from '../../components/match-edit/eventAttribution';
import type { TeamParticipant } from '../../types/domain';

export interface MatchPresenceEditorProps {
  matchId: string;
  tournamentId: string;
  competitionId: string | null;
  inscriptionId: number;
  matchLabel: string;
  roster: TeamParticipant[];
  onClose: () => void;
}

/**
 * Editor de presencias de un partido (solo dueño del equipo, ADR-0002):
 * checks sobre la plantilla + invitados de texto. Guardar reemplaza la lista
 * completa de la inscripción en el partido (PUT bulk).
 */
export const MatchPresenceEditor: React.FC<MatchPresenceEditorProps> = ({
  matchId,
  tournamentId,
  competitionId,
  inscriptionId,
  matchLabel,
  roster,
  onClose,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  // member ids marcados como presentes
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  // invitados: presencias is_guest existentes + altas nuevas de texto
  const [guests, setGuests] = React.useState<{ name: string; linkedMemberId: number | null }[]>([]);
  const [guestInput, setGuestInput] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listMatchPresences(matchId)
      .then((data: MatchPresence[]) => {
        if (cancelled) return;
        const mine = data.filter((p) => Number(p.inscription_id) === inscriptionId);
        setChecked(new Set(mine.filter((p) => !p.is_guest && p.linked_member_id != null).map((p) => Number(p.linked_member_id))));
        setGuests(mine.filter((p) => p.is_guest).map((p) => ({ name: p.display_name, linkedMemberId: p.linked_member_id })));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar presencias');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, inscriptionId]);

  function toggleMember(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSuccess(false);
  }

  function addGuest() {
    const name = guestInput.trim();
    if (!name) return;
    if (guests.some((g) => g.name.toLowerCase() === name.toLowerCase())) return;
    setGuests((prev) => [...prev, { name, linkedMemberId: null }]);
    setGuestInput('');
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const entries: PresenceEntry[] = [
        ...roster
          .filter((p) => checked.has(Number(p.id)))
          .map((p) => ({ linked_member_id: Number(p.id), display_name: rosterMemberName(p), is_guest: false })),
        ...guests.map((g) => ({ linked_member_id: g.linkedMemberId, display_name: g.name, is_guest: true })),
      ];
      await replaceMatchPresences(matchId, {
        inscription_id: inscriptionId,
        tournament_id: tournamentId,
        competition_id: competitionId,
        entries,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar las presencias');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[#0F2A33]">Presencias del partido</h3>
            <p className="mt-0.5 text-xs text-slate-500">{matchLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading ? <p className="text-sm text-slate-500">Cargando presencias…</p> : null}

          {!loading && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plantilla</p>
                {roster.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Tu equipo no tiene integrantes cargados.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {roster.map((p) => {
                      const id = Number(p.id);
                      return (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked.has(id)}
                              onChange={() => toggleMember(id)}
                              className="h-4 w-4 accent-[#2E7D32]"
                            />
                            {rosterMemberName(p)}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invitados (solo este partido)</p>
                {guests.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {guests.map((g) => (
                      <li
                        key={g.name}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                      >
                        <span>
                          {g.name} <span className="text-xs text-slate-400">(invitado)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setGuests((prev) => prev.filter((x) => x.name !== g.name));
                            setSuccess(false);
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGuest();
                      }
                    }}
                    placeholder="Nombre del invitado"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addGuest}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">Presencias guardadas</p> : null}
        </div>

        <footer className="border-t border-slate-200 p-4">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="w-full rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar presencias'}
          </button>
        </footer>
      </div>
    </div>
  );
};
