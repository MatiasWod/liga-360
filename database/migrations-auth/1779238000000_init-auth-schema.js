/**
 * Esquema de auth-svc (DB propia: liga360_auth).
 * Única entidad: Users (credenciales + tipo de cuenta). El resto de dominios viven en sus
 * propios servicios (teams-svc, inscriptions-svc, tournaments-svc) y se referencian por id,
 * sin duplicar tablas ni FKs cross-DB.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Users" (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      "isVerified" BOOLEAN NOT NULL DEFAULT false,
      type TEXT NOT NULL CHECK (type IN ('team', 'participant', 'organizer', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_email_valido CHECK (email LIKE '%_@__%._%')
    );
    
    -- Unicidad case-insensitive (el login compara LOWER(username)).
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON "Users" (LOWER(username));

    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_Users') THEN
        EXECUTE 'CREATE TRIGGER "trg_set_updated_at_Users" BEFORE UPDATE ON "Users" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();';
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS "Users" CASCADE;`);
};
