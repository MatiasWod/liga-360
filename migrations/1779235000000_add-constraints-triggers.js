export const up = (pgm) => {
  pgm.sql(`
  -- 1) Añadir CHECK constraint a Users.type si no existe
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_type_check'
    ) THEN
      ALTER TABLE "Users" ADD CONSTRAINT users_type_check CHECK (type IN ('team','participant','organizer'));
    END IF;
  END$$;

  -- 2) Crear función trigger para mantener updated_at
  CREATE OR REPLACE FUNCTION trigger_set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- 3) Asociar trigger a tablas que tengan columna updated_at
  DO $$
  DECLARE
    t RECORD;
    trg_name TEXT;
  BEGIN
    FOR t IN
      SELECT table_name FROM information_schema.columns
      WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
      trg_name := 'trg_set_updated_at_' || t.table_name;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = trg_name
      ) THEN
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON "%I" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION trigger_set_updated_at();', trg_name, t.table_name);
      END IF;
    END LOOP;
  END$$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
  -- Eliminar triggers asociados
  DO $$
  DECLARE
    t RECORD;
    trg_name TEXT;
  BEGIN
    FOR t IN
      SELECT table_name FROM information_schema.columns
      WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
      trg_name := 'trg_set_updated_at_' || t.table_name;
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trg_name) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON "%I" CASCADE;', trg_name, t.table_name);
      END IF;
    END LOOP;
  END$$;

  -- Eliminar la función
  DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE;

  -- Eliminar constraint de Users si existe
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_type_check') THEN
      ALTER TABLE "Users" DROP CONSTRAINT users_type_check;
    END IF;
  END$$;
  `);
};

