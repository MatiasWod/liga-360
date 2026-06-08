import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const app = createApp();

app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, 'auth-svc running');
});
