import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { httpLogger, logger } from './logger.js';

const PORT = process.env.PORT || 4004;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';
const TOURNAMENTS_GRAPHQL_URL = process.env.TOURNAMENTS_GRAPHQL_URL || 'http://localhost:4000/graphql';

const { Pool } = pg;
const pool = new Pool({ connectionString: POSTGRES_URL });

function nowIso() {
  return new Date().toISOString();
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

function requireParticipantUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED: token requerido' });
  if (req.user.type !== 'participant') return res.status(403).json({ error: 'FORBIDDEN: usuario participant requerido' });
  return next();
}

async function getOwnedTeamForUser(client, userId) {
  // Delegado a teams-svc vía HTTP para respetar límites de microservicios
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

async function getOwnedParticipantForUser(client, userId) {
  const participants = await client.query(
    `SELECT p.id,
            p.first_name,
            p.last_name,
            p.nickname
     FROM "Participant" p
     JOIN "Person_Profile" pp ON pp.id = p.person_profile_id
     WHERE pp.user_id = $1
     ORDER BY p.id`,
    [userId]
  );
  if (participants.rows.length === 0) {
    throw new Error('FORBIDDEN: tu usuario participant no tiene perfil de jugador asociado');
  }
  const participant = participants.rows[0];
  const nickname = String(participant.nickname || '').trim();
  const fullName = `${String(participant.first_name || '').trim()} ${String(participant.last_name || '').trim()}`.trim();
  return {
    id: Number(participant.id),
    displayName: fullName || nickname || `Participante ${Number(participant.id)}`,
  };
}

async function assertSingleTeamAssociationRule(client, tournamentId, userId, teamId, inscriptionId) {
  const r = await client.query(
    `SELECT DISTINCT linked_team_id
     FROM "Inscription"
     WHERE tournament_id = $1
       AND created_by_user_id = $2
       AND status <> 'RECHAZADO'
       AND linked_team_id IS NOT NULL
       AND id <> $4`,
    [tournamentId, userId, teamId, inscriptionId]
  );
  if (r.rows.length === 0) return;
  const hasSame = r.rows.some((row) => Number(row.linked_team_id) === Number(teamId));
  if (!hasSame) {
    throw new Error('FORBIDDEN: tu usuario team ya esta asociado a otro equipo en este torneo');
  }
}

async function assertNoTournamentDuplicateInscription(
  client,
  {
    tournamentId,
    linkedTeamId = null,
    linkedParticipantUserId = null,
    displayName = '',
    excludeInscriptionId = null,
  }
) {
  const safeTournamentId = String(tournamentId || '').trim();
  if (!safeTournamentId) return;

  if (linkedTeamId) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `dup:${safeTournamentId}:team:${Number(linkedTeamId)}`,
    ]);
    const existing = await client.query(
      `SELECT id
       FROM "Inscription"
       WHERE tournament_id = $1
         AND linked_team_id = $2
         AND status <> 'RECHAZADO'
         AND ($3::INT IS NULL OR id <> $3)
       LIMIT 1`,
      [safeTournamentId, Number(linkedTeamId), excludeInscriptionId ? Number(excludeInscriptionId) : null]
    );
    if (existing.rows.length > 0) throw new Error('DUPLICATE_TEAM_IN_TOURNAMENT');
    return;
  }

  if (linkedParticipantUserId) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `dup:${safeTournamentId}:participant:${Number(linkedParticipantUserId)}`,
    ]);
    const existingParticipant = await client.query(
      `SELECT id
       FROM "Inscription"
       WHERE tournament_id = $1
         AND linked_participant_user_id = $2
         AND status <> 'RECHAZADO'
         AND ($3::INT IS NULL OR id <> $3)
       LIMIT 1`,
      [safeTournamentId, Number(linkedParticipantUserId), excludeInscriptionId ? Number(excludeInscriptionId) : null]
    );
    if (existingParticipant.rows.length > 0) throw new Error('DUPLICATE_PARTICIPANT_IN_TOURNAMENT');
    return;
  }

  const normalizedDisplayName = String(displayName || '').trim();
  if (!normalizedDisplayName) return;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `dup:${safeTournamentId}:name:${normalizedDisplayName.toLowerCase()}`,
  ]);
  const existingByName = await client.query(
    `SELECT id
     FROM "Inscription"
     WHERE tournament_id = $1
       AND linked_team_id IS NULL
       AND status <> 'RECHAZADO'
       AND LOWER(TRIM(display_name)) = LOWER(TRIM($2))
       AND ($3::INT IS NULL OR id <> $3)
     LIMIT 1`,
    [safeTournamentId, normalizedDisplayName, excludeInscriptionId ? Number(excludeInscriptionId) : null]
  );
  if (existingByName.rows.length > 0) throw new Error('DUPLICATE_TEAM_IN_TOURNAMENT');
}

function ensureInviteUsable(invite) {
  if (!invite) throw new Error('invite not found');
  if (invite.status !== 'active') throw new Error('invite not active');
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) throw new Error('invite expired');
  if (invite.max_uses !== null && Number(invite.uses_count) >= Number(invite.max_uses)) throw new Error('invite max uses reached');
}

function generateTargetedInviteToken() {
  return crypto.randomBytes(20).toString('hex');
}

function generatePublicInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function generateUniqueInviteToken(type) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const token = type === 'public' ? generatePublicInviteCode() : generateTargetedInviteToken();
    const exists = await pool.query(`SELECT 1 FROM "Invite" WHERE token = $1 LIMIT 1`, [token]);
    if (exists.rows.length === 0) return token;
  }
  throw new Error('INVITE_TOKEN_GENERATION_FAILED');
}

async function resolveCompetitionMaxSlots(competitionId) {
  try {
    const query = `
      query CompetitionMaxSlots($id: ID!) {
        competition(id: $id) {
          id
          effectiveMaxSlots
        }
      }
    `;
    const response = await fetch(TOURNAMENTS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: competitionId } }),
    });
    const body = await response.json();
    if (!response.ok || body?.errors?.length) {
      throw new Error('TOURNAMENT_MAX_SLOTS_UNAVAILABLE');
    }
    const maxSlots = Number(body?.data?.competition?.effectiveMaxSlots);
    if (!Number.isFinite(maxSlots) || maxSlots < 0) {
      throw new Error('COMPETITION_MAX_SLOTS_UNAVAILABLE');
    }
    return maxSlots;
  } catch (e) {
    throw new Error('COMPETITION_MAX_SLOTS_UNAVAILABLE');
  }
}

