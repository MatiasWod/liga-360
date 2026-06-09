import { env } from './config/env.js';
import { getDriver, waitForNeo4j, ensureConstraints, closeDriver } from './config/neo4j.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

async function bootstrap() {
  await waitForNeo4j();
  await ensureConstraints();
  const driver = getDriver();

  const { app, apolloServer } = await createApp(driver);

  const httpServer = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'tournaments-svc running');
  });

  const shutdown = async () => {
    logger.info('shutting down');
    httpServer.close();
    await apolloServer.stop();
    await closeDriver();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'fatal error');
  process.exit(1);
});
