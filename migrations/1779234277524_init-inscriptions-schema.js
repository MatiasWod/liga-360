export const up = (pgm) => {
    // 1. Tipos ENUM
    pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inscription_status_enum') THEN
        CREATE TYPE inscription_status_enum AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inscription_source_enum') THEN
        CREATE TYPE inscription_source_enum AS ENUM ('public', 'invitation', 'manual');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_type_enum') THEN
        CREATE TYPE invite_type_enum AS ENUM ('public', 'targeted');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status_enum') THEN
        CREATE TYPE invite_status_enum AS ENUM ('active', 'revoked');
      END IF;
    END$$;
  `);

    // 2. Limpieza Legacy
    pgm.sql(`
    DROP TABLE IF EXISTS "Tournament_Invite_Claim" CASCADE;
    DROP TABLE IF EXISTS "Tournament_Invite" CASCADE;
  `);

    // 3. Creación de Tablas Principales
    pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Inscription" (
      id SERIAL PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      competition_id TEXT NULL,
      competitor_kind TEXT NOT NULL DEFAULT 'team',
      display_name TEXT NOT NULL,
      linked_team_id INTEGER NULL,
      linked_participant_user_id INTEGER NULL,
      status inscription_status_enum NOT NULL DEFAULT 'PENDIENTE',
      source inscription_source_enum NOT NULL,
      created_by_user_id INTEGER NULL,
      reviewed_by_user_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "Invite" (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      tournament_id TEXT NOT NULL,
      competition_id TEXT NULL,
      type invite_type_enum NOT NULL,
      target_inscription_id INTEGER NULL REFERENCES "Inscription"(id) ON DELETE SET NULL,
      target_team_code TEXT NULL,
      target_participant_user_id INTEGER NULL,
      status invite_status_enum NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ NULL,
      max_uses INTEGER NULL,
      uses_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "MatchEvent" (
      id SERIAL PRIMARY KEY,
      match_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('goal','yellow_card','red_card','suspension','other_sanction')),
      inscription_id INT REFERENCES "Inscription"(id) ON DELETE SET NULL,
      linked_member_id INT NULL,
      display_name TEXT NOT NULL,
      minute INT NULL,
      suspension_matches INT NULL,
      notes TEXT NULL,
      extra_json JSONB NULL,
      created_by_user_id INT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

    // 4. Modificaciones Históricas e Índices
    pgm.sql(`
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER NULL;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER NULL;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS linked_team_id INTEGER NULL;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS linked_participant_user_id INTEGER NULL;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS competition_id TEXT NULL;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS competitor_kind TEXT NOT NULL DEFAULT 'team';
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE "Inscription" ADD COLUMN IF NOT EXISTS status TEXT;

    ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS competition_id TEXT NULL;
    ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS target_team_code TEXT NULL;
    ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS target_participant_user_id INTEGER NULL;
    ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS invite_response_status TEXT NOT NULL DEFAULT 'pending';

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Inscription' AND column_name = 'requested_by_user_id'
      ) THEN
        EXECUTE 'UPDATE "Inscription" SET created_by_user_id = requested_by_user_id WHERE created_by_user_id IS NULL';
      END IF;
    END$$;

    -- Legacy backfill: only when status/source were TEXT (pre-enum schema).
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Inscription'
          AND column_name = 'status' AND data_type = 'text'
      ) THEN
        EXECUTE $sql$
          UPDATE "Inscription"
          SET status = CASE
            WHEN UPPER(status) = 'PENDING' THEN 'PENDIENTE'
            WHEN UPPER(status) = 'APPROVED' THEN 'ACEPTADO'
            WHEN UPPER(status) = 'REJECTED' THEN 'RECHAZADO'
            ELSE COALESCE(status, 'PENDIENTE')
          END
        $sql$;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Inscription'
          AND column_name = 'source' AND data_type = 'text'
      ) THEN
        EXECUTE $sql$
          UPDATE "Inscription"
          SET source = CASE
            WHEN LOWER(source) = 'self' THEN 'public'
            WHEN LOWER(source) IN ('manual', 'invitation', 'public') THEN LOWER(source)
            ELSE 'public'
          END
        $sql$;
      END IF;
    END$$;

    WITH ranked_linked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id, linked_team_id ORDER BY created_at ASC, id ASC) AS rn
      FROM "Inscription" WHERE linked_team_id IS NOT NULL AND status <> 'RECHAZADO'
    )
    UPDATE "Inscription" i SET status = 'RECHAZADO', updated_at = NOW() FROM ranked_linked r WHERE i.id = r.id AND r.rn > 1;

    WITH ranked_unlinked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id, LOWER(TRIM(display_name)) ORDER BY created_at ASC, id ASC) AS rn
      FROM "Inscription" WHERE linked_team_id IS NULL AND TRIM(COALESCE(display_name, '')) <> '' AND status <> 'RECHAZADO'
    )
    UPDATE "Inscription" i SET status = 'RECHAZADO', updated_at = NOW() FROM ranked_unlinked r WHERE i.id = r.id AND r.rn > 1;

    WITH ranked_participants AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id, linked_participant_user_id ORDER BY created_at ASC, id ASC) AS rn
      FROM "Inscription" WHERE linked_participant_user_id IS NOT NULL AND status <> 'RECHAZADO'
    )
    UPDATE "Inscription" i SET status = 'RECHAZADO', updated_at = NOW() FROM ranked_participants r WHERE i.id = r.id AND r.rn > 1;

    CREATE INDEX IF NOT EXISTS idx_match_event_match_id ON "MatchEvent"(match_id);
    CREATE INDEX IF NOT EXISTS idx_match_event_tournament_id ON "MatchEvent"(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament ON "Inscription"(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_inscription_competition ON "Inscription"(competition_id);
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament_status ON "Inscription"(tournament_id, status);
    CREATE INDEX IF NOT EXISTS idx_inscription_competition_status ON "Inscription"(competition_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_inscription_tournament_linked_team_active
      ON "Inscription"(tournament_id, linked_team_id) WHERE linked_team_id IS NOT NULL AND status <> 'RECHAZADO';
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_inscription_tournament_linked_participant_active
      ON "Inscription"(tournament_id, linked_participant_user_id) WHERE linked_participant_user_id IS NOT NULL AND status <> 'RECHAZADO';
    CREATE INDEX IF NOT EXISTS idx_invite_tournament ON "Invite"(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_invite_competition ON "Invite"(competition_id);
    CREATE INDEX IF NOT EXISTS idx_invite_target_team_code ON "Invite"(target_team_code);
    CREATE INDEX IF NOT EXISTS idx_invite_target_participant_user_id ON "Invite"(target_participant_user_id);
    CREATE INDEX IF NOT EXISTS idx_invite_token ON "Invite"(token);
  `);
};

export const down = (pgm) => {
    // Función para revertir (rollback) en caso de fallo crítico
    pgm.sql(`
    DROP TABLE IF EXISTS "MatchEvent" CASCADE;
    DROP TABLE IF EXISTS "Invite" CASCADE;
    DROP TABLE IF EXISTS "Inscription" CASCADE;
    DROP TYPE IF EXISTS inscription_status_enum;
    DROP TYPE IF EXISTS inscription_source_enum;
    DROP TYPE IF EXISTS invite_type_enum;
    DROP TYPE IF EXISTS invite_status_enum;
  `);
};