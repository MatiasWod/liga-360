#!/usr/bin/env node
/**
 * Reprocesa partidos finished de torneos published en orden cronológico (idempotente vía elo_match_event).
 * Uso: JWT_SECRET=devsecret TEAMS_SVC_URL=http://localhost:4002 node scripts/elo-backfill.mjs
 */
import { createRequire } from 'module';
const requireTeams = createRequire(new URL('../services/teams-svc/package.json', import.meta.url));
const jwt = requireTeams('jsonwebtoken');
const requireTournaments = createRequire(new URL('../services/tournaments-svc/package.json', import.meta.url));
const neo4j = requireTournaments('neo4j-driver');

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const TEAMS_URL = (process.env.TEAMS_SVC_URL || 'http://localhost:4002').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function serviceHeaders() {
  const token = jwt.sign({ type: 'service', iss: 'elo-backfill' }, JWT_SECRET, { expiresIn: '2h' });
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function processMatch({ matchId, ...payload }) {
  const res = await fetch(`${TEAMS_URL}/matches/${encodeURIComponent(String(matchId))}/elo`, {
    method: 'PUT',
    headers: serviceHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`process-match ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (t:Tournament {status:'published'})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(:Stage)-[:HAS_MATCH]->(m:Match)
       WHERE toLower(coalesce(m.status, m.matchStatus, '')) IN ['finished', 'completed']
         AND m.homeInscriptionId IS NOT NULL AND m.awayInscriptionId IS NOT NULL
         AND m.homeScore IS NOT NULL AND m.awayScore IS NOT NULL
       RETURN m.id AS matchId, t.id AS tournamentId, t.status AS status,
              m.homeInscriptionId AS homeInscriptionId, m.awayInscriptionId AS awayInscriptionId,
              m.homeScore AS homeScore, m.awayScore AS awayScore, coalesce(m.updatedAt, m.createdAt) AS sortAt
       ORDER BY sortAt ASC, matchId ASC`
    );
    let ok = 0;
    let skip = 0;
    for (const record of result.records) {
      const payload = {
        matchId: String(record.get('matchId')),
        tournamentId: String(record.get('tournamentId')),
        tournamentStatus: String(record.get('status') || 'published'),
        homeInscriptionId: String(record.get('homeInscriptionId')),
        awayInscriptionId: String(record.get('awayInscriptionId')),
        homeScore: Number(record.get('homeScore')),
        awayScore: Number(record.get('awayScore')),
      };
      try {
        const json = await processMatch(payload);
        if (json?.skipped) skip += 1;
        else ok += 1;
      } catch (err) {
        console.error('fallo', payload.matchId, err.message);
      }
    }
    console.log(`elo-backfill: procesados=${ok} omitidos=${skip} total=${result.records.length}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
