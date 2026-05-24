import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
import { httpLogger, logger } from './logger.js';
import {
  normalizeDni,
  nowIso,
  hashTeamCode,
  generateTeamCode,
  normalizeInvitePrefix,
  randomThreeDigits,
  generateUniqueInviteCode,
} from './utils.js';

export {
  normalizeDni,
  nowIso,
  hashTeamCode,
  generateTeamCode,
  normalizeInvitePrefix,
  randomThreeDigits,
  generateUniqueInviteCode,
  optionalAuthMiddleware,
  requireAuthMiddleware,
  isTeamOwner,
  canWriteTeam,
  autoLinkParticipantByDni,
};

const PORT = process.env.PORT || 4002;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';

function assertRequiredEnv(name) {
  if (!process.env[name]) {
    logger.fatal({ missingEnv: name }, 'missing required env');
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production') {
  assertRequiredEnv('JWT_SECRET');
  assertRequiredEnv('POSTGRES_URL');
}
const { Pool } = pkg;
const pool = new Pool({
  connectionString: POSTGRES_URL,
  allowExitOnIdle: process.env.NODE_ENV === 'test',
});

function optionalAuthMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

async function autoLinkParticipantByDni(client, participantId, dni) {
  if (!dni) return null;
  const profile = await client.query(
    `SELECT id FROM "Person_Profile" WHERE dni = $1 LIMIT 1`,
    [dni]
  );
  if (profile.rows.length === 0) return null;
  const profileId = profile.rows[0].id;
  await client.query(
    `UPDATE "Participant"
     SET person_profile_id = $1, updated_at = $2
     WHERE id = $3`,
    [profileId, nowIso(), participantId]
  );
  return profileId;
}

function requireAuthMiddleware(req, res, next) {
  if (!req.user) {
    logger.warn({ reqId: req.id }, 'unauthorized request');
    return res.status(401).json({ error: 'UNAUTHORIZED: token requerido' });
  }
  return next();
}

async function isTeamOwner(client, teamId, userId) {
  if (!userId) return false;
  const r = await client.query(
    `SELECT 1 FROM "Team" WHERE id = $1 AND owner_user_id = $2`,
    [teamId, userId]
  );
  return r.rows.length > 0;
}

async function canWriteTeam(client, teamId, userId, teamCode) {
  if (await isTeamOwner(client, teamId, userId)) return true;
  if (!teamCode) return false;
  const r = await client.query(
    `SELECT access_code_hash FROM "Team" WHERE id = $1 LIMIT 1`,
    [teamId]
  );
  if (r.rows.length === 0) return false;
  const storedHash = r.rows[0].access_code_hash;
  if (!storedHash) return false;
  return storedHash === hashTeamCode(teamCode);
}

const app = express();
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['*'];
app.use(cors({ origin: corsOrigins.length === 0 ? '*' : corsOrigins }));
app.use(bodyParser.json());
app.use(httpLogger);
app.use(optionalAuthMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/teams', requireAuthMiddleware, async (req, res) => {
  const onlyMine = String(req.query.mine || '').toLowerCase() === 'true';
  const client = await pool.connect();
  try {
    if (!onlyMine) {
      const all = await client.query(
        `SELECT id, name, owner_user_id, badge_url, invite_code, created_at, updated_at
         FROM "Team"
         ORDER BY id DESC`
      );
      return res.json({ teams: all.rows });
    }
    const mine = await client.query(
      `WITH owned AS (
         SELECT t.id, t.name, t.owner_user_id, t.badge_url, t.invite_code, t.created_at, t.updated_at
         FROM "Team" t
         WHERE t.owner_user_id = $1
       ),
       linked AS (
         SELECT DISTINCT t.id, t.name, t.owner_user_id, t.badge_url, t.invite_code, t.created_at, t.updated_at
         FROM "Team" t
         JOIN "Team_Member" tm ON tm.team_id = t.id
         JOIN "Participant" p ON p.id = tm.participant_id
         JOIN "Person_Profile" pp ON pp.id = p.person_profile_id
         WHERE pp.user_id = $1
       )
       SELECT DISTINCT * FROM (
         SELECT * FROM owned
         UNION
         SELECT * FROM linked
       ) q
       ORDER BY id DESC`,
      [req.user.sub]
    );
    return res.json({ teams: mine.rows });
  } catch (e) {
    logger.error({ err: e }, 'list teams error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/teams', requireAuthMiddleware, async (req, res) => {
  const { name, badgeUrl } = req.body || {};
  logger.info({ reqId: req.id, userId: req.user?.sub, hasName: Boolean(name) }, 'create team request');
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const accessCode = generateTeamCode();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteCode = await generateUniqueInviteCode(client, String(name).trim());
    const r = await client.query(
      `INSERT INTO "Team"(name, owner_user_id, badge_url, access_code_hash, invite_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, name, owner_user_id, badge_url, invite_code, created_at, updated_at`,
      [String(name).trim(), req.user.sub, badgeUrl || null, hashTeamCode(accessCode), inviteCode, nowIso()]
    );
    await client.query('COMMIT');
    return res.status(201).json({ team: r.rows[0], accessCode });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e, reqId: req.id, userId: req.user?.sub }, 'create team error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.patch('/teams/:id', async (req, res) => {
  const teamId = Number(req.params.id);
  const { name, badgeUrl, teamCode } = req.body || {};
  if (!teamId) return res.status(400).json({ error: 'invalid team id' });
  try {
    const client = await pool.connect();
    try {
      const allowed = await canWriteTeam(client, teamId, req.user?.sub, teamCode);
      if (!allowed) {
        return res.status(403).json({ error: 'FORBIDDEN: team code or owner token required' });
      }
      const r = await client.query(
        `UPDATE "Team"
         SET name = COALESCE($2, name),
             badge_url = COALESCE($3, badge_url),
             updated_at = $4
         WHERE id = $1
         RETURNING id, name, owner_user_id, badge_url, invite_code, created_at, updated_at`,
        [teamId, name?.trim() || null, badgeUrl || null, nowIso()]
      );
      return res.json({ team: r.rows[0] });
    } finally {
      client.release();
    }
  } catch (e) {
    logger.error({ err: e }, 'update team error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

async function createParticipantHandler(req, res) {
  const { firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode } = req.body || {};
  logger.info({ reqId: req.id, userId: req.user?.sub, hasTeamId: Boolean(teamId) }, 'create participant request');
  if (!firstName || !String(firstName).trim()) return res.status(400).json({ error: 'firstName required' });
  if (!lastName || !String(lastName).trim()) return res.status(400).json({ error: 'lastName required' });
  const normalizedDni = normalizeDni(dni);
  if (dni && !normalizedDni) return res.status(400).json({ error: 'invalid dni (AR expected 7-8 digits)' });

  const displayName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (teamId) {
      const allowed = await canWriteTeam(client, Number(teamId), req.user?.sub, teamCode);
      if (!allowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'FORBIDDEN: team code or owner token required' });
      }
    }
    const created = await client.query(
      `INSERT INTO "Participant"(
        name, first_name, last_name, nickname, dni, avatar_url, created_by_user_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
      RETURNING id, name, first_name, last_name, nickname, dni, avatar_url, person_profile_id, created_by_user_id, created_at, updated_at`,
      [
        displayName,
        String(firstName).trim(),
        String(lastName).trim(),
        nickname?.trim() || null,
        normalizedDni,
        avatarUrl || null,
        req.user?.sub ?? null,
        nowIso()
      ]
    );
    const participant = created.rows[0];

    const linkedProfileId = await autoLinkParticipantByDni(client, participant.id, normalizedDni);
    if (linkedProfileId) participant.person_profile_id = linkedProfileId;

    if (teamId) {
      await client.query(
        `INSERT INTO "Team_Member"(team_id, participant_id, created_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (team_id, participant_id) DO NOTHING`,
        [Number(teamId), participant.id, nowIso()]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ participant });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e, reqId: req.id, userId: req.user?.sub }, 'create participant error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
}

app.post('/participants', createParticipantHandler);

async function updateParticipantHandler(req, res) {
  const participantId = Number(req.params.id);
  const { firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode } = req.body || {};
  if (!participantId) return res.status(400).json({ error: 'invalid participant id' });
  if (!teamId) return res.status(400).json({ error: 'teamId required for participant update' });

  const normalizedDni = dni === undefined ? undefined : normalizeDni(dni);
  if (dni !== undefined && dni !== '' && !normalizedDni) {
    return res.status(400).json({ error: 'invalid dni (AR expected 7-8 digits)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allowed = await canWriteTeam(client, Number(teamId), req.user?.sub, teamCode);
    if (!allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: team code or owner token required' });
    }

    const membership = await client.query(
      `SELECT 1 FROM "Team_Member" WHERE team_id = $1 AND participant_id = $2 LIMIT 1`,
      [Number(teamId), participantId]
    );
    if (membership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'participant is not member of this team' });
    }

    const updated = await client.query(
      `UPDATE "Participant"
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           nickname = CASE WHEN $4 = '__CLEAR__' THEN NULL ELSE COALESCE($4, nickname) END,
           dni = CASE WHEN $5 = '__CLEAR__' THEN NULL ELSE COALESCE($5, dni) END,
           avatar_url = CASE WHEN $6 = '__CLEAR__' THEN NULL ELSE COALESCE($6, avatar_url) END,
           name = CONCAT(
             COALESCE($2, first_name),
             ' ',
             COALESCE($3, last_name)
           ),
           updated_at = $7
       WHERE id = $1
       RETURNING id, name, first_name, last_name, nickname, dni, avatar_url, person_profile_id, created_by_user_id, created_at, updated_at`,
      [
        participantId,
        firstName?.trim() || null,
        lastName?.trim() || null,
        nickname === '' ? '__CLEAR__' : (nickname ?? null),
        dni === '' ? '__CLEAR__' : (normalizedDni ?? null),
        avatarUrl === '' ? '__CLEAR__' : (avatarUrl ?? null),
        nowIso()
      ]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'participant not found' });
    }

    if (normalizedDni) {
      const linkedProfileId = await autoLinkParticipantByDni(client, participantId, normalizedDni);
      if (linkedProfileId) updated.rows[0].person_profile_id = linkedProfileId;
    }

    await client.query('COMMIT');
    return res.json({ participant: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e }, 'update participant error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
}

app.patch('/participants/:id', updateParticipantHandler);

app.post('/teams/:id/members', async (req, res) => {
  const teamId = Number(req.params.id);
  const { participantId, teamCode } = req.body || {};
  if (!teamId || !participantId) return res.status(400).json({ error: 'teamId and participantId required' });
  const client = await pool.connect();
  try {
    const allowed = await canWriteTeam(client, teamId, req.user?.sub, teamCode);
    if (!allowed) {
      return res.status(403).json({ error: 'FORBIDDEN: team code or owner token required' });
    }
    await client.query(
      `INSERT INTO "Team_Member"(team_id, participant_id, created_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (team_id, participant_id) DO NOTHING`,
      [teamId, Number(participantId), nowIso()]
    );
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'add member error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.delete('/teams/:id/members/:participantId', async (req, res) => {
  const teamId = Number(req.params.id);
  const participantId = Number(req.params.participantId);
  const { teamCode } = req.body || {};
  if (!teamId || !participantId) return res.status(400).json({ error: 'invalid teamId or participantId' });
  const client = await pool.connect();
  try {
    const allowed = await canWriteTeam(client, teamId, req.user?.sub, teamCode);
    if (!allowed) {
      return res.status(403).json({ error: 'FORBIDDEN: team code or owner token required' });
    }
    await client.query(
      `DELETE FROM "Team_Member" WHERE team_id = $1 AND participant_id = $2`,
      [teamId, participantId]
    );
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'remove member error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/profiles/me/claim-by-dni', requireAuthMiddleware, async (req, res) => {
  const { dni, firstName, lastName, avatarUrl } = req.body || {};
  const normalizedDni = normalizeDni(dni);
  if (!normalizedDni) return res.status(400).json({ error: 'valid dni required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingByDni = await client.query(
      `SELECT id, user_id FROM "Person_Profile" WHERE dni = $1 LIMIT 1`,
      [normalizedDni]
    );
    if (existingByDni.rows.length > 0 && Number(existingByDni.rows[0].user_id) !== Number(req.user.sub)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'dni already claimed by another profile' });
    }

    const profileUpsert = await client.query(
      `INSERT INTO "Person_Profile"(user_id, dni, first_name, last_name, avatar_url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (user_id) DO UPDATE
       SET dni = EXCLUDED.dni,
           first_name = COALESCE(EXCLUDED.first_name, "Person_Profile".first_name),
           last_name = COALESCE(EXCLUDED.last_name, "Person_Profile".last_name),
           avatar_url = COALESCE(EXCLUDED.avatar_url, "Person_Profile".avatar_url),
           updated_at = EXCLUDED.updated_at
       RETURNING id, user_id, dni, first_name, last_name, avatar_url, created_at, updated_at`,
      [req.user.sub, normalizedDni, firstName || null, lastName || null, avatarUrl || null, nowIso()]
    );
    const profile = profileUpsert.rows[0];

    const linked = await client.query(
      `UPDATE "Participant"
       SET person_profile_id = $1,
           updated_at = $3
       WHERE dni = $2
       RETURNING id`,
      [profile.id, normalizedDni, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({ profile, linkedParticipants: linked.rows.map(r => r.id) });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e }, 'claim by dni error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/profiles/me', requireAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const profileRes = await client.query(
      `SELECT id, user_id, dni, first_name, last_name, avatar_url, created_at, updated_at
       FROM "Person_Profile"
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.sub]
    );
    if (profileRes.rows.length === 0) return res.json({ profile: null, participants: [], teams: [] });
    const profile = profileRes.rows[0];

    const participantsRes = await client.query(
      `SELECT id, first_name, last_name, nickname, dni, avatar_url, person_profile_id
       FROM "Participant"
       WHERE person_profile_id = $1
       ORDER BY id`,
      [profile.id]
    );

    const teamsRes = await client.query(
      `SELECT DISTINCT t.id, t.name, t.badge_url
       FROM "Team" t
       JOIN "Team_Member" tm ON tm.team_id = t.id
       JOIN "Participant" p ON p.id = tm.participant_id
       WHERE p.person_profile_id = $1
       ORDER BY t.id`,
      [profile.id]
    );

    return res.json({
      profile,
      participants: participantsRes.rows,
      teams: teamsRes.rows,
    });
  } catch (e) {
    logger.error({ err: e }, 'profile read error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.delete('/profiles/me/participants/:id/unlink', requireAuthMiddleware, async (req, res) => {
  const participantId = Number(req.params.id);
  if (!participantId) return res.status(400).json({ error: 'invalid participant id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const profileRes = await client.query(
      `SELECT id FROM "Person_Profile" WHERE user_id = $1 LIMIT 1`,
      [req.user.sub]
    );
    if (profileRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'profile not found' });
    }
    const profileId = profileRes.rows[0].id;

    const updated = await client.query(
      `UPDATE "Participant"
       SET person_profile_id = NULL,
           dni = NULL,
           updated_at = $3
       WHERE id = $1 AND person_profile_id = $2
       RETURNING id`,
      [participantId, profileId, nowIso()]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'participant not linked to your profile' });
    }
    await client.query('COMMIT');
    return res.json({ ok: true, participantId });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e }, 'unlink participant error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/teams/:id', async (req, res) => {
  const teamId = Number(req.params.id);
  if (!teamId) return res.status(400).json({ error: 'invalid team id' });
  const client = await pool.connect();
  try {
    const teamRes = await client.query(
      `SELECT id, name, owner_user_id, badge_url, invite_code, created_at, updated_at
       FROM "Team"
       WHERE id = $1
       LIMIT 1`,
      [teamId]
    );
    if (teamRes.rows.length === 0) return res.status(404).json({ error: 'team not found' });

    const members = await client.query(
      `SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.dni, p.person_profile_id
       FROM "Team_Member" tm
       JOIN "Participant" p ON p.id = tm.participant_id
       WHERE tm.team_id = $1
       ORDER BY p.id`,
      [teamId]
    );
    return res.json({ team: teamRes.rows[0], members: members.rows });
  } catch (e) {
    logger.error({ err: e }, 'team read error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/teams/:id/access-code/rotate', requireAuthMiddleware, async (req, res) => {
  const teamId = Number(req.params.id);
  if (!teamId) return res.status(400).json({ error: 'invalid team id' });
  const client = await pool.connect();
  try {
    if (!(await isTeamOwner(client, teamId, req.user.sub))) {
      return res.status(403).json({ error: 'FORBIDDEN: only owner can rotate access code' });
    }
    const accessCode = generateTeamCode();
    await client.query(
      `UPDATE "Team" SET access_code_hash = $2, updated_at = $3 WHERE id = $1`,
      [teamId, hashTeamCode(accessCode), nowIso()]
    );
    return res.json({ teamId, accessCode });
  } catch (e) {
    logger.error({ err: e }, 'rotate access code error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/teams/me/invite-code', requireAuthMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const found = await client.query(
      `SELECT id, name, invite_code
       FROM "Team"
       WHERE owner_user_id = $1
       ORDER BY id
       LIMIT 1`,
      [req.user.sub]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'team not found for current user' });
    return res.json({
      teamId: found.rows[0].id,
      teamName: found.rows[0].name,
      inviteCode: found.rows[0].invite_code,
    });
  } catch (e) {
    logger.error({ err: e }, 'get team invite code error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/teams/resolve-by-invite-code/:code', requireAuthMiddleware, async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}-\d{3}$/.test(code)) return res.status(400).json({ error: 'invalid invite code format' });
  const client = await pool.connect();
  try {
    const found = await client.query(
      `SELECT id, name, badge_url, invite_code
       FROM "Team"
       WHERE invite_code = $1
       LIMIT 1`,
      [code]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'team not found' });
    return res.json({ team: found.rows[0] });
  } catch (e) {
    logger.error({ err: e }, 'resolve by invite code error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'running');
  });
}

async function closePool() {
  await pool.end();
}

export { app, closePool };

