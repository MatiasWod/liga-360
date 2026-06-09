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
