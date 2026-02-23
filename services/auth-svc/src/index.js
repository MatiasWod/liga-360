import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';
const { Pool } = pkg;
const pool = new Pool({ connectionString: POSTGRES_URL });

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Users" (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      type TEXT NOT NULL,
      type_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Team" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Participant" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Organizer" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Participant_Team" (
      id_team INTEGER NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
      id_participant INTEGER NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
      PRIMARY KEY (id_team, id_participant)
    );
  `);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Registro con 3 modos: team | participant | organizer
// body: { mode: 'team'|'participant'|'organizer', username, password, name }
app.post('/register', async (req, res) => {
  try {
    const { mode, username, password, name } = req.body || {};
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
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
      return res.status(201).json({ user: u.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') return res.status(409).json({ error: 'username already exists' });
      console.error('[auth-svc] register error', e);
      return res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  } catch (e) {
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

app.listen(PORT, async () => {
  await ensureSchema().catch((e) => console.error('[auth-svc] schema init error', e));
  console.log(`[auth-svc] running on http://0.0.0.0:${PORT}`);
});



