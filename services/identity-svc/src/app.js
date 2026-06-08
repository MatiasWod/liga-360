import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { env } from './config/env.js';
import { httpLogger } from './logger.js';
import { optionalAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.middleware.js';
import profileRoutes from './routes/profile.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins }));
  app.use(bodyParser.json());
  app.use(httpLogger);
  app.use(optionalAuthMiddleware);

  // Alias nginx legacy: /teams/profiles[...] → /profiles[...]
  app.use((req, _res, next) => {
    const url = req.url || '';
    if (url.startsWith('/teams/profiles')) {
      req.url = url.replace(/^\/teams\/profiles/, '/profiles');
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/profiles', profileRoutes);

  app.use(errorHandler);

  return app;
}
