import * as inviteService from '../services/invite.service.js';

function validationError(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

export async function list(req, res, next) {
  try {
    res.json(await inviteService.getTeamInvites({ user: req.user }));
  } catch (e) {
    next(e);
  }
}

export async function accept(req, res, next) {
  try {
    const inviteId = Number(req.params.id);
    if (!inviteId) return validationError(res, 'inviteId invalido');
    res.json(await inviteService.acceptTeamInvite({ inviteId, user: req.user }));
  } catch (e) {
    next(e);
  }
}

export async function reject(req, res, next) {
  try {
    const inviteId = Number(req.params.id);
    if (!inviteId) return validationError(res, 'inviteId invalido');
    res.json(await inviteService.rejectTeamInvite({ inviteId, user: req.user }));
  } catch (e) {
    next(e);
  }
}