function normalizeTournamentParticipantType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'team' || raw === 'teams') return 'teams';
  if (raw === 'participant' || raw === 'participants' || raw === 'individual' || raw === 'individuals') return 'individuals';
  return 'teams';
}

function assertRoleMatchesParticipantType(userType, participantType) {
  if (userType === 'team' && participantType !== 'teams') {
    throw new Error('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH');
  }
  if (userType === 'participant' && participantType !== 'individuals') {
    throw new Error('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH');
  }
}

async function resolveTournamentAccessConfig(tournamentId) {
  try {
    const query = `
      query TournamentInscriptionMode($id: ID!) {
        tournament(id: $id) {
          id
          inscriptionMode
          participantType
        }
      }
    `;
    const response = await fetch(TOURNAMENTS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: tournamentId } }),
    });
    const body = await response.json();
    if (!response.ok || body?.errors?.length) {
      throw new Error('TOURNAMENT_MODE_UNAVAILABLE');
    }
    const mode = String(body?.data?.tournament?.inscriptionMode || '').trim().toLowerCase();
    const participantType = normalizeTournamentParticipantType(body?.data?.tournament?.participantType);
    if (!['public', 'invitation'].includes(mode)) {
      throw new Error('TOURNAMENT_MODE_UNAVAILABLE');
    }
    return { mode, participantType };
  } catch {
    throw new Error('TOURNAMENT_MODE_UNAVAILABLE');
  }
}

