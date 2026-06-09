/**
 * Esquema de teams-svc (DB propia: liga360_teams).
 * Tras fusionar identity-svc en teams-svc, esta DB también es dueña de Person_Profile.
 * Team + Participant + Team_Member + Person_Profile en una sola base ⇒ se restaura la FK real
 * Participant.person_profile_id → Person_Profile(id) (sin cross-DB).
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

    CREATE TABLE IF NOT EXISTS "Team" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id INTEGER,
      badge_url TEXT,
      access_code_hash TEXT,
      invite_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "Participant" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      nickname TEXT,
      dni TEXT,
      avatar_url TEXT,
      person_profile_id INTEGER REFERENCES "Person_Profile"(id) ON DELETE SET NULL,
      created_by_user_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "Team_Member" (
      team_id INTEGER NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, participant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_person_profile_dni ON "Person_Profile"(dni);
    CREATE INDEX IF NOT EXISTS idx_participant_dni ON "Participant"(dni);
    CREATE INDEX IF NOT EXISTS idx_participant_person_profile ON "Participant"(person_profile_id);
    CREATE INDEX IF NOT EXISTS idx_team_member_participant ON "Team_Member"(participant_id);
    CREATE INDEX IF NOT EXISTS idx_team_owner_user_id ON "Team"(owner_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invite_code_unique ON "Team"(invite_code);

    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DO $$
    DECLARE t TEXT;
    BEGIN
      FOREACH t IN ARRAY ARRAY['Person_Profile','Team','Participant'] LOOP
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
    DROP TABLE IF EXISTS "Team_Member" CASCADE;
    DROP TABLE IF EXISTS "Participant" CASCADE;
    DROP TABLE IF EXISTS "Team" CASCADE;
    DROP TABLE IF EXISTS "Person_Profile" CASCADE;
  `);
};
