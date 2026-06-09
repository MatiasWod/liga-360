/** Tipos de evento de partido válidos (gol, tarjetas, suspensión, otra sanción). Lógica pura. */
export const VALID_EVENT_TYPES = ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction'];

export function isValidEventType(eventType) {
  return VALID_EVENT_TYPES.includes(eventType);
}
