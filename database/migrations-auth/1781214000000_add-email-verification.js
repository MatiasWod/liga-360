/**
 * Email + verificación de cuenta en Users (LIGA-164).
 * El init-auth-schema se editó después de haberse aplicado en DBs existentes, por lo que
 * esas DBs no tienen email/"isVerified". Esta migración las agrega de forma idempotente:
 * en DBs nuevas (donde el init ya las crea) cada paso es un no-op.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;

    -- Backfill para usuarios previos al campo email (cuentas locales de prueba).
    UPDATE "Users" SET email = LOWER(username) || '@placeholder.liga360.com.ar' WHERE email IS NULL;
    ALTER TABLE "Users" ALTER COLUMN email SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_email_valido' AND conrelid = '"Users"'::regclass
      ) THEN
        ALTER TABLE "Users" ADD CONSTRAINT chk_email_valido CHECK (email LIKE '%_@__%._%');
      END IF;
    END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS chk_email_valido;
    ALTER TABLE "Users" DROP COLUMN IF EXISTS "isVerified";
    ALTER TABLE "Users" DROP COLUMN IF EXISTS email;
  `);
};
