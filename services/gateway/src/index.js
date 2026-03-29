import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { httpLogger, logger } from './logger.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use(httpLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const supergraphSdl = new IntrospectAndCompose({
    subgraphs: [
      { name: 'tournaments', url: process.env.TOURNAMENTS_SUBGRAPH_URL || 'http://tournaments-svc:4001/graphql' }
    ]
  });

  const gateway = new ApolloGateway({
    supergraphSdl,
    buildService({ url }) {
      return new RemoteGraphQLDataSource({
        url,
        willSendRequest({ request, context }) {
          if (context?.authorization) {
            request.http.headers.set('authorization', context.authorization);
          }
          if (context?.requestId) {
            request.http.headers.set('x-request-id', context.requestId);
          }
        }
      });
    }
  });
  const server = new ApolloServer({ gateway });
  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({
      authorization: req.headers.authorization || '',
      requestId: req.id || req.headers['x-request-id'] || '',
    })
  }));

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'running');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'fatal error');
  process.exit(1);
});


