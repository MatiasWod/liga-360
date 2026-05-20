exports.up = (pgm) => {
    // 1. Creación de Tablas Base y Relaciones
    pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Team" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "Participant" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS "Team_Member" (
      team_id INTEGER NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, participant_id)
    );
  `);

    // 2. Modificaciones Históricas (Nuevas columnas)
    pgm.sql(`
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS badge_url TEXT;
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS access_code_hash TEXT;
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS invite_code TEXT;
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS nickname TEXT;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS dni TEXT;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS person_profile_id INTEGER REFERENCES "Person_Profile"(id) ON DELETE SET NULL;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  `);

    // 3. Índices
    pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_participant_dni ON "Participant"(dni);
    CREATE INDEX IF NOT EXISTS idx_team_member_participant ON "Team_Member"(participant_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invite_code_unique ON "Team"(invite_code);
  `);
};

exports.down = (pgm) => {
    // Rollback en orden inverso para respetar las llaves foráneas
    pgm.sql(`
    DROP TABLE IF EXISTS "Team_Member" CASCADE;
    DROP TABLE IF EXISTS "Participant" CASCADE;
    DROP TABLE IF EXISTS "Team" CASCADE;
    DROP TABLE IF EXISTS "Person_Profile" CASCADE;
  `);
};