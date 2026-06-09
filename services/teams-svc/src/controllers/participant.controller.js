import * as participantService from '../services/participant.service.js';
import { validateCreateParticipant, validateUpdateParticipant } from '../schema/participant.schema.js';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

export async function create(req, res, next) {
  try {
    const errors = validateCreateParticipant(req.body);
    if (errors.length > 0) return validationError(res, errors);
    const { firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode } = req.body;
    res.status(201).json(await participantService.createParticipant({
      firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode, userId: req.user?.sub,
    }));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const participantId = Number(req.params.id);
    if (!participantId) return validationError(res, [{ field: 'id', message: 'invalid participant id' }]);
    const errors = validateUpdateParticipant(req.body);
    if (errors.length > 0) return validationError(res, errors);
    const { firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode } = req.body;
    res.json(await participantService.updateParticipant({
      participantId, firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode, userId: req.user?.sub,
    }));
  } catch (e) {
    next(e);
  }
}

export async function listByProfile(req, res, next) {
  try {
    const profileId = Number(req.query.personProfileId);
    if (!profileId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'personProfileId required' } });
    res.json(await participantService.listByProfile(profileId));
  } catch (e) {
    next(e);
  }
}
