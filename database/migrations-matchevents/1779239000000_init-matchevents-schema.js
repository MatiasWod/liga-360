/**
 * Esquema de matchevents-svc (DB propia: liga360_matchevents).
 * Entidad: MatchEvent (goles, tarjetas, suspensiones, sanciones de un partido).
 * Contexto de operación en vivo del partido, separado del enrolamiento (inscriptions-svc).
 * Todas las referencias son ids planos a otros servicios (sin FKs cross-DB):
 *   match_id/tournament_id → tournaments-svc, inscription_id → inscriptions-svc,
 *   linked_member_id → teams-svc(Participant), created_by_user_id → auth-svc.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "MatchEvent" (
      id SERIAL PRIMARY KEY,
      match_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      event_type TEXT NOT NULL
        CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction')),
      inscription_id INTEGER NULL,
      linked_member_id INTEGER NULL,
      display_name TEXT NOT NULL,
      minute INTEGER NULL,
      suspension_matches INTEGER NULL,
      notes TEXT NULL,
      extra_json JSONB NULL,
      created_by_user_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_match_event_match_id ON "MatchEvent"(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_event_tournament_id ON "MatchEvent"(tournament_id);

    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_MatchEvent') THEN
        EXECUTE 'CREATE TRIGGER "trg_set_updated_at_MatchEvent" BEFORE UPDATE ON "MatchEvent" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();';
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS "MatchEvent" CASCADE;`);
};
