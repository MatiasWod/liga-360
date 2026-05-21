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
    CREATE TABLE "Users" (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      type TEXT NOT NULL,
      type_id INTEGER NOT NULL
    );
    CREATE TABLE "Team" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE "Participant" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE "Organizer" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE "Participant_Team" (
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
        DROP TABLE "Participant_Team";
        DROP TABLE "Organizer";
        DROP TABLE "Participant";
        DROP TABLE "Team";
        DROP TABLE "Users";
  `);
};
