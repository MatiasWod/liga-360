/**
 * Esquema de inscriptions-svc (DB propia: liga360_inscriptions).
 * Entidades: Inscription, Invite (contexto de inscripción/enrolamiento). Las referencias a otros
 * servicios (tournament_id/competition_id → tournaments-svc, linked_team_id → teams-svc,
 * *_user_id → auth-svc) son ids planos: sin FKs cross-DB ni datos duplicados.
 * La única FK real es intra-DB (Invite → Inscription). Los eventos de partido viven en matchevents-svc.
 */
export const up = (pgm) => {
  // 1) Tipos ENUM del dominio.
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

  // 2) Tablas.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Inscription" (
      id SERIAL PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      competition_id TEXT NULL,
      competitor_kind TEXT NOT NULL DEFAULT 'team' CHECK (competitor_kind IN ('team', 'participant')),
      display_name TEXT NOT NULL,
      linked_team_id INTEGER NULL,
      linked_participant_user_id INTEGER NULL,
      status inscription_status_enum NOT NULL DEFAULT 'PENDIENTE',
      source inscription_source_enum NOT NULL,
      created_by_user_id INTEGER NULL,
      reviewed_by_user_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      invite_response_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (invite_response_status IN ('pending', 'accepted', 'rejected')),
      expires_at TIMESTAMPTZ NULL,
      max_uses INTEGER NULL,
      uses_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 3) Índices (incluye unicidad parcial de inscripción activa por torneo).
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament ON "Inscription"(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_inscription_competition ON "Inscription"(competition_id);
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament_status ON "Inscription"(tournament_id, status);
    CREATE INDEX IF NOT EXISTS idx_inscription_competition_status ON "Inscription"(competition_id, status);
    CREATE INDEX IF NOT EXISTS idx_inscription_tournament_creator ON "Inscription"(tournament_id, created_by_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_inscription_tournament_linked_team_active
      ON "Inscription"(tournament_id, linked_team_id)
      WHERE linked_team_id IS NOT NULL AND status <> 'RECHAZADO';
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_inscription_tournament_linked_participant_active
      ON "Inscription"(tournament_id, linked_participant_user_id)
      WHERE linked_participant_user_id IS NOT NULL AND status <> 'RECHAZADO';

    CREATE INDEX IF NOT EXISTS idx_invite_tournament ON "Invite"(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_invite_competition ON "Invite"(competition_id);
    CREATE INDEX IF NOT EXISTS idx_invite_target_team_code ON "Invite"(target_team_code);
    CREATE INDEX IF NOT EXISTS idx_invite_target_participant_user_id ON "Invite"(target_participant_user_id);
  `);

  // 4) Trigger updated_at (Inscription e Invite versionan updated_at).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DO $$
    DECLARE t TEXT;
    BEGIN
      FOREACH t IN ARRAY ARRAY['Inscription', 'Invite'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_' || t) THEN
          EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();',
            'trg_set_updated_at_' || t, t
          );
        END IF;
      END LOOP;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS "Invite" CASCADE;
    DROP TABLE IF EXISTS "Inscription" CASCADE;
    DROP TYPE IF EXISTS inscription_status_enum;
    DROP TYPE IF EXISTS inscription_source_enum;
    DROP TYPE IF EXISTS invite_type_enum;
    DROP TYPE IF EXISTS invite_status_enum;
  `);
};
