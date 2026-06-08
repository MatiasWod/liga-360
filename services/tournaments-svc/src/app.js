import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { env } from './config/env.js';
import { httpLogger } from './logger.js';
import { buildSchema } from './graphql/schema.js';

/**
 * Crea la app Express con el subgrafo GraphQL montado en /graphql y un health check.
 * El driver Neo4j se inyecta en el contexto de cada request GraphQL.
 * Devuelve { app, apolloServer } para permitir un shutdown ordenado.
 */
export async function createApp(driver) {
  const app = express();

  app.use(cors({ origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins }));
  app.use(bodyParser.json());
  app.use(httpLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const apolloServer = new ApolloServer({ schema: buildSchema() });
  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }) => ({
      driver,
      headers: {
        authorization: req.headers.authorization || '',
      },
    }),
  }));

  return { app, apolloServer };
}
