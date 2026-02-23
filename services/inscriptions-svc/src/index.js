import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const PORT = process.env.PORT || 4004;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';

const { Pool } = pg;
const pool = new Pool({ connectionString: POSTGRES_URL });

function nowIso() {
  return new Date().toISOString();
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Inscription" (
      id SERIAL PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      competitor_kind TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      linked_team_id INTEGER NULL,
      display_name TEXT NOT NULL,
      badge_url TEXT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by_user_id INTEGER NULL,
      reviewed_by_user_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament ON "Inscription"(tournament_id);

    CREATE TABLE IF NOT EXISTS "Tournament_Invite" (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      tournament_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tournament_invite_tournament ON "Tournament_Invite"(tournament_id);

    CREATE TABLE IF NOT EXISTS "Tournament_Invite_Claim" (
      id SERIAL PRIMARY KEY,
      invite_id INTEGER NOT NULL REFERENCES "Tournament_Invite"(id) ON DELETE CASCADE,
      user_id INTEGER NULL,
      mode TEXT NOT NULL,
      inscription_id INTEGER NULL REFERENCES "Inscription"(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tournament_invite_claim_invite ON "Tournament_Invite_Claim"(invite_id);
  `);

  await pool.query(`
    ALTER TABLE "Tournament_Invite" ADD COLUMN IF NOT EXISTS invite_type TEXT;
    ALTER TABLE "Tournament_Invite" ADD COLUMN IF NOT EXISTS target_inscription_id INTEGER NULL REFERENCES "Inscription"(id) ON DELETE SET NULL;
    ALTER TABLE "Tournament_Invite" ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ NULL;
    ALTER TABLE "Tournament_Invite" ADD COLUMN IF NOT EXISTS consumed_by_user_id INTEGER NULL;
    UPDATE "Tournament_Invite" SET invite_type = 'general' WHERE invite_type IS NULL;
    ALTER TABLE "Tournament_Invite" ALTER COLUMN invite_type SET DEFAULT 'general';
  `);
}

function optionalAuthMiddleware(req, _res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = auth.slice('Bearer '.length);
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

function requireAuthMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED: token requerido' });
  return next();
}

function requireOrganizer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED: token requerido' });
  if (req.user.type !== 'organizer') return res.status(403).json({ error: 'FORBIDDEN: organizer requerido' });
  return next();
}

function requireTeamUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED: token requerido' });
  if (req.user.type !== 'team') return res.status(403).json({ error: 'FORBIDDEN: usuario team requerido' });
  return next();
}

async function getOwnedTeamForUser(client, userId) {
  const teams = await client.query(
    `SELECT id, name, badge_url
     FROM "Team"
     WHERE owner_user_id = $1
     ORDER BY id`,
    [userId]
  );
  if (teams.rows.length === 0) {
    throw new Error('FORBIDDEN: tu usuario team no tiene equipo creado');
  }
  if (teams.rows.length > 1) {
    throw new Error('FORBIDDEN: un usuario no puede gestionar multiples equipos en este flujo');
  }
  return teams.rows[0];
}

async function assertSingleTeamAssociationRule(client, tournamentId, userId, teamId) {
  const r = await client.query(
    `SELECT DISTINCT linked_team_id
     FROM "Inscription"
     WHERE tournament_id = $1
       AND competitor_kind = 'team'
       AND requested_by_user_id = $2
       AND status <> 'rejected'
       AND linked_team_id IS NOT NULL`,
    [tournamentId, userId]
  );
  if (r.rows.length === 0) return;
  const hasSame = r.rows.some((row) => Number(row.linked_team_id) === Number(teamId));
  if (!hasSame) {
    throw new Error('FORBIDDEN: tu usuario team ya esta asociado a otro equipo en este torneo');
  }
}

function ensureActiveInvite(invite) {
  if (!invite) throw new Error('invite not found');
  if (invite.status !== 'active') throw new Error('invite not active');
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) throw new Error('invite expired');
}

async function createOrReuseGeneralInvite(req, res) {
  const { tournamentId, expiresAt } = req.body || {};
  const tournament = String(tournamentId || '').trim();
  if (!tournament) return res.status(400).json({ error: 'tournamentId requerido' });
  try {
    const active = await pool.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
       FROM "Tournament_Invite"
       WHERE tournament_id = $1
         AND invite_type = 'general'
         AND status = 'active'
         AND consumed_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY id DESC
       LIMIT 1`,
      [tournament]
    );
    if (active.rows.length > 0) {
      return res.json({ invite: active.rows[0], reused: true });
    }
    const token = crypto.randomBytes(20).toString('hex');
    const created = await pool.query(
      `INSERT INTO "Tournament_Invite"(
        token, tournament_id, invite_type, target_inscription_id, status,
        expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
      ) VALUES ($1, $2, 'general', NULL, 'active', $3, NULL, NULL, $4, $5)
      RETURNING id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at`,
      [token, tournament, expiresAt || null, req.user.sub, nowIso()]
    );
    return res.status(201).json({ invite: created.rows[0], reused: false });
  } catch (e) {
    console.error('[inscriptions-svc] create general invite error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(optionalAuthMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/invites', requireOrganizer, async (req, res) => {
  const tournamentId = String(req.query.tournamentId || '').trim();
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId requerido' });
  try {
    const r = await pool.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
       FROM "Tournament_Invite"
       WHERE tournament_id = $1
       ORDER BY id DESC`,
      [tournamentId]
    );
    return res.json({ invites: r.rows });
  } catch (e) {
    console.error('[inscriptions-svc] list invites error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/invites', requireOrganizer, createOrReuseGeneralInvite);
app.post('/invites/general', requireOrganizer, createOrReuseGeneralInvite);

app.post('/invites/team', requireOrganizer, async (req, res) => {
  const { tournamentId, targetInscriptionId, expiresAt } = req.body || {};
  const tournament = String(tournamentId || '').trim();
  const inscriptionId = Number(targetInscriptionId);
  if (!tournament) return res.status(400).json({ error: 'tournamentId requerido' });
  if (!inscriptionId) return res.status(400).json({ error: 'targetInscriptionId requerido' });
  try {
    const target = await pool.query(
      `SELECT id, tournament_id, competitor_kind, source, display_name
       FROM "Inscription"
       WHERE id = $1
       LIMIT 1`,
      [inscriptionId]
    );
    if (target.rows.length === 0) return res.status(404).json({ error: 'inscription not found' });
    const row = target.rows[0];
    if (String(row.tournament_id) !== tournament) return res.status(400).json({ error: 'inscription no pertenece al torneo' });
    if (row.competitor_kind !== 'team') return res.status(400).json({ error: 'solo aplica a inscripciones de equipo' });

    const active = await pool.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
       FROM "Tournament_Invite"
       WHERE tournament_id = $1
         AND invite_type = 'team'
         AND target_inscription_id = $2
         AND status = 'active'
         AND consumed_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY id DESC
       LIMIT 1`,
      [tournament, inscriptionId]
    );
    if (active.rows.length > 0) return res.json({ invite: active.rows[0], reused: true });

    const token = crypto.randomBytes(20).toString('hex');
    const created = await pool.query(
      `INSERT INTO "Tournament_Invite"(
        token, tournament_id, invite_type, target_inscription_id, status,
        expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
      ) VALUES ($1, $2, 'team', $3, 'active', $4, NULL, NULL, $5, $6)
      RETURNING id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at`,
      [token, tournament, inscriptionId, expiresAt || null, req.user.sub, nowIso()]
    );
    return res.status(201).json({ invite: created.rows[0], reused: false });
  } catch (e) {
    console.error('[inscriptions-svc] create team invite error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/invites/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });
  try {
    const r = await pool.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id, created_at
       FROM "Tournament_Invite"
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'invite not found' });
    const invite = r.rows[0];
    if (invite.status !== 'active') return res.status(410).json({ error: 'invite not active' });
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ error: 'invite expired' });
    }
    let target = null;
    if (invite.target_inscription_id) {
      const t = await pool.query(
        `SELECT id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status
         FROM "Inscription"
         WHERE id = $1
         LIMIT 1`,
        [invite.target_inscription_id]
      );
      target = t.rows[0] || null;
    }
    return res.json({
      invite: {
        id: invite.id,
        token: invite.token,
        tournamentId: invite.tournament_id,
        inviteType: invite.invite_type || 'general',
        targetInscriptionId: invite.target_inscription_id,
        status: invite.status,
        expiresAt: invite.expires_at,
        consumedAt: invite.consumed_at,
        consumedByUserId: invite.consumed_by_user_id,
        target,
      },
    });
  } catch (e) {
    console.error('[inscriptions-svc] get invite error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/invites/:token/claim-general', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const mode = String(req.body?.mode || '').toLowerCase();
  const displayName = String(req.body?.displayName || '').trim();
  const badgeUrl = req.body?.badgeUrl || null;
  if (!token) return res.status(400).json({ error: 'token requerido' });
  if (!['without_account', 'with_account'].includes(mode)) return res.status(400).json({ error: 'mode invalido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id
       FROM "Tournament_Invite"
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    if (inv.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite not found' });
    }
    const invite = inv.rows[0];
    try {
      ensureActiveInvite(invite);
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: e.message });
    }
    if ((invite.invite_type || 'general') !== 'general') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite type mismatch: expected general' });
    }

    if (mode === 'without_account') {
      if (!displayName) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'displayName requerido para inscripcion sin cuenta' });
      }
      const inserted = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
          requested_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, 'team', 'manual', NULL, $2, $3, 'approved', NULL, $4, $5, $5)
        RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                  requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, displayName, badgeUrl, invite.created_by_user_id, nowIso()]
      );
      const claim = await client.query(
        `INSERT INTO "Tournament_Invite_Claim"(invite_id, user_id, mode, inscription_id, created_at)
         VALUES ($1, NULL, 'without_account', $2, $3)
         RETURNING id, invite_id, user_id, mode, inscription_id, created_at`,
        [invite.id, inserted.rows[0].id, nowIso()]
      );
      await client.query('COMMIT');
      return res.json({
        ok: true,
        mode: 'without_account',
        claim: claim.rows[0],
        invite: { tournamentId: invite.tournament_id },
        inscription: inserted.rows[0],
      });
    }

    if (!req.user) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'UNAUTHORIZED: token requerido para asociar' });
    }
    if (req.user.type !== 'team') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: usuario team requerido' });
    }

    const ownedTeam = await getOwnedTeamForUser(client, req.user.sub);
    await assertSingleTeamAssociationRule(client, invite.tournament_id, req.user.sub, ownedTeam.id);

    const existing = await client.query(
      `SELECT id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
              requested_by_user_id, reviewed_by_user_id, created_at, updated_at
       FROM "Inscription"
       WHERE tournament_id = $1
         AND competitor_kind = 'team'
         AND linked_team_id = $2
         AND status <> 'rejected'
       ORDER BY id DESC
       LIMIT 1`,
      [invite.tournament_id, ownedTeam.id]
    );
    let inscription;
    if (existing.rows.length > 0) {
      inscription = existing.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
          requested_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, 'team', 'self', $2, $3, $4, 'approved', $5, $6, $7, $7)
        RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                  requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, ownedTeam.id, ownedTeam.name, ownedTeam.badge_url || badgeUrl, req.user.sub, invite.created_by_user_id, nowIso()]
      );
      inscription = inserted.rows[0];
    }

    const claim = await client.query(
      `INSERT INTO "Tournament_Invite_Claim"(invite_id, user_id, mode, inscription_id, created_at)
       VALUES ($1, $2, 'with_account', $3, $4)
       RETURNING id, invite_id, user_id, mode, inscription_id, created_at`,
      [invite.id, req.user.sub, inscription.id, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({
      ok: true,
      mode: 'with_account',
      invite: { tournamentId: invite.tournament_id },
      claim: claim.rows[0],
      inscription,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[inscriptions-svc] claim invite error', e);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/invites/:token/claim-team', requireTeamUser, async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id
       FROM "Tournament_Invite"
       WHERE token = $1
       LIMIT 1
       FOR UPDATE`,
      [token]
    );
    if (inv.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite not found' });
    }
    const invite = inv.rows[0];
    try {
      ensureActiveInvite(invite);
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: e.message });
    }
    if ((invite.invite_type || 'general') !== 'team') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite type mismatch: expected team' });
    }
    if (!invite.target_inscription_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite team sin target_inscription_id' });
    }
    if (invite.consumed_at) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'invite already consumed' });
    }

    const target = await client.query(
      `SELECT id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
              requested_by_user_id, reviewed_by_user_id, created_at, updated_at
       FROM "Inscription"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [invite.target_inscription_id]
    );
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'target inscription not found' });
    }
    const targetInscription = target.rows[0];
    if (String(targetInscription.tournament_id) !== String(invite.tournament_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'target inscription no pertenece al torneo del invite' });
    }
    if (targetInscription.competitor_kind !== 'team') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'target inscription no es team' });
    }
    if (targetInscription.linked_team_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'este equipo del torneo ya fue asociado' });
    }

    const ownedTeam = await getOwnedTeamForUser(client, req.user.sub);
    await assertSingleTeamAssociationRule(client, invite.tournament_id, req.user.sub, ownedTeam.id);

    const updated = await client.query(
      `UPDATE "Inscription"
       SET linked_team_id = $2,
           display_name = $3,
           badge_url = COALESCE($4, badge_url),
           status = 'approved',
           requested_by_user_id = $5,
           reviewed_by_user_id = $6,
           updated_at = $7
       WHERE id = $1
       RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                 requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [
        targetInscription.id,
        ownedTeam.id,
        ownedTeam.name,
        ownedTeam.badge_url || null,
        req.user.sub,
        invite.created_by_user_id,
        nowIso(),
      ]
    );

    const claim = await client.query(
      `INSERT INTO "Tournament_Invite_Claim"(invite_id, user_id, mode, inscription_id, created_at)
       VALUES ($1, $2, 'team_claim', $3, $4)
       RETURNING id, invite_id, user_id, mode, inscription_id, created_at`,
      [invite.id, req.user.sub, targetInscription.id, nowIso()]
    );

    await client.query(
      `UPDATE "Tournament_Invite"
       SET status = 'consumed',
           consumed_at = $2,
           consumed_by_user_id = $3
       WHERE id = $1`,
      [invite.id, nowIso(), req.user.sub]
    );
    await client.query('COMMIT');
    return res.json({
      ok: true,
      mode: 'team_claim',
      invite: { tournamentId: invite.tournament_id },
      claim: claim.rows[0],
      inscription: updated.rows[0],
    });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    console.error('[inscriptions-svc] claim team invite error', e);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/invites/:token/claim', async (req, res) => {
  const mode = String(req.body?.mode || '').toLowerCase();
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });
  if (!['view', 'associate'].includes(mode)) return res.status(400).json({ error: 'mode invalido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inv = await client.query(
      `SELECT id, token, tournament_id, invite_type, target_inscription_id, status, expires_at, consumed_at, consumed_by_user_id, created_by_user_id
       FROM "Tournament_Invite"
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    if (inv.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite not found' });
    }
    const invite = inv.rows[0];
    try {
      ensureActiveInvite(invite);
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: e.message });
    }
    if ((invite.invite_type || 'general') !== 'general') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite type mismatch: expected general' });
    }

    if (mode === 'view') {
      const displayName = String(req.body?.displayName || 'Equipo invitado').trim();
      const inserted = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
          requested_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, 'team', 'manual', NULL, $2, NULL, 'approved', NULL, $3, $4, $4)
        RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                  requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, displayName, invite.created_by_user_id, nowIso()]
      );
      const claim = await client.query(
        `INSERT INTO "Tournament_Invite_Claim"(invite_id, user_id, mode, inscription_id, created_at)
         VALUES ($1, NULL, 'view', $2, $3)
         RETURNING id, invite_id, user_id, mode, inscription_id, created_at`,
        [invite.id, inserted.rows[0].id, nowIso()]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, mode: 'view', claim: claim.rows[0], inscription: inserted.rows[0] });
    }

    if (!req.user) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'UNAUTHORIZED: token requerido para asociar' });
    }
    if (req.user.type !== 'team') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: usuario team requerido' });
    }
    const ownedTeam = await getOwnedTeamForUser(client, req.user.sub);
    await assertSingleTeamAssociationRule(client, invite.tournament_id, req.user.sub, ownedTeam.id);
    const existing = await client.query(
      `SELECT id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
              requested_by_user_id, reviewed_by_user_id, created_at, updated_at
       FROM "Inscription"
       WHERE tournament_id = $1
         AND competitor_kind = 'team'
         AND linked_team_id = $2
         AND status <> 'rejected'
       ORDER BY id DESC
       LIMIT 1`,
      [invite.tournament_id, ownedTeam.id]
    );
    let inscription = existing.rows[0] || null;
    if (!inscription) {
      const inserted = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
          requested_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, 'team', 'self', $2, $3, $4, 'approved', $5, $6, $7, $7)
        RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                  requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, ownedTeam.id, ownedTeam.name, ownedTeam.badge_url || null, req.user.sub, invite.created_by_user_id, nowIso()]
      );
      inscription = inserted.rows[0];
    }
    const claim = await client.query(
      `INSERT INTO "Tournament_Invite_Claim"(invite_id, user_id, mode, inscription_id, created_at)
       VALUES ($1, $2, 'associate', $3, $4)
       RETURNING id, invite_id, user_id, mode, inscription_id, created_at`,
      [invite.id, req.user.sub, inscription.id, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({ ok: true, mode: 'associate', claim: claim.rows[0], inscription });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    console.error('[inscriptions-svc] legacy claim error', e);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/inscriptions', requireAuthMiddleware, async (req, res) => {
  const tournamentId = String(req.query.tournamentId || '').trim();
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId requerido' });
  try {
    const r = await pool.query(
      `SELECT id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
              requested_by_user_id, reviewed_by_user_id, created_at, updated_at
       FROM "Inscription"
       WHERE tournament_id = $1
       ORDER BY id DESC`,
      [tournamentId]
    );
    return res.json({ inscriptions: r.rows });
  } catch (e) {
    console.error('[inscriptions-svc] list inscriptions error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/inscriptions/manual-team', requireOrganizer, async (req, res) => {
  const { tournamentId, name, badgeUrl, linkedTeamId } = req.body || {};
  const tournament = String(tournamentId || '').trim();
  const displayName = String(name || '').trim();
  if (!tournament) return res.status(400).json({ error: 'tournamentId requerido' });
  if (!displayName) return res.status(400).json({ error: 'name requerido' });
  try {
    const r = await pool.query(
      `INSERT INTO "Inscription"(
        tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
        requested_by_user_id, reviewed_by_user_id, created_at, updated_at
      ) VALUES ($1, 'team', 'manual', $2, $3, $4, 'approved', $5, $5, $6, $6)
      RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [
        tournament,
        linkedTeamId ? Number(linkedTeamId) : null,
        displayName,
        badgeUrl || null,
        req.user.sub,
        nowIso(),
      ]
    );
    return res.status(201).json({ inscription: r.rows[0] });
  } catch (e) {
    console.error('[inscriptions-svc] create manual team inscription error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/inscriptions', requireAuthMiddleware, async (req, res) => {
  const { tournamentId, competitorKind, linkedTeamId, displayName, badgeUrl } = req.body || {};
  const tournament = String(tournamentId || '').trim();
  const kind = String(competitorKind || '').trim().toLowerCase();
  if (!tournament) return res.status(400).json({ error: 'tournamentId requerido' });
  if (!['team', 'participant'].includes(kind)) return res.status(400).json({ error: 'competitorKind invalido' });
  if (kind === 'team' && !linkedTeamId && !displayName) return res.status(400).json({ error: 'linkedTeamId o displayName requerido para team' });
  try {
    const r = await pool.query(
      `INSERT INTO "Inscription"(
        tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
        requested_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, 'self', $3, $4, $5, 'pending', $6, $7, $7)
      RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [
        tournament,
        kind,
        linkedTeamId ? Number(linkedTeamId) : null,
        displayName || (kind === 'participant' ? `user:${req.user.sub}` : `team:${linkedTeamId}`),
        badgeUrl || null,
        req.user.sub,
        nowIso(),
      ]
    );
    return res.status(201).json({ inscription: r.rows[0] });
  } catch (e) {
    console.error('[inscriptions-svc] create inscription error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.patch('/inscriptions/:id/status', requireOrganizer, async (req, res) => {
  const inscriptionId = Number(req.params.id);
  const status = String(req.body?.status || '').toLowerCase();
  if (!inscriptionId) return res.status(400).json({ error: 'invalid inscription id' });
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status invalido' });
  try {
    const r = await pool.query(
      `UPDATE "Inscription"
       SET status = $2, reviewed_by_user_id = $3, updated_at = $4
       WHERE id = $1
       RETURNING id, tournament_id, competitor_kind, source, linked_team_id, display_name, badge_url, status,
                 requested_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [inscriptionId, status, req.user.sub, nowIso()]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'inscription not found' });
    return res.json({ inscription: r.rows[0] });
  } catch (e) {
    console.error('[inscriptions-svc] update inscription status error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(PORT, async () => {
  await ensureSchema().catch((e) => console.error('[inscriptions-svc] schema init error', e));
  console.log(`[inscriptions-svc] running on http://0.0.0.0:${PORT}`);
});



