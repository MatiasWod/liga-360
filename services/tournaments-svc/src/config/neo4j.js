import neo4j from 'neo4j-driver';
import { env } from './env.js';
import { logger } from '../logger.js';

let driver = null;

export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      env.neo4jUri,
      neo4j.auth.basic(env.neo4jUsername, env.neo4jPassword)
    );
  }
  return driver;
}

export async function waitForNeo4j(maxAttempts = 20, delayMs = 500) {
  const d = getDriver();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await d.getServerInfo();
      logger.info('neo4j connected');
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
