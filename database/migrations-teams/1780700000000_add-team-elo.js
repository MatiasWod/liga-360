/** ELO global por equipo + auditoría idempotente por partido. */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Team"
      ADD COLUMN IF NOT EXISTS elo INTEGER NOT NULL DEFAULT 1200;

    CREATE TABLE IF NOT EXISTS elo_match_event (
      id SERIAL PRIMARY KEY,
      match_id TEXT NOT NULL UNIQUE,
      tournament_id TEXT NOT NULL,
      home_inscription_id TEXT NOT NULL,
      away_inscription_id TEXT NOT NULL,
      home_elo_before INTEGER NOT NULL,
      away_elo_before INTEGER NOT NULL,
      home_delta INTEGER NOT NULL,
      away_delta INTEGER NOT NULL,
      home_elo_after INTEGER NOT NULL,
      away_elo_after INTEGER NOT NULL,
      home_team_id INTEGER NULL,
      away_team_id INTEGER NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS elo_match_event;
    ALTER TABLE "Team" DROP COLUMN IF EXISTS elo;
  `);
};
