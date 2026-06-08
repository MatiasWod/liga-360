import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { env } from './config/env.js';
import { httpLogger } from './logger.js';
import { optionalAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.middleware.js';
import teamRoutes from './routes/team.routes.js';
import participantRoutes from './routes/participant.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins }));
  app.use(bodyParser.json());
  app.use(httpLogger);
  app.use(optionalAuthMiddleware);

  // Alias nginx legacy: /teams/participants[...] → /participants[...]
  app.use((req, _res, next) => {
    const url = req.url || '';
    if (url.startsWith('/teams/participants')) {
      req.url = url.replace(/^\/teams\/participants/, '/participants');
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/teams', teamRoutes);
  app.use('/participants', participantRoutes);

  app.use(errorHandler);

  return app;
}
