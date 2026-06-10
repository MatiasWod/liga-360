/** Índice para listByTeam (historial cross-torneo): lookup por linked_team_id. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_inscription_linked_team
      ON "Inscription"(linked_team_id)
      WHERE linked_team_id IS NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_inscription_linked_team;`);
};
