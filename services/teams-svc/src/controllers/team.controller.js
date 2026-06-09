import * as teamService from '../services/team.service.js';
import { validateCreateTeam } from '../schema/team.schema.js';

function validationError(res, details) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details } });
}

function parseCsv(value) {
  return value == null ? [] : String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

export async function list(req, res, next) {
  try {
    const { ownerUserId, ids, names, mine, inviteCode } = req.query;
    // Lookups service-to-service (sin auth de usuario).
    if (ownerUserId !== undefined) return res.json(await teamService.listOwnedByUser(Number(ownerUserId)));
    if (ids !== undefined || names !== undefined) {
      return res.json(await teamService.resolveTeams({ ids: parseCsv(ids), names: parseCsv(names) }));
    }
    // Resto requiere token.
    if (!req.user) {
      return next(Object.assign(new Error('token requerido'), { statusCode: 401, code: 'UNAUTHORIZED' }));
    }
    if (inviteCode !== undefined) return res.json(await teamService.resolveByInviteCode(String(inviteCode)));
    return res.json(await teamService.listTeams({ onlyMine: String(mine || '').toLowerCase() === 'true', userId: req.user.sub }));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const errors = validateCreateTeam(req.body);
    if (errors.length > 0) return validationError(res, errors);
    const { name, badgeUrl } = req.body;
    res.status(201).json(await teamService.createTeam({ name, badgeUrl, ownerUserId: req.user.sub }));
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    if (!teamId) return validationError(res, [{ field: 'id', message: 'invalid team id' }]);
    res.json(await teamService.getTeam(teamId));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    if (!teamId) return validationError(res, [{ field: 'id', message: 'invalid team id' }]);
    const { name, badgeUrl, teamCode } = req.body || {};
    res.json(await teamService.updateTeam({ teamId, name, badgeUrl, teamCode, userId: req.user?.sub }));
  } catch (e) {
    next(e);
  }
}

export async function rotateAccessCode(req, res, next) {
  try {
    const teamId = Number(req.params.id);
    if (!teamId) return validationError(res, [{ field: 'id', message: 'invalid team id' }]);
    res.json(await teamService.rotateAccessCode({ teamId, userId: req.user.sub }));
  } catch (e) {
    next(e);
  }
}

export async function getMyInviteCode(req, res, next) {
  try {
    res.json(await teamService.getMyInviteCode(req.user.sub));
  } catch (e) {
    next(e);
  }
}

