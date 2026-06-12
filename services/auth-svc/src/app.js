import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
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
  // Rutas en root (POST /register, /login): nginx reescribe /api/auth/* → /* y el frontend
  // llama /api/auth/login. Montar en /users rompía el ruteo detrás de nginx.
  app.use(authRoutes);
  app.use(userRoutes);
  app.use(errorHandler);

  return app;
}
