import * as profileService from '../services/profile.service.js';

export async function getMe(req, res, next) {
  try {
    res.json(await profileService.getMyProfile(req.user.sub));
  } catch (e) {
    next(e);
  }
}

export async function claimByDni(req, res, next) {
  try {
    const { dni, firstName, lastName, avatarUrl } = req.body || {};
    res.json(await profileService.claimByDni({ userId: req.user.sub, dni, firstName, lastName, avatarUrl }));
  } catch (e) {
    next(e);
  }
}

export async function lookup(req, res, next) {
  try {
    const { dni, userId } = req.query;
    let profile = null;
    if (dni !== undefined) {
      profile = await profileService.findByDni(String(dni));
    } else if (userId !== undefined) {
      profile = await profileService.findByUser(Number(userId));
    } else {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'dni or userId query required' } });
    }
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'profile not found' } });
    res.json({ profile });
  } catch (e) {
    next(e);
  }
}

export async function unlink(req, res, next) {
  try {
    const participantId = Number(req.params.id);
    if (!participantId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'invalid participant id' } });
    }
    res.json(await profileService.unlinkParticipant({ userId: req.user.sub, participantId }));
  } catch (e) {
    next(e);
  }
}
