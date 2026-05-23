import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import { httpLogger, logger } from './logger.js';

const PORT = process.env.PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';
const { Pool } = pkg;
const pool = new Pool({
  connectionString: POSTGRES_URL,
  allowExitOnIdle: process.env.NODE_ENV === 'test',
});
const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/f540be8d-4922-4ed3-93a4-5ecb0b6235b8';

function sendDebugLog(payload) {
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: Date.now() })
  }).catch(() => {});
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(httpLogger);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Registro con 3 modos: team | participant | organizer
// body: { mode: 'team'|'participant'|'organizer', username, password, name }
app.post('/register', async (req, res) => {
  try {
    const { mode, username, password, name } = req.body || {};
    // #region agent log
    sendDebugLog({
      runId: 'initial',
      hypothesisId: 'H3',
      location: 'services/auth-svc/src/index.js:register-entry',
      message: 'Register request received',
      data: {
        mode,
        username,
        hasPassword: Boolean(password),
        nameLength: typeof name === 'string' ? name.length : 0
      }
    });
    // #endregion
    const normalized = (mode || '').toString().toLowerCase();
    // Aceptamos alias en español
    const modeMap = {
      team: 'team', equipo: 'team',
      participant: 'participant', participante: 'participant',
      organizer: 'organizer', organizador: 'organizer'
    };
    const kind = modeMap[normalized];
    if (!kind) return res.status(400).json({ error: 'mode must be team|participant|organizer (or equipo/participante/organizador)' });
    if (!username || !password || !name) return res.status(400).json({ error: 'username, password, name required' });

    const hashed = await bcrypt.hash(password, 10);
    // #region agent log
    sendDebugLog({
      runId: 'initial',
      hypothesisId: 'H2',
      location: 'services/auth-svc/src/index.js:before-pool-connect',
      message: 'Attempting postgres connection',
      data: { hasPostgresUrl: Boolean(POSTGRES_URL) }
    });
    // #endregion
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // #region agent log
      sendDebugLog({
        runId: 'initial',
        hypothesisId: 'H5',
        location: 'services/auth-svc/src/index.js:transaction-begin',
        message: 'Register transaction started',
        data: { kind, username }
      });
      // #endregion
      let refId;
      if (kind === 'team') {
        const r = await client.query('INSERT INTO "Team"(name) VALUES ($1) RETURNING id', [name]);
        refId = r.rows[0].id;
      } else if (kind === 'participant') {
        const r = await client.query('INSERT INTO "Participant"(name) VALUES ($1) RETURNING id', [name]);
        refId = r.rows[0].id;
      } else {
        const r = await client.query('INSERT INTO "Organizer"(name) VALUES ($1) RETURNING id', [name]);
        refId = r.rows[0].id;
      }
      const u = await client.query(
        'INSERT INTO "Users"(username,password,type,type_id) VALUES ($1,$2,$3,$4) RETURNING id, username, type, type_id',
        [username, hashed, kind, refId]
      );
      await client.query('COMMIT');
      // #region agent log
      sendDebugLog({
        runId: 'initial',
        hypothesisId: 'H5',
        location: 'services/auth-svc/src/index.js:transaction-commit',
        message: 'Register transaction committed',
        data: { kind, username, refId }
      });
      // #endregion
      return res.status(201).json({ user: u.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      // #region agent log
      sendDebugLog({
        runId: 'initial',
        hypothesisId: 'H4',
        location: 'services/auth-svc/src/index.js:transaction-error',
        message: 'Register transaction failed',
        data: {
          code: e?.code || null,
          message: e?.message || null,
          detail: e?.detail || null,
          table: e?.table || null,
          constraint: e?.constraint || null
        }
      });
      // #endregion
      if (e.code === '23505') return res.status(409).json({ error: 'username already exists' });
      logger.error({ err: e }, 'register error');
      return res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  } catch (e) {
    // #region agent log
    sendDebugLog({
      runId: 'initial',
      hypothesisId: 'H2',
      location: 'services/auth-svc/src/index.js:register-outer-error',
      message: 'Register outer try/catch failed',
      data: {
        code: e?.code || null,
        message: e?.message || null
      }
    });
    // #endregion
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Login que emite JWT (sin verificación real de password en MVP mínimo)
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const r = await pool.query('SELECT * FROM "Users" WHERE username=$1', [username]);
  if (r.rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });
  const user = r.rows[0];
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, username: user.username, type: user.type, type_id: user.type_id }, JWT_SECRET, { expiresIn: '1d' });
  return res.json({ token, user: { id: user.id, username: user.username, type: user.type, type_id: user.type_id } });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'running');
  });
}
