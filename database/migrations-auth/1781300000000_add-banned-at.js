/**
 * Admins + baneo en Users (LIGA-170).
 *
 * banned_at: timestamp del baneo aplicado por un admin; NULL = activo. El baneo se aplica
 * al login (403 BANNED); los JWT vigentes expiran solos (1d), sin chequeos cross-service.
 * El timestamp preserva el momento del PRIMER baneo (auditoría).
 *
 * Además se recrea el CHECK de type: el init-auth-schema se editó en su momento para sumar
 * 'admin', pero las DBs donde ya estaba aplicado conservan el CHECK viejo (sin 'admin') y
 * rechazan el bootstrap del admin. Recrearlo acá lo arregla idempotentemente; en DBs nuevas
 * es un no-op semántico (mismo set de roles que el init).
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "Users_type_check";
    ALTER TABLE "Users" ADD CONSTRAINT "Users_type_check"
      CHECK (type IN ('team', 'participant', 'organizer', 'admin'));
  `);
};

export const down = (pgm) => {
  // No se restaura el CHECK sin 'admin': filas admin existentes lo violarían.
  pgm.sql(`ALTER TABLE "Users" DROP COLUMN IF EXISTS banned_at;`);
};
