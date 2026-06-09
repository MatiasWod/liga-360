import 'dotenv/config';

function assertRequired(name) {
  if (!process.env[name]) {
    console.error(`FATAL: missing required env var: ${name}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production') {
  assertRequired('JWT_SECRET');
  assertRequired('POSTGRES_URL');
  assertRequired('TOURNAMENTS_GRAPHQL_URL');
}

export const env = {
  port: parseInt(process.env.PORT || '4004', 10),
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  postgresUrl: process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360_inscriptions',
  tournamentsGraphqlUrl: process.env.TOURNAMENTS_GRAPHQL_URL || 'http://localhost:4000/graphql',
  teamsSvcUrl: process.env.TEAMS_SVC_URL || 'http://teams-svc:4002',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['*'],
  logLevel: process.env.LOG_LEVEL || 'info',
};
