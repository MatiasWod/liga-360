/**
 * Agrega competition_id a MatchEvent para poder agregar estadísticas por Competencia
 * (goleadores, amonestados, tarjetas por equipo) sin resolver match→competition contra Neo4j.
 * ID plano a tournaments-svc, como el resto de las referencias cross-service.
 * Nullable: los eventos legacy sin backfill agregan solo a nivel Torneo.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "MatchEvent" ADD COLUMN IF NOT EXISTS competition_id TEXT NULL;

    CREATE INDEX IF NOT EXISTS idx_match_event_stats
      ON "MatchEvent"(tournament_id, competition_id, event_type);

    CREATE INDEX IF NOT EXISTS idx_match_event_inscription
      ON "MatchEvent"(inscription_id) WHERE inscription_id IS NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_match_event_stats;
    DROP INDEX IF EXISTS idx_match_event_inscription;
    ALTER TABLE "MatchEvent" DROP COLUMN IF EXISTS competition_id;
  `);
};
