/**
 * Helpers puros para la atribución de eventos de partido (sin React ni fetch).
 * Cascada de identificación del jugador: integrante de plantilla → texto libre.
 */

export interface EventTeamOption {
  inscriptionId: number;
  displayName: string;
}

export interface RosterMember {
  id: number;
  name: string;
}

/**
 * Convierte el slot GraphQL (homeAssignedInscription/awayAssignedInscription) en
 * una opción de equipo. Ids sintéticos o vacíos (slots de llave sin resolver)
 * devuelven null.
 */
export function parseInscriptionSlot(
  slot?: { inscriptionId?: string | number | null; displayName?: string | null } | null
): EventTeamOption | null {
  const raw = slot?.inscriptionId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { inscriptionId: id, displayName: slot?.displayName || '' };
}

export interface AttributionInput {
  inscriptionId: number | null;
  /** Integrante elegido de la plantilla (null = texto libre). */
  member: RosterMember | null;
  freeText: string;
}

export type AttributionResult =
  | { ok: true; inscription_id: number; linked_member_id: number | null; display_name: string }
  | { ok: false; error: string };

export function buildAttribution({ inscriptionId, member, freeText }: AttributionInput): AttributionResult {
  if (inscriptionId == null) {
    return { ok: false, error: 'Seleccioná el equipo del evento' };
  }
  if (member) {
    return {
      ok: true,
      inscription_id: inscriptionId,
      linked_member_id: member.id,
      display_name: member.name,
    };
  }
  const name = freeText.trim();
  if (!name) {
    return { ok: false, error: 'Elegí un jugador de la plantilla o escribí su nombre' };
  }
  return { ok: true, inscription_id: inscriptionId, linked_member_id: null, display_name: name };
}

/** Nombre visible de un participante de plantilla (apodo o nombre completo). */
export function rosterMemberName(p: { firstName?: string; lastName?: string; nickname?: string }): string {
  const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return p.nickname?.trim() || full || 'Sin nombre';
}

// ---------------------------------------------------------------------------
// Cascada del picker (ADR-0002): presencias del partido → plantilla → texto libre
// ---------------------------------------------------------------------------

export interface PresenceLike {
  inscription_id: number;
  linked_member_id: number | null;
  display_name: string;
  is_guest: boolean;
}

export interface PlayerPickerOption {
  /** Valor estable del <option>: member:<id> o text:<nombre>. */
  value: string;
  name: string;
  memberId: number | null;
  isGuest: boolean;
}

export function playerOptionValue(memberId: number | null, name: string): string {
  return memberId != null ? `member:${memberId}` : `text:${name}`;
}

/**
 * Opciones del picker de jugador para una inscripción:
 * - si hay presencias cargadas del partido para esa inscripción, son la fuente
 *   (plantilla presente primero, invitados al final);
 * - si no, la plantilla completa;
 * - el texto libre lo agrega la UI como opción fija.
 */
export function buildPlayerPickerOptions({
  inscriptionId,
  presences,
  roster,
}: {
  inscriptionId: number | null;
  presences: PresenceLike[];
  roster: RosterMember[];
}): { options: PlayerPickerOption[]; source: 'presences' | 'roster' | 'none' } {
  if (inscriptionId == null) return { options: [], source: 'none' };
  const forInscription = presences.filter((p) => Number(p.inscription_id) === Number(inscriptionId));
  if (forInscription.length > 0) {
    const sorted = [...forInscription].sort((a, b) =>
      a.is_guest !== b.is_guest ? Number(a.is_guest) - Number(b.is_guest) : a.display_name.localeCompare(b.display_name)
    );
    return {
      source: 'presences',
      options: sorted.map((p) => ({
        value: playerOptionValue(p.linked_member_id, p.display_name),
        name: p.display_name,
        memberId: p.linked_member_id,
        isGuest: p.is_guest,
      })),
    };
  }
  if (roster.length > 0) {
    return {
      source: 'roster',
      options: roster.map((m) => ({
        value: playerOptionValue(m.id, m.name),
        name: m.name,
        memberId: m.id,
        isGuest: false,
      })),
    };
  }
  return { options: [], source: 'none' };
}
