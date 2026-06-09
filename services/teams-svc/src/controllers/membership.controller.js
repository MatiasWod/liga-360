import * as membershipService from '../services/membership.service.js';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

export async function add(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    const { participantId, teamCode } = req.body || {};
    if (!teamId || !participantId) {
      return validationError(res, [{ field: 'participantId', message: 'teamId and participantId required' }]);
    }
    res.json(await membershipService.addMember({ teamId, participantId, teamCode, userId: req.user?.sub }));
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    const participantId = Number(req.params.participantId);
    const { teamCode } = req.body || {};
    if (!teamId || !participantId) {
      return validationError(res, [{ field: 'participantId', message: 'invalid teamId or participantId' }]);
    }
    res.json(await membershipService.removeMember({ teamId, participantId, teamCode, userId: req.user?.sub }));
  } catch (e) {
    next(e);
  }
}
