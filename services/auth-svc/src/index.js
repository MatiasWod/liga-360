import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';
import { bootstrapAdmin } from './services/auth.service.js';
import { closePool } from './repositories/user.repository.js';
import client from 'prom-client';
import promBundle from 'express-prom-bundle';
const app = createApp();

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  autoregister: true,
  customLabels: { project_name: 'liga360' },
  promClient: {
    collectDefaultMetrics: {}
  }
});

app.use(metricsMiddleware);

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (ex) {
    logger.error({ err: ex }, 'error generating metrics');
    res.status(500).end();
  }
});

// No fatal si falla (p. ej. carrera entre réplicas por el índice único de username):
// el servicio sigue levantando y el admin se crea en el próximo boot.
try {
  await bootstrapAdmin();
} catch (err) {
  logger.error({ err }, 'admin bootstrap failed');
}

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, 'auth-svc running');
});

export default server;
export { app, closePool };

