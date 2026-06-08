import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { httpLogger } from './logger.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: env.corsOrigins.length === 0 ? '*' : env.corsOrigins,
  }));
  app.use(bodyParser.json());
  app.use(httpLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/users', authRoutes);
  app.use(errorHandler);

  return app;
}