async function clearTournamentInitialAssignments({ tournamentId, inscriptionId, authorization }) {
  const mutation = `
    mutation ClearInscriptionAssignments($tournamentId: ID!, $inscriptionId: ID!) {
      clearInscriptionAssignments(tournamentId: $tournamentId, inscriptionId: $inscriptionId)
    }
  `;
  const response = await fetch(TOURNAMENTS_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      query: mutation,
      variables: { tournamentId: String(tournamentId), inscriptionId: String(inscriptionId) },
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.errors?.length) {
    throw new Error(body?.errors?.[0]?.message || 'INITIAL_ASSIGNMENTS_CLEAR_FAILED');
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(httpLogger);
app.use(optionalAuthMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/inscriptions', async (req, res) => {
  const tournamentId = String(req.body?.tournamentId || '').trim();
  const competitionIdRaw = String(req.body?.competitionId || '').trim();
  const competitionId =
    competitionIdRaw && competitionIdRaw.toLowerCase() !== 'null' && competitionIdRaw.toLowerCase() !== 'undefined'
      ? competitionIdRaw
      : null;
  const displayName = String(req.body?.displayName || '').trim();
  const sourceRaw = String(req.body?.source || 'public').trim().toLowerCase();
  const linkedTeamId = req.body?.linkedTeamId ? Number(req.body.linkedTeamId) : null;
  const competitorKindRaw = String(req.body?.competitorKind || '').trim().toLowerCase();
  const competitorKind = competitorKindRaw === 'participant' ? 'participant' : 'team';
  const linkedParticipantUserIdRaw = req.body?.linkedParticipantUserId;
  const linkedParticipantUserIdFromBody =
    linkedParticipantUserIdRaw === null || linkedParticipantUserIdRaw === undefined
      ? null
      : Number(linkedParticipantUserIdRaw) || null;
  const linkedParticipantUserId =
    competitorKind === 'participant'
      ? (req.user?.type === 'participant'
          ? Number(req.user?.sub || 0) || null
          : linkedParticipantUserIdFromBody)
      : null;
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId requerido' });
  if (!displayName) return res.status(400).json({ error: 'displayName requerido' });
  if (!['public', 'manual'].includes(sourceRaw)) return res.status(400).json({ error: 'source invalido. Usar public o manual' });
  if (sourceRaw === 'manual' && (!req.user || req.user.type !== 'organizer')) {
    return res.status(403).json({ error: 'FORBIDDEN: manual requiere organizer autenticado' });
  }
  try {
    if (sourceRaw === 'public') {
      const { mode, participantType } = await resolveTournamentAccessConfig(tournamentId);
      if (mode !== 'public') {
        return res.status(403).json({ error: 'FORBIDDEN: torneo privado, solo se admite inscripción por invitación' });
      }
      if (req.user?.type === 'team' || req.user?.type === 'participant') {
        assertRoleMatchesParticipantType(req.user.type, participantType);
      }
    }
    let finalDisplayName = displayName;
    if (linkedTeamId) {
      const teamR = await pool.query(
        `SELECT name
         FROM "Team"
         WHERE id = $1
         LIMIT 1`,
        [linkedTeamId]
      );
      if (teamR.rows.length > 0 && String(teamR.rows[0].name || '').trim()) {
        finalDisplayName = String(teamR.rows[0].name).trim();
      }
    }
    if (competitorKind === 'participant' && req.user?.type === 'participant') {
      const participant = await getOwnedParticipantForUser(pool, req.user.sub);
      finalDisplayName = participant.displayName || finalDisplayName;
    }
    await assertNoTournamentDuplicateInscription(pool, {
      tournamentId,
      linkedTeamId,
      linkedParticipantUserId,
      displayName: finalDisplayName,
    });
    const created = await pool.query(
      `INSERT INTO "Inscription"(
        tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
        created_by_user_id, reviewed_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7::inscription_source_enum, $8, NULL, $9, $9)
      RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [
        tournamentId,
        competitionId,
        competitorKind,
        finalDisplayName,
        linkedTeamId,
        linkedParticipantUserId,
        sourceRaw,
        req.user?.sub || null,
        nowIso(),
      ]
    );
    return res.status(201).json({ inscription: created.rows[0] });
  } catch (e) {
    if (String(e?.message || '').includes('DUPLICATE_TEAM_IN_TOURNAMENT')) {
      return res.status(409).json({ error: 'equipo duplicado en torneo: solo se permite una inscripción activa por equipo' });
    }
    if (String(e?.message || '').includes('DUPLICATE_PARTICIPANT_IN_TOURNAMENT')) {
      return res.status(409).json({ error: 'participante duplicado en torneo: solo se permite una inscripción activa por participante' });
    }
    if (String(e?.message || '').includes('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH')) {
      return res.status(403).json({ error: 'FORBIDDEN: tipo de participante incompatible con el torneo' });
    }
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_team_active')) {
      return res.status(409).json({ error: 'equipo duplicado en torneo: solo se permite una inscripción activa por equipo' });
    }
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_participant_active')) {
      return res.status(409).json({ error: 'participante duplicado en torneo: solo se permite una inscripción activa por participante' });
    }
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    logger.error({ err: e }, 'create public inscription error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/invites', requireOrganizer, async (req, res) => {
  const competitionId = String(req.query?.competitionId || '').trim();
  const tournamentId = String(req.query?.tournamentId || '').trim();
  if (!competitionId && !tournamentId) return res.status(400).json({ error: 'competitionId o tournamentId requerido' });
  try {
    const listed = competitionId
      ? await pool.query(
          `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status, expires_at, max_uses, uses_count, created_at
                  , invite_response_status
           FROM "Invite"
           WHERE competition_id = $1
           ORDER BY created_at DESC`,
          [competitionId]
        )
      : await pool.query(
          `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status, expires_at, max_uses, uses_count, created_at
                  , invite_response_status
           FROM "Invite"
           WHERE tournament_id = $1
           ORDER BY created_at DESC`,
          [tournamentId]
        );
    return res.json({ invites: listed.rows });
  } catch (e) {
    logger.error({ err: e }, 'list invites error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/invites', requireOrganizer, async (req, res) => {
  const tournamentId = String(req.body?.tournamentId || '').trim();
  const competitionIdRaw = String(req.body?.competitionId || '').trim();
  const competitionId =
    competitionIdRaw && competitionIdRaw.toLowerCase() !== 'null' && competitionIdRaw.toLowerCase() !== 'undefined'
      ? competitionIdRaw
      : null;
  const type = String(req.body?.type || '').trim().toLowerCase();
  const targetInscriptionId = req.body?.targetInscriptionId ? Number(req.body.targetInscriptionId) : null;
  const targetTeamCode = req.body?.targetTeamCode ? String(req.body.targetTeamCode).trim().toUpperCase() : null;
  const targetParticipantUserId = req.body?.targetParticipantUserId
    ? Number(req.body.targetParticipantUserId)
    : null;
  const maxUsesRaw = req.body?.maxUses;
  const expiresAt = req.body?.expiresAt || null;
  const maxUses = maxUsesRaw === null || maxUsesRaw === undefined ? null : Number(maxUsesRaw);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId requerido' });
  if (!['public', 'targeted'].includes(type)) return res.status(400).json({ error: 'type invalido' });
  if (type === 'targeted' && !targetInscriptionId && !targetTeamCode && !targetParticipantUserId) {
    return res.status(400).json({ error: 'targetInscriptionId, targetTeamCode o targetParticipantUserId requerido para type=targeted' });
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return res.status(400).json({ error: 'maxUses debe ser entero positivo o null' });
  }
  try {
    if (type === 'targeted' && targetInscriptionId) {
      const target = await pool.query(
        `SELECT id, tournament_id, competition_id
         FROM "Inscription"
         WHERE id = $1
         LIMIT 1`,
        [targetInscriptionId]
      );
      if (target.rows.length === 0) return res.status(404).json({ error: 'inscription objetivo no existe' });
      if (String(target.rows[0].tournament_id) !== tournamentId) {
        return res.status(400).json({ error: 'inscription objetivo no pertenece al torneo' });
      }
      if (competitionId && String(target.rows[0].competition_id || '') !== competitionId) {
        return res.status(400).json({ error: 'inscription objetivo no pertenece a la competicion' });
      }
    }
    const created = await pool.query(
      `INSERT INTO "Invite"(
        token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status,
        expires_at, max_uses, uses_count, created_at, invite_response_status
      ) VALUES ($1, $2, $3, $4::invite_type_enum, $5, $6, $7, 'active', $8, $9, 0, $10, 'pending')
      RETURNING id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status, expires_at, max_uses, uses_count, created_at, invite_response_status`,
      [
        await generateUniqueInviteToken(type),
        tournamentId,
        competitionId,
        type,
        targetInscriptionId,
        targetTeamCode,
        targetParticipantUserId,
        expiresAt,
        maxUses,
        nowIso(),
      ]
    );
    return res.status(201).json({ invite: created.rows[0] });
  } catch (e) {
    logger.error({ err: e }, 'create invite error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/invites/code/claim', requireAuthMiddleware, async (req, res) => {
  const inviteCode = String(req.body?.code || '').trim().toUpperCase();
  if (!inviteCode) return res.status(400).json({ error: 'code requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, status, expires_at, max_uses, uses_count
       FROM "Invite"
       WHERE token = $1
       LIMIT 1
       FOR UPDATE`,
      [inviteCode]
    );
    if (inviteR.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'codigo de invitacion no existe' });
    }
    const invite = inviteR.rows[0];
    if (invite.type !== 'public') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'codigo no corresponde a invitacion publica' });
    }
    const { mode, participantType } = await resolveTournamentAccessConfig(String(invite.tournament_id));
    if (mode !== 'public') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: torneo privado, solo se admite inscripción por invitación dirigida' });
    }
    assertRoleMatchesParticipantType(req.user.type, participantType);
    try {
      ensureInviteUsable(invite);
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: e.message });
    }

    let created = null;
    if (req.user.type === 'team') {
      const ownedTeam = await getOwnedTeamForUser(client, req.user.sub);
      const duplicated = await client.query(
        `SELECT id
         FROM "Inscription"
         WHERE tournament_id = $1
           AND linked_team_id = $2
           AND status <> 'RECHAZADO'
         LIMIT 1
         FOR UPDATE`,
        [invite.tournament_id, ownedTeam.id]
      );
      if (duplicated.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'tu equipo ya tiene una inscripcion activa en esta competicion' });
      }

      const createdResult = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
          created_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, 'team', $3, $4, NULL, 'PENDIENTE', 'public', $5, NULL, $6, $6)
        RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                  created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, invite.competition_id, ownedTeam.name, ownedTeam.id, req.user.sub, nowIso()]
      );
      created = createdResult.rows[0];
    } else if (req.user.type === 'participant') {
      const participant = await getOwnedParticipantForUser(client, req.user.sub);
      const duplicated = await client.query(
        `SELECT id
         FROM "Inscription"
         WHERE tournament_id = $1
           AND linked_participant_user_id = $2
           AND status <> 'RECHAZADO'
         LIMIT 1
         FOR UPDATE`,
        [invite.tournament_id, req.user.sub]
      );
      if (duplicated.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'ya tenes una inscripción activa en este torneo como participante' });
      }
      const createdResult = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
          created_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, 'participant', $3, NULL, $4, 'PENDIENTE', 'public', $5, NULL, $6, $6)
        RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                  created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, invite.competition_id, participant.displayName, req.user.sub, req.user.sub, nowIso()]
      );
      created = createdResult.rows[0];
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: solo team o participant pueden usar este flujo' });
    }
    await client.query(
      `UPDATE "Invite"
       SET uses_count = uses_count + 1
       WHERE id = $1`,
      [invite.id]
    );
    await client.query('COMMIT');
    return res.status(201).json({ inscription: created });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_team_active')) {
      return res.status(409).json({ error: 'tu equipo ya tiene una inscripcion activa en esta competicion' });
    }
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_participant_active')) {
      return res.status(409).json({ error: 'ya tenes una inscripción activa en este torneo como participante' });
    }
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    if (String(e?.message || '').includes('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH')) {
      return res.status(403).json({ error: 'FORBIDDEN: tipo de participante incompatible con el torneo' });
    }
    logger.error({ err: e }, 'claim invite code error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/invites/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });
  try {
    const found = await pool.query(
      `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status, expires_at, max_uses, uses_count, created_at, invite_response_status
       FROM "Invite"
       WHERE token = $1
       LIMIT 1`,
      [token]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'invite no existe' });
    const invite = found.rows[0];
    let target = null;
    if (invite.target_inscription_id) {
      const targetR = await pool.query(
        `SELECT id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source
         FROM "Inscription"
         WHERE id = $1
         LIMIT 1`,
        [invite.target_inscription_id]
      );
      target = targetR.rows[0] || null;
    }
    return res.json({
      invite: {
        id: invite.id,
        token: invite.token,
        tournamentId: invite.tournament_id,
        competitionId: invite.competition_id,
        inviteType: invite.type,
        targetInscriptionId: invite.target_inscription_id,
        targetTeamCode: invite.target_team_code,
        targetParticipantUserId: invite.target_participant_user_id,
        status: invite.status,
        responseStatus: invite.invite_response_status,
        expiresAt: invite.expires_at,
        maxUses: invite.max_uses,
        usesCount: invite.uses_count,
        target,
      },
    });
  } catch (e) {
    logger.error({ err: e }, 'get invite error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/invites/:token/use', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const displayName = String(req.body?.displayName || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id, status, expires_at, max_uses, uses_count, created_at, invite_response_status
       FROM "Invite"
       WHERE token = $1
       LIMIT 1
       FOR UPDATE`,
      [token]
    );
    if (inviteR.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite no existe' });
    }
    const invite = inviteR.rows[0];
    try {
      ensureInviteUsable(invite);
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: e.message });
    }

    let inscription = null;
    if (invite.type === 'public') {
      const { mode, participantType } = await resolveTournamentAccessConfig(String(invite.tournament_id));
      if (mode !== 'public') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'FORBIDDEN: torneo privado, solo se admite inscripción por invitación dirigida' });
      }
      if (req.user?.type === 'team' || req.user?.type === 'participant') {
        assertRoleMatchesParticipantType(req.user.type, participantType);
      }
      if (!displayName) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'displayName requerido para invitacion publica' });
      }
      const created = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
          created_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, 'team', $3, NULL, NULL, 'PENDIENTE', 'invitation', $4, NULL, $5, $5)
        RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                  created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, invite.competition_id, displayName, req.user?.sub || null, nowIso()]
      );
      inscription = created.rows[0];
    } else {
      if (!invite.target_inscription_id && !invite.target_team_code && !invite.target_participant_user_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'invite targeted sin target' });
      }
      if (!invite.target_inscription_id && invite.target_team_code) {
        if (!req.user || req.user.type !== 'team') {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'FORBIDDEN: invite por codigo requiere usuario team' });
        }
        const teamR = await client.query(
          `SELECT id, name FROM "Team" WHERE owner_user_id = $1 LIMIT 1`,
          [req.user.sub]
        );
        if (teamR.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'FORBIDDEN: no tenes equipo asociado a la cuenta' });
        }
        const team = teamR.rows[0];
        const teamCodeR = await client.query(
          `SELECT invite_code FROM "Team" WHERE id = $1 LIMIT 1`,
          [team.id]
        );
        const inviteCode = String(teamCodeR.rows[0]?.invite_code || '').toUpperCase();
        if (!inviteCode || inviteCode !== String(invite.target_team_code).toUpperCase()) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'FORBIDDEN: esta invitacion no pertenece a tu equipo' });
        }
        const existing = await client.query(
          `SELECT id, status
           FROM "Inscription"
           WHERE tournament_id = $1
             AND linked_team_id = $2
             AND status <> 'RECHAZADO'
           ORDER BY id DESC
           LIMIT 1
           FOR UPDATE`,
          [invite.tournament_id, team.id]
        );
        if (existing.rows.length > 0) {
          inscription = existing.rows[0];
        } else {
          const created = await client.query(
            `INSERT INTO "Inscription"(
              tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
              created_by_user_id, reviewed_by_user_id, created_at, updated_at
            ) VALUES ($1, $2, 'team', $3, $4, NULL, 'ACEPTADO', 'invitation', $5, $5, $6, $6)
            RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                      created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
            [invite.tournament_id, invite.competition_id, team.name, team.id, req.user.sub, nowIso()]
          );
          inscription = created.rows[0];
        }
      } else if (!invite.target_inscription_id && invite.target_participant_user_id) {
        if (!req.user || req.user.type !== 'participant') {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'FORBIDDEN: invite de participante requiere usuario participant' });
        }
        if (Number(invite.target_participant_user_id) !== Number(req.user.sub)) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'FORBIDDEN: esta invitacion no pertenece a tu usuario' });
        }
        const participant = await getOwnedParticipantForUser(client, req.user.sub);
        const existing = await client.query(
          `SELECT id, status
           FROM "Inscription"
           WHERE tournament_id = $1
             AND linked_participant_user_id = $2
             AND status <> 'RECHAZADO'
           ORDER BY id DESC
           LIMIT 1
           FOR UPDATE`,
          [invite.tournament_id, req.user.sub]
        );
        if (existing.rows.length > 0) {
          inscription = existing.rows[0];
        } else {
          const created = await client.query(
            `INSERT INTO "Inscription"(
              tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
              created_by_user_id, reviewed_by_user_id, created_at, updated_at
            ) VALUES ($1, $2, 'participant', $3, NULL, $4, 'ACEPTADO', 'invitation', $5, $5, $6, $6)
            RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                      created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
            [invite.tournament_id, invite.competition_id, participant.displayName, req.user.sub, req.user.sub, nowIso()]
          );
          inscription = created.rows[0];
        }
      } else {
      const target = await client.query(
        `SELECT id, tournament_id, competition_id, status
         FROM "Inscription"
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [invite.target_inscription_id]
      );
      if (target.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'inscription objetivo no existe' });
      }
      const targetInscription = target.rows[0];
      if (String(targetInscription.tournament_id) !== String(invite.tournament_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'inscription objetivo no pertenece al torneo del invite' });
      }
      if (String(targetInscription.competition_id || '') !== String(invite.competition_id || '')) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'inscription objetivo no pertenece a la competicion del invite' });
      }
      if (targetInscription.status !== 'PENDIENTE') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'solo se puede completar una inscription PENDIENTE' });
      }
      const updated = await client.query(
        `UPDATE "Inscription"
         SET display_name = COALESCE(NULLIF($2, ''), display_name),
            status = 'ACEPTADO',
            reviewed_by_user_id = COALESCE($4, reviewed_by_user_id),
             source = 'invitation',
             updated_at = $3
         WHERE id = $1
         RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                   created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.target_inscription_id, displayName, nowIso(), req.user?.sub || null]
      );
      inscription = updated.rows[0];
      }
    }

    if (invite.type === 'targeted') {
      await client.query(
        `UPDATE "Invite"
         SET uses_count = uses_count + 1,
             status = 'revoked',
             invite_response_status = 'accepted'
         WHERE id = $1`,
        [invite.id]
      );
    } else {
      await client.query(
        `UPDATE "Invite"
         SET uses_count = uses_count + 1
         WHERE id = $1`,
        [invite.id]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({
      inscription,
      invite: {
        id: invite.id,
        token: invite.token,
        tournament_id: invite.tournament_id,
        competition_id: invite.competition_id,
        type: invite.type,
        target_team_code: invite.target_team_code || null,
        target_participant_user_id: invite.target_participant_user_id || null,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK');
      if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_team_active')) {
        return res.status(409).json({ error: 'equipo duplicado en torneo: solo se permite una inscripción activa por equipo' });
      }
      if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_participant_active')) {
        return res.status(409).json({ error: 'participante duplicado en torneo: solo se permite una inscripción activa por participante' });
      }
    if (String(e?.message || '').includes('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH')) {
      return res.status(403).json({ error: 'FORBIDDEN: tipo de participante incompatible con el torneo' });
    }
    logger.error({ err: e }, 'use invite error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.patch('/inscriptions/:id/status', requireOrganizer, async (req, res) => {
  const inscriptionId = Number(req.params.id);
  const newStatus = String(req.body?.status || '').trim().toUpperCase();
  if (!inscriptionId) return res.status(400).json({ error: 'inscriptionId invalido' });
  if (!['ACEPTADO', 'RECHAZADO'].includes(newStatus)) {
    return res.status(400).json({ error: 'status invalido. Usar ACEPTADO o RECHAZADO' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT id, tournament_id, competition_id, status
       FROM "Inscription"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [inscriptionId]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'inscription no existe' });
    }
    const current = found.rows[0];
    if (current.status !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `transicion invalida: ${current.status} -> ${newStatus}. Solo se permite PENDIENTE -> ACEPTADO/RECHAZADO`,
      });
    }

    if (newStatus === 'ACEPTADO') {
      const competitionIdRaw = String(current.competition_id || '').trim();
      const competitionId =
        competitionIdRaw && competitionIdRaw.toLowerCase() !== 'null' && competitionIdRaw.toLowerCase() !== 'undefined'
          ? competitionIdRaw
          : '';
      // En gestión general puede haber inscripciones sin competencia asignada.
      // En ese caso se permite aprobar y el cupo se validará al moverla a competencia.
      if (competitionId) {
        // Bloqueo transaccional por competencia para evitar sobrepasar cupo con concurrencia.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [competitionId]);
        const maxSlots = await resolveCompetitionMaxSlots(competitionId);
        const acceptedR = await client.query(
          `SELECT COUNT(*)::INT AS count_accepted
           FROM "Inscription"
           WHERE competition_id = $1
             AND status = 'ACEPTADO'`,
          [competitionId]
        );
        const acceptedCount = Number(acceptedR.rows[0].count_accepted || 0);
        if (acceptedCount >= maxSlots) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `CUPO_LLENO: ${acceptedCount}/${maxSlots}` });
        }
      }
    }

    const updated = await client.query(
      `UPDATE "Inscription"
       SET status = $2::inscription_status_enum,
           reviewed_by_user_id = $3,
           updated_at = $4
       WHERE id = $1
       RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                 created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [inscriptionId, newStatus, req.user.sub, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({ inscription: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.message || '').includes('COMPETITION_MAX_SLOTS_UNAVAILABLE')) {
      return res.status(500).json({ error: 'COMPETITION_MAX_SLOTS_UNAVAILABLE' });
    }
    logger.error({ err: e }, 'update status error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.patch('/inscriptions/:id/competition', requireOrganizer, async (req, res) => {
  const inscriptionId = Number(req.params.id);
  const competitionId = String(req.body?.competitionId || '').trim();
  if (!inscriptionId) return res.status(400).json({ error: 'inscriptionId invalido' });
  if (!competitionId) return res.status(400).json({ error: 'competitionId requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT id, tournament_id, competition_id, linked_team_id, status
       FROM "Inscription"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [inscriptionId]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'inscription no existe' });
    }
    const current = found.rows[0];
    if (!['PENDIENTE', 'ACEPTADO'].includes(String(current.status || ''))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'solo se puede mover inscription en estado PENDIENTE o ACEPTADO' });
    }
    if (String(current.competition_id || '') === competitionId) {
      await client.query('ROLLBACK');
      return res.status(200).json({ inscription: current });
    }

    // Si se mueve de competencia, limpiar asignaciones de fase inicial en Neo4j.
    await clearTournamentInitialAssignments({
      tournamentId: String(current.tournament_id),
      inscriptionId: inscriptionId,
      authorization: req.headers.authorization || '',
    });

    let finalDisplayName = null;
    if (current.linked_team_id) {
      const teamR = await client.query(
        `SELECT name
         FROM "Team"
         WHERE id = $1
         LIMIT 1`,
        [current.linked_team_id]
      );
      const name = String(teamR.rows[0]?.name || '').trim();
      if (name) finalDisplayName = name;
    }

    const updated = await client.query(
      `UPDATE "Inscription"
       SET competition_id = $2,
           display_name = COALESCE($3, display_name),
           updated_at = $4
       WHERE id = $1
       RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                 created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [inscriptionId, competitionId, finalDisplayName, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({ inscription: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ err: e }, 'move inscription competition error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/inscriptions/:id/associate', requireTeamUser, async (req, res) => {
  const inscriptionId = Number(req.params.id);
  if (!inscriptionId) return res.status(400).json({ error: 'inscriptionId invalido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT id, tournament_id, competition_id, linked_team_id, status
       FROM "Inscription"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [inscriptionId]
    );
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'inscription no existe' });
    }
    const inscription = found.rows[0];
    const ownedTeam = await getOwnedTeamForUser(client, req.user.sub);
    await assertSingleTeamAssociationRule(
      client,
      String(inscription.tournament_id),
      req.user.sub,
      Number(ownedTeam.id),
      inscriptionId
    );

    if (inscription.linked_team_id && Number(inscription.linked_team_id) !== Number(ownedTeam.id)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'inscription ya asociada a otro equipo' });
    }

    const updated = await client.query(
      `UPDATE "Inscription"
       SET linked_team_id = $2,
           display_name = $3,
           updated_at = $4
       WHERE id = $1
       RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                 created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
      [inscriptionId, ownedTeam.id, ownedTeam.name, nowIso()]
    );
    await client.query('COMMIT');
    return res.json({ inscription: updated.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    logger.error({ err: e }, 'associate inscription error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/tournaments/:id/inscriptions', requireAuthMiddleware, async (req, res) => {
  const tournamentId = String(req.params.id || '').trim();
  const competitionId = String(req.query?.competitionId || '').trim();
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId requerido' });
  try {
    const listed = competitionId
      ? await pool.query(
          `SELECT i.id,
                  i.tournament_id,
                  i.competition_id,
                  i.competitor_kind,
                  COALESCE(t.name, i.display_name) AS display_name,
                  COALESCE(t.badge_url, t_by_name.badge_url) AS team_badge_url,
                  i.linked_team_id,
                  i.linked_participant_user_id,
                  i.status,
                  i.source,
                  i.created_by_user_id, i.reviewed_by_user_id, i.created_at, i.updated_at
           FROM "Inscription" i
           LEFT JOIN "Team" t ON t.id = i.linked_team_id
           LEFT JOIN LATERAL (
             SELECT tx.badge_url
             FROM "Team" tx
             WHERE regexp_replace(lower(trim(tx.name)), '[^a-z0-9]+', '', 'g')
                   = regexp_replace(lower(trim(i.display_name)), '[^a-z0-9]+', '', 'g')
             ORDER BY tx.id
             LIMIT 1
           ) t_by_name ON TRUE
           WHERE i.tournament_id = $1 AND i.competition_id = $2
           ORDER BY i.created_at DESC`,
          [tournamentId, competitionId]
        )
      : await pool.query(
          `SELECT i.id,
                  i.tournament_id,
                  i.competition_id,
                  i.competitor_kind,
                  COALESCE(t.name, i.display_name) AS display_name,
                  COALESCE(t.badge_url, t_by_name.badge_url) AS team_badge_url,
                  i.linked_team_id,
                  i.linked_participant_user_id,
                  i.status,
                  i.source,
                  i.created_by_user_id, i.reviewed_by_user_id, i.created_at, i.updated_at
           FROM "Inscription" i
           LEFT JOIN "Team" t ON t.id = i.linked_team_id
           LEFT JOIN LATERAL (
             SELECT tx.badge_url
             FROM "Team" tx
             WHERE regexp_replace(lower(trim(tx.name)), '[^a-z0-9]+', '', 'g')
                   = regexp_replace(lower(trim(i.display_name)), '[^a-z0-9]+', '', 'g')
             ORDER BY tx.id
             LIMIT 1
           ) t_by_name ON TRUE
           WHERE i.tournament_id = $1
           ORDER BY i.created_at DESC`,
          [tournamentId]
        );
    return res.json({
      tournamentId,
      competitionId: competitionId || null,
      inscriptions: listed.rows,
    });
  } catch (e) {
    logger.error({ err: e }, 'list tournament inscriptions error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/competitions/:id/inscriptions', requireAuthMiddleware, async (req, res) => {
  const competitionId = String(req.params.id || '').trim();
  if (!competitionId) return res.status(400).json({ error: 'competitionId requerido' });
  try {
    const listed = await pool.query(
      `SELECT i.id,
              i.tournament_id,
              i.competition_id,
              i.competitor_kind,
              COALESCE(t.name, i.display_name) AS display_name,
              COALESCE(t.badge_url, t_by_name.badge_url) AS team_badge_url,
              i.linked_team_id,
              i.linked_participant_user_id,
              i.status,
              i.source,
              i.created_by_user_id, i.reviewed_by_user_id, i.created_at, i.updated_at
       FROM "Inscription" i
       LEFT JOIN "Team" t ON t.id = i.linked_team_id
       LEFT JOIN LATERAL (
         SELECT tx.badge_url
         FROM "Team" tx
         WHERE regexp_replace(lower(trim(tx.name)), '[^a-z0-9]+', '', 'g')
               = regexp_replace(lower(trim(i.display_name)), '[^a-z0-9]+', '', 'g')
         ORDER BY tx.id
         LIMIT 1
       ) t_by_name ON TRUE
       WHERE i.competition_id = $1
       ORDER BY i.created_at DESC`,
      [competitionId]
    );
    return res.json({
      competitionId,
      inscriptions: listed.rows,
    });
  } catch (e) {
    logger.error({ err: e }, 'list competition inscriptions error');
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/teams/me/invites', requireTeamUser, async (req, res) => {
  const client = await pool.connect();
  try {
    const teamR = await client.query(
      `SELECT id, name, invite_code
       FROM "Team"
       WHERE owner_user_id = $1
       LIMIT 1`,
      [req.user.sub]
    );
    if (teamR.rows.length === 0) return res.json({ invites: [] });
    const team = teamR.rows[0];
    if (!team.invite_code) return res.json({ invites: [] });

    const invitesR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id,
              status, expires_at, max_uses, uses_count, created_at, invite_response_status
       FROM "Invite"
       WHERE type = 'targeted'
         AND UPPER(COALESCE(target_team_code, '')) = UPPER($1)
       ORDER BY created_at DESC`,
      [String(team.invite_code)]
    );
    return res.json({
      team: { id: team.id, name: team.name, inviteCode: team.invite_code },
      invites: invitesR.rows,
    });
  } catch (e) {
    logger.error({ err: e }, 'list team invites error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/teams/me/invites/:id/accept', requireTeamUser, async (req, res) => {
  const inviteId = Number(req.params.id);
  if (!inviteId) return res.status(400).json({ error: 'inviteId invalido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const teamR = await client.query(
      `SELECT id, name, invite_code
       FROM "Team"
       WHERE owner_user_id = $1
       LIMIT 1`,
      [req.user.sub]
    );
    if (teamR.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: no tenes equipo para aceptar invitaciones' });
    }
    const team = teamR.rows[0];
    const inviteR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, target_team_code, target_participant_user_id, status, invite_response_status
       FROM "Invite"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [inviteId]
    );
    if (inviteR.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite no existe' });
    }
    const invite = inviteR.rows[0];
    if (invite.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'invite no activa' });
    }
    if (String(invite.type) !== 'targeted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite no corresponde a flujo por codigo' });
    }
    if (String(invite.target_team_code || '').toUpperCase() !== String(team.invite_code || '').toUpperCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: invitacion no pertenece a tu equipo' });
    }
    const existing = await client.query(
      `SELECT id
       FROM "Inscription"
       WHERE tournament_id = $1
         AND linked_team_id = $2
         AND status <> 'RECHAZADO'
       LIMIT 1
       FOR UPDATE`,
      [invite.tournament_id, team.id]
    );
    let inscription = null;
    if (existing.rows.length === 0) {
      const created = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
          created_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, 'team', $3, $4, NULL, 'ACEPTADO', 'invitation', $5, $5, $6, $6)
        RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                  created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, invite.competition_id, team.name, team.id, req.user.sub, nowIso()]
      );
      inscription = created.rows[0];
    } else {
      const updatedExisting = await client.query(
        `UPDATE "Inscription"
         SET status = 'ACEPTADO',
             reviewed_by_user_id = $2,
             updated_at = $3
         WHERE id = $1
         RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                   created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [existing.rows[0].id, req.user.sub, nowIso()]
      );
      inscription = updatedExisting.rows[0];
    }
    await client.query(
      `UPDATE "Invite"
       SET status = 'revoked',
           uses_count = uses_count + 1,
           invite_response_status = 'accepted'
       WHERE id = $1`,
      [invite.id]
    );
    await client.query('COMMIT');
    return res.json({ inscription });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_team_active')) {
      return res.status(409).json({ error: 'equipo duplicado en torneo: solo se permite una inscripción activa por equipo' });
    }
    logger.error({ err: e }, 'accept team invite error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/teams/me/invites/:id/reject', requireTeamUser, async (req, res) => {
  const inviteId = Number(req.params.id);
  if (!inviteId) return res.status(400).json({ error: 'inviteId invalido' });
  const client = await pool.connect();
  try {
    const teamR = await client.query(
      `SELECT invite_code
       FROM "Team"
       WHERE owner_user_id = $1
       LIMIT 1`,
      [req.user.sub]
    );
    if (teamR.rows.length === 0) return res.status(403).json({ error: 'FORBIDDEN: sin equipo owner' });
    const inviteCode = String(teamR.rows[0].invite_code || '').toUpperCase();
    const updated = await client.query(
      `UPDATE "Invite"
       SET status = 'revoked',
           invite_response_status = 'rejected'
       WHERE id = $1
         AND status = 'active'
         AND UPPER(COALESCE(target_team_code, '')) = $2
       RETURNING id`,
      [inviteId, inviteCode]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'invite no encontrada para tu equipo' });
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'reject team invite error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.get('/participants/me/invites', requireParticipantUser, async (req, res) => {
  const client = await pool.connect();
  try {
    const invitesR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id,
              status, expires_at, max_uses, uses_count, created_at, invite_response_status
       FROM "Invite"
       WHERE type = 'targeted'
         AND target_participant_user_id = $1
       ORDER BY created_at DESC`,
      [req.user.sub]
    );
    return res.json({ invites: invitesR.rows });
  } catch (e) {
    logger.error({ err: e }, 'list participant invites error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/participants/me/invites/:id/accept', requireParticipantUser, async (req, res) => {
  const inviteId = Number(req.params.id);
  if (!inviteId) return res.status(400).json({ error: 'inviteId invalido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const participant = await getOwnedParticipantForUser(client, req.user.sub);
    const inviteR = await client.query(
      `SELECT id, token, tournament_id, competition_id, type, target_participant_user_id, status, invite_response_status
       FROM "Invite"
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [inviteId]
    );
    if (inviteR.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'invite no existe' });
    }
    const invite = inviteR.rows[0];
    if (invite.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'invite no activa' });
    }
    if (String(invite.type) !== 'targeted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invite no corresponde a flujo por usuario participant' });
    }
    if (Number(invite.target_participant_user_id || 0) !== Number(req.user.sub)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'FORBIDDEN: invitacion no pertenece a tu usuario' });
    }
    const existing = await client.query(
      `SELECT id
       FROM "Inscription"
       WHERE tournament_id = $1
         AND linked_participant_user_id = $2
         AND status <> 'RECHAZADO'
       LIMIT 1
       FOR UPDATE`,
      [invite.tournament_id, req.user.sub]
    );
    let inscription = null;
    if (existing.rows.length === 0) {
      const created = await client.query(
        `INSERT INTO "Inscription"(
          tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
          created_by_user_id, reviewed_by_user_id, created_at, updated_at
        ) VALUES ($1, $2, 'participant', $3, NULL, $4, 'ACEPTADO', 'invitation', $5, $5, $6, $6)
        RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                  created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [invite.tournament_id, invite.competition_id, participant.displayName, req.user.sub, req.user.sub, nowIso()]
      );
      inscription = created.rows[0];
    } else {
      const updatedExisting = await client.query(
        `UPDATE "Inscription"
         SET status = 'ACEPTADO',
             reviewed_by_user_id = $2,
             updated_at = $3
         WHERE id = $1
         RETURNING id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id, status, source,
                   created_by_user_id, reviewed_by_user_id, created_at, updated_at`,
        [existing.rows[0].id, req.user.sub, nowIso()]
      );
      inscription = updatedExisting.rows[0];
    }
    await client.query(
      `UPDATE "Invite"
       SET status = 'revoked',
           uses_count = uses_count + 1,
           invite_response_status = 'accepted'
       WHERE id = $1`,
      [invite.id]
    );
    await client.query('COMMIT');
    return res.json({ inscription });
  } catch (e) {
    await client.query('ROLLBACK');
    if (String(e?.code || '') === '23505' && String(e?.constraint || '').includes('uniq_inscription_tournament_linked_participant_active')) {
      return res.status(409).json({ error: 'participante duplicado en torneo: solo se permite una inscripción activa por participante' });
    }
    if (String(e?.message || '').startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: e.message });
    }
    logger.error({ err: e }, 'accept participant invite error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.post('/participants/me/invites/:id/reject', requireParticipantUser, async (req, res) => {
  const inviteId = Number(req.params.id);
  if (!inviteId) return res.status(400).json({ error: 'inviteId invalido' });
  const client = await pool.connect();
  try {
    const updated = await client.query(
      `UPDATE "Invite"
       SET status = 'revoked',
           invite_response_status = 'rejected'
       WHERE id = $1
         AND status = 'active'
         AND target_participant_user_id = $2
       RETURNING id`,
      [inviteId, req.user.sub]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'invite no encontrada para tu usuario' });
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'reject participant invite error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Match Events endpoints (goles, tarjetas, suspensiones, sanciones)
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES = ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction'];

// POST /matches/:matchId/events — crear evento (solo organizador)
app.post('/matches/:matchId/events', requireOrganizer, async (req, res) => {
  const { matchId } = req.params;
  const { event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches, notes, extra_json, tournament_id } = req.body;

  if (!matchId) return res.status(400).json({ error: 'matchId requerido' });
  if (!VALID_EVENT_TYPES.includes(event_type)) {
    return res.status(400).json({ error: `event_type invalido. Valores aceptados: ${VALID_EVENT_TYPES.join(', ')}` });
  }
  if (!tournament_id) return res.status(400).json({ error: 'tournament_id requerido' });
  if (!display_name && !linked_member_id) {
    return res.status(400).json({ error: 'display_name es requerido cuando no hay linked_member_id' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "MatchEvent"(match_id, tournament_id, event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches, notes, extra_json, created_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        matchId,
        String(tournament_id),
        event_type,
        inscription_id ?? null,
        linked_member_id ?? null,
        display_name ?? '',
        minute != null ? Number(minute) : null,
        suspension_matches != null ? Number(suspension_matches) : null,
        notes ?? null,
        extra_json ? JSON.stringify(extra_json) : null,
        req.user?.sub ?? null,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (e) {
    logger.error({ err: e }, 'create match event error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// GET /matches/:matchId/events — listar eventos (organizador ve todos; team user solo si su inscripción participa)
app.get('/matches/:matchId/events', requireAuthMiddleware, async (req, res) => {
  const { matchId } = req.params;
  if (!matchId) return res.status(400).json({ error: 'matchId requerido' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "MatchEvent"
       WHERE match_id = $1
       ORDER BY COALESCE(minute, 999999) ASC, created_at ASC`,
      [matchId]
    );
    return res.json(result.rows);
  } catch (e) {
    logger.error({ err: e }, 'list match events error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// PATCH /matches/:matchId/events/:eventId — actualizar evento (solo organizador)
app.patch('/matches/:matchId/events/:eventId', requireOrganizer, async (req, res) => {
  const { matchId, eventId } = req.params;
  if (!matchId || !eventId) return res.status(400).json({ error: 'matchId y eventId requeridos' });

  const { event_type, inscription_id, linked_member_id, display_name, minute, suspension_matches, notes, extra_json } = req.body;

  if (event_type !== undefined && !VALID_EVENT_TYPES.includes(event_type)) {
    return res.status(400).json({ error: `event_type invalido. Valores aceptados: ${VALID_EVENT_TYPES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM "MatchEvent" WHERE id = $1 AND match_id = $2 LIMIT 1`,
      [Number(eventId), matchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'evento no encontrado' });

    const result = await client.query(
      `UPDATE "MatchEvent"
       SET event_type        = COALESCE($1, event_type),
           inscription_id    = COALESCE($2, inscription_id),
           linked_member_id  = COALESCE($3, linked_member_id),
           display_name      = COALESCE($4, display_name),
           minute            = COALESCE($5, minute),
           suspension_matches = COALESCE($6, suspension_matches),
           notes             = COALESCE($7, notes),
           extra_json        = COALESCE($8, extra_json),
           updated_at        = NOW()
       WHERE id = $9 AND match_id = $10
       RETURNING *`,
      [
        event_type ?? null,
        inscription_id ?? null,
        linked_member_id ?? null,
        display_name ?? null,
        minute != null ? Number(minute) : null,
        suspension_matches != null ? Number(suspension_matches) : null,
        notes ?? null,
        extra_json ? JSON.stringify(extra_json) : null,
        Number(eventId),
        matchId,
      ]
    );
    return res.json(result.rows[0]);
  } catch (e) {
    logger.error({ err: e }, 'update match event error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

// DELETE /matches/:matchId/events/:eventId — eliminar evento (solo organizador)
app.delete('/matches/:matchId/events/:eventId', requireOrganizer, async (req, res) => {
  const { matchId, eventId } = req.params;
  if (!matchId || !eventId) return res.status(400).json({ error: 'matchId y eventId requeridos' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "MatchEvent" WHERE id = $1 AND match_id = $2 RETURNING id`,
      [Number(eventId), matchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'evento no encontrado' });
    return res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, 'delete match event error');
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export {
  app,
  normalizeTournamentParticipantType,
  assertRoleMatchesParticipantType,
  ensureInviteUsable,
  generatePublicInviteCode,
  generateTargetedInviteToken,
};


