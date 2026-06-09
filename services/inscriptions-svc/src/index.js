import { env } from './config/env.js';
import { createApp } from './app.js';
import { closePool } from './config/db.js';
import { logger } from './logger.js';

const app = createApp();

let server = null;
if (env.nodeEnv !== 'test') {
  server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'inscriptions-svc running');
  });
}

export default server;
export { app, closePool };
