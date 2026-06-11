/** GhostElo local por inscripción fantasma (sin linked_team_id). */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Inscription"
      ADD COLUMN IF NOT EXISTS tournament_rating INTEGER NULL DEFAULT 1200;
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE "Inscription" DROP COLUMN IF EXISTS tournament_rating;`);
};
