/**
 * Split teams ↔ identity: Person_Profile pasa a su propia DB (identity-svc), por lo que el
 * FK cross-tabla Participant.person_profile_id → Person_Profile ya no puede existir.
 * Se elimina el constraint (la columna queda como referencia lógica). Idempotente.
 *
 * Aplica a la DB legacy `liga360`. En la nueva DB `liga360_teams` el FK nunca se crea
 * (ver database/migrations-teams).
 */
export const up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE c text;
    BEGIN
      IF to_regclass('"Participant"') IS NULL THEN RETURN; END IF;
      SELECT con.conname INTO c
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
      WHERE con.conrelid = '"Participant"'::regclass
        AND con.contype = 'f'
        AND a.attname = 'person_profile_id'
      LIMIT 1;
      IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE "Participant" DROP CONSTRAINT %I', c);
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('"Participant"') IS NOT NULL
         AND to_regclass('"Person_Profile"') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'Participant_person_profile_id_fkey'
         ) THEN
        ALTER TABLE "Participant"
          ADD CONSTRAINT "Participant_person_profile_id_fkey"
          FOREIGN KEY (person_profile_id) REFERENCES "Person_Profile"(id) ON DELETE SET NULL;
      END IF;
    END$$;
  `);
};
