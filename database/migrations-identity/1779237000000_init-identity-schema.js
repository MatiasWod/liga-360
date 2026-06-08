/**
 * Esquema de identity-svc (DB propia: liga360_identity).
 * Person_Profile: identidad de usuario por DNI (vínculo user ↔ participantes).
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Person_Profile" (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      dni TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_person_profile_dni ON "Person_Profile"(dni);

    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_Person_Profile') THEN
        EXECUTE 'CREATE TRIGGER "trg_set_updated_at_Person_Profile" BEFORE UPDATE ON "Person_Profile" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();';
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS "Person_Profile" CASCADE;`);
};
