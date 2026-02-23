import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

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
        }
      });
    }
  });
  const server = new ApolloServer({ gateway });
  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({
      authorization: req.headers.authorization || ''
    })
  }));

  app.listen(PORT, () => {
    console.log(`[gateway] running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[gateway] fatal error:', err);
  process.exit(1);
});


