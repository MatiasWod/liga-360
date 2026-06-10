import React from 'react';
import { listTournamentInscriptions } from '../../services/inscriptions/inscriptions';
import { getTeamDetail } from '../../services/teams/teams';
import { listMatchPresences } from '../../services/matchEvents/presences';
import {
  buildPlayerPickerOptions,
  playerOptionValue,
  rosterMemberName,
  type EventTeamOption,
  type PresenceLike,
  type RosterMember,
} from './eventAttribution';

const FREE_TEXT_VALUE = '__free_text__';

export interface EventAttributionFieldsProps {
  tournamentId: string;
  /** Partido en edición: si tiene presencias cargadas, son la fuente del picker (ADR-0002). */
  matchId?: string;
  homeOption: EventTeamOption | null;
  awayOption: EventTeamOption | null;
  selectedInscriptionId: number | null;
  selectedMember: RosterMember | null;
  freeText: string;
  onTeamChange: (inscriptionId: number | null) => void;
  onMemberChange: (member: RosterMember | null) => void;
  onFreeTextChange: (text: string) => void;
}

/**
 * Selector de equipo (las dos inscripciones del partido) + picker de jugador.
 * Cascada: plantilla del equipo vinculado → texto libre (siempre disponible).
 */
export const EventAttributionFields: React.FC<EventAttributionFieldsProps> = ({
  tournamentId,
  matchId,
  homeOption,
  awayOption,
  selectedInscriptionId,
  selectedMember,
  freeText,
  onTeamChange,
  onMemberChange,
  onFreeTextChange,
}) => {
  const options = [homeOption, awayOption].filter(Boolean) as EventTeamOption[];

  // Cache inscriptionId → linked_team_id (resuelto una sola vez por torneo)
  const [teamIdByInscription, setTeamIdByInscription] = React.useState<Map<number, number | null> | null>(null);
  // Cache inscriptionId → plantilla
  const [rosters, setRosters] = React.useState<Record<number, RosterMember[]>>({});
  const [loadingRoster, setLoadingRoster] = React.useState(false);
  // Presencias del partido (primera fuente de la cascada)
  const [presences, setPresences] = React.useState<PresenceLike[]>([]);

  React.useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    listMatchPresences(matchId)
      .then((data) => {
        if (!cancelled) setPresences(data);
      })
      .catch(() => {
        // Sin presencias resolubles: la cascada sigue con plantilla → texto libre
        if (!cancelled) setPresences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  React.useEffect(() => {
    let cancelled = false;
    listTournamentInscriptions(tournamentId)
      .then((items) => {
        if (cancelled) return;
        const map = new Map<number, number | null>();
        for (const it of items) map.set(Number(it.id), it.linked_team_id != null ? Number(it.linked_team_id) : null);
        setTeamIdByInscription(map);
      })
      .catch(() => {
        // Sin inscripciones resolubles: la cascada degrada a texto libre
        if (!cancelled) setTeamIdByInscription(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  React.useEffect(() => {
    if (selectedInscriptionId == null || teamIdByInscription == null) return;
    if (rosters[selectedInscriptionId]) return;
    const teamId = teamIdByInscription.get(selectedInscriptionId);
    if (!teamId) {
      setRosters((prev) => ({ ...prev, [selectedInscriptionId]: [] }));
      return;
    }
    let cancelled = false;
    setLoadingRoster(true);
    getTeamDetail(String(teamId))
      .then(({ participants }) => {
        if (cancelled) return;
        setRosters((prev) => ({
          ...prev,
          [selectedInscriptionId]: participants.map((p) => ({ id: Number(p.id), name: rosterMemberName(p) })),
        }));
      })
      .catch(() => {
        if (!cancelled) setRosters((prev) => ({ ...prev, [selectedInscriptionId]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingRoster(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInscriptionId, teamIdByInscription]);

  const roster = selectedInscriptionId != null ? rosters[selectedInscriptionId] ?? [] : [];

  // Cascada: presencias del partido → plantilla → texto libre (siempre disponible)
  const picker = buildPlayerPickerOptions({ inscriptionId: selectedInscriptionId, presences, roster });
  const selectedValue = selectedMember
    ? playerOptionValue(selectedMember.id, selectedMember.name)
    : picker.options.some((o) => o.memberId == null && o.name === freeText)
      ? playerOptionValue(null, freeText)
      : FREE_TEXT_VALUE;

  return (
    <>
      <div className="space-y-1">
        <label className="block text-xs text-text-muted">Equipo</label>
        <select
          value={selectedInscriptionId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onTeamChange(v === '' ? null : Number(v));
            onMemberChange(null);
          }}
          className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
        >
          <option value="">Seleccionar equipo…</option>
          {options.map((o) => (
            <option key={o.inscriptionId} value={o.inscriptionId}>
              {o.displayName || `Inscripción #${o.inscriptionId}`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-text-muted">
          Jugador{picker.source === 'presences' ? ' (presentes del partido)' : ''}
        </label>
        {picker.options.length > 0 ? (
          <select
            value={selectedValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === FREE_TEXT_VALUE) {
                onMemberChange(null);
                onFreeTextChange('');
                return;
              }
              const opt = picker.options.find((o) => o.value === v) || null;
              if (opt && opt.memberId != null) {
                onMemberChange({ id: opt.memberId, name: opt.name });
              } else {
                // Presencia de texto (p. ej. invitado sin vincular): atribución por nombre
                onMemberChange(null);
                onFreeTextChange(opt?.name ?? '');
              }
            }}
            className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          >
            {picker.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.isGuest ? `${o.name} (invitado)` : o.name}
              </option>
            ))}
            <option value={FREE_TEXT_VALUE}>Otro (escribir nombre)…</option>
          </select>
        ) : loadingRoster ? (
          <p className="text-xs text-text-muted">Cargando plantilla…</p>
        ) : null}
        {selectedMember == null && selectedValue === FREE_TEXT_VALUE ? (
          <input
            type="text"
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            placeholder="Nombre del jugador o sancionado"
            className="w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          />
        ) : null}
      </div>
    </>
  );
};
