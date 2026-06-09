import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';
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

app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, 'auth-svc running');
});

