import React from 'react';
import { CompetitorBadge } from '../competitor/CompetitorBadge';
import { updateMatchDateTime } from '../../services/tournaments/matchDateTime';
import { gqlRequest } from '../../services/tournaments/client';
import {
  createMatchEvent,
  deleteMatchEvent,
  listMatchEvents,
  updateMatchEvent,
} from '../../services/matchEvents/matchEvents';
import type { MatchEvent, MatchEventType } from '../../services/matchEvents/types';
import { EventAttributionFields } from './EventAttributionFields';
import { buildAttribution, parseInscriptionSlot, type RosterMember } from './eventAttribution';

// ---------------------------------------------------------------------------
// updateMatchResult — mutación GraphQL inline (sin servicio propio aún)
// ---------------------------------------------------------------------------
async function updateMatchResult(
  matchId: string,
  homeScore: number | null,
  awayScore: number | null,
  status: string
) {
  return gqlRequest(
    `mutation UpdateMatchResult($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
      updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
        id homeScore awayScore status
      }
    }`,
    { matchId, homeScore, awayScore, status },
    { auth: true }
  );
}

// ---------------------------------------------------------------------------
// Tipos de eventos con etiquetas en español
// ---------------------------------------------------------------------------
const EVENT_TYPE_LABELS: Record<MatchEventType, string> = {
  goal: 'Gol',
  yellow_card: 'Tarjeta amarilla',
  red_card: 'Tarjeta roja',
  suspension: 'Suspensión',
  other_sanction: 'Otra sanción',
};

const MATCH_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'live', label: 'En vivo' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'postponed', label: 'Aplazado' },
];

/**
 * Normaliza el status del backend al valor esperado por el <select>.
 * El backend guarda 'finished' pero el form usa 'completed' para "Finalizado".
 */
function normalizeStatusForForm(raw: string | null | undefined): string {
  const s = (raw ?? '').toLowerCase();
  if (s === 'finished' || s === 'completed') return 'completed';
  if (s === 'live' || s === 'in_progress') return 'live';
  if (s === 'postponed') return 'postponed';
  return 'scheduled';
}

