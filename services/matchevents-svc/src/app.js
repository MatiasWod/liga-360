import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { env } from './config/env.js';
import { httpLogger } from './logger.js';
import { optionalAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.middleware.js';
import { createRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins }));
  app.use(bodyParser.json());
  app.use(httpLogger);
  app.use(optionalAuthMiddleware);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(createRouter());

  app.use(errorHandler);

  return app;
}
