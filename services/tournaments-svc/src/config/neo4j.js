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

// Labels cuyos nodos llevan un `id` propio (UUID generado por la app).
const NODE_ID_LABELS = ['Tournament', 'Competition', 'CompetitionSeries', 'Stage', 'Group', 'Match', 'Transition', 'Key'];

/**
 * Crea (idempotente) las constraints de unicidad por `id` y el índice de InscriptionRef.
 * Además de garantizar integridad (Neo4j aceptaría nodos duplicados sin esto), la constraint
 * crea el índice de respaldo que convierte `MATCH (n:Label {id:$id})` en un seek en vez de un
 * label scan. Se ejecuta en cada arranque; `IF NOT EXISTS` la hace segura de repetir.
 */
export async function ensureConstraints() {
  const d = getDriver();
  const session = d.session();
  try {
    for (const label of NODE_ID_LABELS) {
      await session.run(
        `CREATE CONSTRAINT ${label.toLowerCase()}_id_unique IF NOT EXISTS
         FOR (n:\`${label}\`) REQUIRE n.id IS UNIQUE`
      );
    }
    // InscriptionRef se identifica por (tournamentId, inscriptionId). La unicidad compuesta
    // (node key) requiere Neo4j Enterprise; en Community usamos un índice compuesto que acelera
    // los MERGE/MATCH y reduce la ventana de carrera.
    await session.run(
      `CREATE INDEX inscriptionref_key IF NOT EXISTS
       FOR (n:InscriptionRef) ON (n.tournamentId, n.inscriptionId)`
    );
    await session.run(
      `CREATE CONSTRAINT competition_series_slug_unique IF NOT EXISTS
       FOR (s:CompetitionSeries) REQUIRE s.slug IS UNIQUE`
    );
    logger.info('neo4j constraints ensured');
  } finally {
    await session.close();
  }
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