// ---------------------------------------------------------------------------
// Props del drawer
// ---------------------------------------------------------------------------
export interface MatchEditDrawerProps {
  matchId: string;
  tournamentId: string;
  /** Competencia a la que pertenece el partido; viaja en los eventos para stats por Competencia. */
  competitionId?: string | null;
  /** Slots de inscripción del partido para atribuir eventos a un equipo. */
  homeImageUrl?: string;
  awayImageUrl?: string;
  homeSlot?: { inscriptionId?: string | number | null; displayName?: string | null } | null;
  awaySlot?: { inscriptionId?: string | number | null; displayName?: string | null } | null;
  initialData?: {
    scheduledAt?: string | null;
    venue?: string | null;
    referee?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    status?: string | null;
    homeDisplayName?: string;
    awayDisplayName?: string;
  };
  /** Horarios frecuentes para sugerir en la pestaña Programación. */
  presetTimes?: string[];
  /** Pestaña inicial. Por defecto 'result' para partidos no finalizados. */
  defaultTab?: 'schedule' | 'result' | 'events';
  /** Si false, solo programación (fecha/cancha); resultado y eventos requieren equipos. */
  teamsResolved?: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export const MatchEditDrawer: React.FC<MatchEditDrawerProps> = ({
  matchId,
  tournamentId,
  competitionId,
  homeImageUrl,
  awayImageUrl,
  homeSlot,
  awaySlot,
  initialData,
  presetTimes,
  defaultTab,
  teamsResolved = true,
  onClose,
  onSaved,
}) => {
  const drawerSections = teamsResolved
    ? (['schedule', 'result', 'events'] as const)
    : (['schedule'] as const);
  const initialSection = defaultTab ?? 'result';
  const [activeSection, setActiveSection] = React.useState<'schedule' | 'result' | 'events'>(() => {
    if (!teamsResolved) return 'schedule';
    return initialSection;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar panel"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-1 shadow-2xl shadow-black/40">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Editar partido</h3>
            {initialData?.homeDisplayName && initialData?.awayDisplayName ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                <CompetitorBadge url={homeImageUrl} name={initialData.homeDisplayName} />
                <span className="min-w-0 truncate">{initialData.homeDisplayName}</span>
                <span>vs</span>
                <span className="min-w-0 truncate">{initialData.awayDisplayName}</span>
                <CompetitorBadge url={awayImageUrl} name={initialData.awayDisplayName} />
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Pestañas */}
        <div className="flex border-b border-border-subtle">
          {drawerSections.map((section) => {
            const labels = { schedule: 'Programación', result: 'Resultado', events: 'Eventos' };
            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === section
                    ? 'border-b-2 border-accent-primary text-accent-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {labels[section]}
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5">
          {!teamsResolved ? (
            <p className="mb-4 rounded-lg border border-dashed border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-muted">
              Asigná local y visitante para cargar resultado o eventos. Podés programar fecha y cancha.
            </p>
          ) : null}
          {activeSection === 'schedule' && (
            <ScheduleSection matchId={matchId} initialData={initialData} presetTimes={presetTimes} onSaved={onSaved} />
          )}
          {activeSection === 'result' && (
            <ResultSection matchId={matchId} initialData={initialData} onSaved={onSaved} />
          )}
          {activeSection === 'events' && (
            <EventsSection
              matchId={matchId}
              tournamentId={tournamentId}
              competitionId={competitionId}
              homeSlot={homeSlot}
              awaySlot={awaySlot}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sección: Programación
// ---------------------------------------------------------------------------
function ScheduleSection({
  matchId,
  initialData,
  presetTimes,
  onSaved,
}: {
  matchId: string;
  initialData?: MatchEditDrawerProps['initialData'];
  presetTimes?: string[];
  onSaved?: () => void;
}) {
  const [scheduledAt, setScheduledAt] = React.useState(
    initialData?.scheduledAt ? isoToDatetimeLocal(initialData.scheduledAt) : ''
  );
  const [venue, setVenue] = React.useState(initialData?.venue ?? '');
  const [referee, setReferee] = React.useState(initialData?.referee ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  function applyPresetTime(hhmm: string) {
    const dateOnly = scheduledAt ? scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const [hh, mm] = hhmm.split(':').map((x) => x.padStart(2, '0'));
    setScheduledAt(`${dateOnly}T${hh}:${mm}`);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateMatchDateTime(matchId, {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        venue: venue.trim() || null,
        referee: referee.trim() || null,
      });
      setSuccess(true);
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Fecha y hora</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        />
        {presetTimes && presetTimes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {presetTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => applyPresetTime(t)}
                className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-accent-primary hover:text-accent-primary"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Sede / cancha</label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Ej: Estadio Municipal"
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Árbitro</label>
        <input
          type="text"
          value={referee}
          onChange={(e) => setReferee(e.target.value)}
          placeholder="Nombre del árbitro"
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        />
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">Guardado correctamente</p> : null}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
      >
        {saving ? 'Guardando…' : 'Guardar programación'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección: Resultado
// ---------------------------------------------------------------------------
function ResultSection({
  matchId,
  initialData,
  onSaved,
}: {
  matchId: string;
  initialData?: MatchEditDrawerProps['initialData'];
  onSaved?: () => void;
}) {
  const [homeScore, setHomeScore] = React.useState<string>(
    initialData?.homeScore != null ? String(initialData.homeScore) : ''
  );
  const [awayScore, setAwayScore] = React.useState<string>(
    initialData?.awayScore != null ? String(initialData.awayScore) : ''
  );
  const [status, setStatus] = React.useState(() => normalizeStatusForForm(initialData?.status));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const hs = homeScore !== '' ? parseInt(homeScore, 10) : null;
      const as_ = awayScore !== '' ? parseInt(awayScore, 10) : null;
      if (hs !== null && (isNaN(hs) || hs < 0)) throw new Error('Marcador local inválido');
      if (as_ !== null && (isNaN(as_) || as_ < 0)) throw new Error('Marcador visitante inválido');
      // Validar que ambos marcadores estén presentes cuando el partido es finalizado.
      if ((status === 'completed' || status === 'finished') && (hs === null || as_ === null)) {
        throw new Error('Ingresá ambos marcadores para marcar el partido como Finalizado');
      }
      // Si el usuario cargó ambos marcadores pero dejó el estado en "programado",
      // lo marcamos automáticamente como "finalizado" para que aparezca en la tabla.
      const effectiveStatus =
        status === 'scheduled' && hs != null && as_ != null ? 'completed' : status;
      await updateMatchResult(matchId, hs, as_, effectiveStatus);
      setSuccess(true);
      // Esperar a que el refresh (onSaved) complete antes de continuar;
      // así el card ya refleja el nuevo estado cuando el drawer cierra.
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const homeName = initialData?.homeDisplayName ?? 'Local';
  const awayName = initialData?.awayDisplayName ?? 'Visitante';

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-text-secondary truncate" title={homeName}>
            {homeName}
          </label>
          <input
            type="number"
            min="0"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          />
        </div>
        <span className="mb-2 text-sm font-semibold text-text-muted">—</span>
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-text-secondary truncate" title={awayName}>
            {awayName}
          </label>
          <input
            type="number"
            min="0"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-center text-lg font-bold text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        >
          {MATCH_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {status === 'scheduled' && homeScore !== '' && awayScore !== '' ? (
        <p className="text-xs text-amber-500">
          Al guardar con marcadores completos, el partido quedará marcado como Finalizado automáticamente.
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">Resultado guardado</p> : null}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
      >
        {saving ? 'Guardando…' : 'Guardar resultado'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección: Eventos
// ---------------------------------------------------------------------------
function EventsSection({
  matchId,
  tournamentId,
  competitionId,
  homeSlot,
  awaySlot,
}: {
  matchId: string;
  tournamentId: string;
  competitionId?: string | null;
  homeSlot?: MatchEditDrawerProps['homeSlot'];
  awaySlot?: MatchEditDrawerProps['awaySlot'];
}) {
  const [events, setEvents] = React.useState<MatchEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const homeOption = parseInscriptionSlot(homeSlot);
  const awayOption = parseInscriptionSlot(awaySlot);

  // Formulario nuevo evento
  const [newType, setNewType] = React.useState<MatchEventType>('goal');
  const [newInscriptionId, setNewInscriptionId] = React.useState<number | null>(null);
  const [newMember, setNewMember] = React.useState<RosterMember | null>(null);
  const [newName, setNewName] = React.useState('');
  const [newMinute, setNewMinute] = React.useState('');
  const [newNotes, setNewNotes] = React.useState('');
  const [newSuspensionMatches, setNewSuspensionMatches] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listMatchEvents(matchId);
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function handleAddEvent() {
    const attribution = buildAttribution({
      inscriptionId: newInscriptionId,
      member: newMember,
      freeText: newName,
    });
    if (!attribution.ok) {
      setSaveError(attribution.error);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await createMatchEvent(matchId, {
        tournament_id: tournamentId,
        competition_id: competitionId ?? null,
        event_type: newType,
        inscription_id: attribution.inscription_id,
        linked_member_id: attribution.linked_member_id,
        display_name: attribution.display_name,
        minute: newMinute !== '' ? parseInt(newMinute, 10) : null,
        notes: newNotes.trim() || null,
        suspension_matches: newSuspensionMatches !== '' ? parseInt(newSuspensionMatches, 10) : null,
      });
      setNewName('');
      setNewMember(null);
      setNewMinute('');
      setNewNotes('');
      setNewSuspensionMatches('');
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al agregar evento');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId: number) {
    try {
      await deleteMatchEvent(matchId, eventId);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-5">
      {/* Lista de eventos existentes */}
      {loading ? (
        <p className="text-xs text-text-muted">Cargando eventos…</p>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-text-muted">No hay eventos registrados para este partido.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-secondary mr-1.5">
                  {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                </span>
                <span className="text-xs font-medium text-text-primary">{ev.display_name}</span>
                {ev.minute != null ? (
                  <span className="ml-1.5 text-xs text-text-muted">· {ev.minute}'</span>
                ) : null}
                {ev.notes ? (
                  <p className="mt-0.5 text-xs text-text-muted truncate">{ev.notes}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(ev.id)}
                className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-red-400"
                aria-label="Eliminar evento"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Formulario para agregar nuevo evento */}
      <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-2 p-4">
        <p className="text-xs font-semibold text-text-secondary">Agregar evento</p>

        <div className="space-y-1">
          <label className="block text-xs text-text-muted">Tipo</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as MatchEventType)}
            className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            {(Object.entries(EVENT_TYPE_LABELS) as [MatchEventType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <EventAttributionFields
          tournamentId={tournamentId}
          matchId={matchId}
          homeOption={homeOption}
          awayOption={awayOption}
          selectedInscriptionId={newInscriptionId}
          selectedMember={newMember}
          freeText={newName}
          onTeamChange={setNewInscriptionId}
          onMemberChange={setNewMember}
          onFreeTextChange={setNewName}
        />

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-xs text-text-muted">Minuto (opcional)</label>
            <input
              type="number"
              min="0"
              max="999"
              value={newMinute}
              onChange={(e) => setNewMinute(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
          </div>
          {newType === 'suspension' ? (
            <div className="flex-1 space-y-1">
              <label className="block text-xs text-text-muted">Fechas suspendido</label>
              <input
                type="number"
                min="1"
                value={newSuspensionMatches}
                onChange={(e) => setNewSuspensionMatches(e.target.value)}
                placeholder="1"
                className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-text-muted">Notas (opcional)</label>
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Observaciones adicionales"
            className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          />
        </div>

        {saveError ? <p className="text-xs text-red-400">{saveError}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={handleAddEvent}
          className="w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
        >
          {saving ? 'Agregando…' : 'Agregar evento'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isoToDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
