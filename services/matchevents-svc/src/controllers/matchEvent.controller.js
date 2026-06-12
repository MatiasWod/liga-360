import * as matchEventService from '../services/matchEvent.service.js';
import { VALID_EVENT_TYPES, TENNIS_SET_EVENT_TYPE, isValidEventType, sanitizeEventForViewer } from '../domain/matchEvent.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

export async function create(req, res, next) {
  try {
    const { matchId } = req.params;
    const { event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches, notes, extra_json, tournament_id, competition_id } = req.body || {};
    if (!matchId) return validationError(res, 'matchId requerido');
    if (!isValidEventType(event_type)) {
      return validationError(res, `event_type invalido. Valores aceptados: ${VALID_EVENT_TYPES.join(', ')}`);
    }
    if (event_type === TENNIS_SET_EVENT_TYPE) {
      return validationError(res, 'Usá PUT /matches/:matchId/tennis-score para cargar sets de tenis');
    }
    if (!tournament_id) return validationError(res, 'tournament_id requerido');
    if (!display_name && !linked_member_id) {
      return validationError(res, 'display_name es requerido cuando no hay linked_member_id');
    }
    // Atribución obligatoria: el evento pertenece a una de las dos inscripciones del partido
    if (!inscription_id) return validationError(res, 'inscription_id requerido (equipo del evento)');
    const event = await matchEventService.create({
      matchId, tournamentId: tournament_id, competitionId: competition_id, eventType: event_type, inscriptionId: inscription_id, linkedMemberId: linked_member_id,
      displayName: display_name, minute, suspensionMatches: suspension_matches, notes, extraJson: extra_json, createdByUserId: req.user?.sub,
    });
    res.status(201).json(event);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const { matchId } = req.params;
    if (!matchId) return validationError(res, 'matchId requerido');
    const events = await matchEventService.listByMatch(matchId);
    const isOrganizer = req.user?.type === 'organizer';
    res.json(events.map((ev) => sanitizeEventForViewer(ev, isOrganizer)));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { matchId, eventId } = req.params;
    if (!matchId || !eventId) return validationError(res, 'matchId y eventId requeridos');
    const { event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches, notes, extra_json, competition_id } = req.body || {};
    if (event_type !== undefined && !isValidEventType(event_type)) {
      return validationError(res, `event_type invalido. Valores aceptados: ${VALID_EVENT_TYPES.join(', ')}`);
    }
    if (event_type === TENNIS_SET_EVENT_TYPE) {
      return validationError(res, 'Usá PUT /matches/:matchId/tennis-score para cargar sets de tenis');
    }
    const event = await matchEventService.update({
      matchId, eventId, eventType: event_type, competitionId: competition_id, inscriptionId: inscription_id, linkedMemberId: linked_member_id,
      displayName: display_name, minute, suspensionMatches: suspension_matches, notes, extraJson: extra_json,
    });
    res.json(event);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { matchId, eventId } = req.params;
    if (!matchId || !eventId) return validationError(res, 'matchId y eventId requeridos');
    res.json(await matchEventService.remove({ matchId, eventId }));
  } catch (e) {
    next(e);
  }
}
