export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Users" DROP COLUMN IF EXISTS type_id;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Users" ADD COLUMN type_id INTEGER;
  `);
};
