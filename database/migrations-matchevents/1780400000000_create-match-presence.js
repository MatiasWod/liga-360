/**
 * Tabla MatchPresence (ADR-0002): presencias opt-in positivas por partido.
 * Solo existen registros cargados por el dueño del equipo; display_name es un
 * snapshot inmutable de texto (los cambios de plantel no alteran presencias).
 * Referencias planas cross-service: match_id/tournament_id/competition_id →
 * tournaments-svc, inscription_id → inscriptions-svc, linked_member_id →
 * teams-svc(Participant), created_by_user_id → auth-svc.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "MatchPresence" (
      id SERIAL PRIMARY KEY,
      match_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      competition_id TEXT NULL,
      inscription_id INTEGER NOT NULL,
      linked_member_id INTEGER NULL,
      display_name TEXT NOT NULL,
      is_guest BOOLEAN NOT NULL DEFAULT false,
      created_by_user_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_match_presence_match ON "MatchPresence"(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_presence_inscription ON "MatchPresence"(inscription_id);
    CREATE INDEX IF NOT EXISTS idx_match_presence_member
      ON "MatchPresence"(linked_member_id) WHERE linked_member_id IS NOT NULL;

    -- Un jugador vinculado no puede figurar dos veces en el mismo partido/inscripción
    CREATE UNIQUE INDEX IF NOT EXISTS uq_match_presence_member
      ON "MatchPresence"(match_id, inscription_id, linked_member_id)
      WHERE linked_member_id IS NOT NULL;

    -- Mismo criterio para entradas de texto (nombre normalizado) sin vínculo
    CREATE UNIQUE INDEX IF NOT EXISTS uq_match_presence_name
      ON "MatchPresence"(match_id, inscription_id, lower(btrim(display_name)))
      WHERE linked_member_id IS NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_MatchPresence') THEN
        EXECUTE 'CREATE TRIGGER "trg_set_updated_at_MatchPresence" BEFORE UPDATE ON "MatchPresence" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();';
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS "MatchPresence" CASCADE;`);
};
