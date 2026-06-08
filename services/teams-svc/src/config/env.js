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
}

export const env = {
  port: parseInt(process.env.PORT || '4002', 10),
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  postgresUrl: process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360',
  identitySvcUrl: process.env.IDENTITY_SVC_URL || 'http://identity-svc:4005',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['*'],
  logLevel: process.env.LOG_LEVEL || 'info',
};
