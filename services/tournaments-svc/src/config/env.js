import 'dotenv/config';

function assertRequired(name) {
  if (!process.env[name]) {
    console.error(`FATAL: missing required env var: ${name}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production') {
  assertRequired('NEO4J_URI');
  assertRequired('NEO4J_PASSWORD');
}

export const env = {
  port: parseInt(process.env.PORT || '4001', 10),
  neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4jUsername: process.env.NEO4J_USERNAME || 'neo4j',
  neo4jPassword: process.env.NEO4J_PASSWORD || 'password',
  // tournaments-svc only verifies tokens; JWT_SECRET is not provided in every
  // deployment (docker-compose omits it), so it falls back to the shared dev default.
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['*'],
  logLevel: process.env.LOG_LEVEL || 'info',
  inscriptionsSvcUrl: process.env.INSCRIPTIONS_SVC_URL || 'http://localhost:4004',
  matcheventsSvcUrl: process.env.MATCHEVENTS_SVC_URL || 'http://localhost:4006',
  teamsSvcUrl: process.env.TEAMS_SVC_URL || 'http://localhost:4002',
};
