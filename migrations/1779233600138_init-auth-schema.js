/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.sql(`
    CREATE TABLE IF NOT EXISTS "Users" (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      type TEXT NOT NULL,
      type_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Team" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Participant" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Organizer" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "Participant_Team" (
      id_team INTEGER NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
      id_participant INTEGER NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE,
      PRIMARY KEY (id_team, id_participant)
    );
  `)
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.sql(`
        DROP TABLE IF EXISTS "Participant_Team" CASCADE;
        DROP TABLE IF EXISTS "Organizer" CASCADE;
        DROP TABLE IF EXISTS "Participant" CASCADE;
        DROP TABLE IF EXISTS "Team" CASCADE;
        DROP TABLE IF EXISTS "Users" CASCADE;
  `);
};
