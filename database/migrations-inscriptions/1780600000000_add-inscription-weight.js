/** Ponderación manual por inscripción (1–10, null = neutro al ordenar). */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Inscription"
      ADD COLUMN IF NOT EXISTS weight SMALLINT NULL
      CHECK (weight IS NULL OR (weight >= 1 AND weight <= 10));
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE "Inscription" DROP COLUMN IF EXISTS weight;`);
};
