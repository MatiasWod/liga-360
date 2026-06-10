/** Tipos de evento de partido válidos (gol, tarjetas, suspensión, otra sanción). Lógica pura. */
export const VALID_EVENT_TYPES = ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction'];

export function isValidEventType(eventType) {
  return VALID_EVENT_TYPES.includes(eventType);
}

/**
 * Vista pública de un evento: `notes` puede contener observaciones internas del
 * organizador, así que solo se incluye con token de organizador.
 */
export function sanitizeEventForViewer(event, isOrganizer) {
  if (!event) return event;
  if (isOrganizer) return event;
  const { notes, ...publicEvent } = event;
  return publicEvent;
}
