-- Crea las bases por servicio (DB-per-service) en el primer arranque de Postgres.
-- Solo se ejecuta cuando el volumen de datos está vacío (docker-entrypoint-initdb.d).
-- Para volúmenes existentes, crear manualmente:
--   CREATE DATABASE liga360_teams;  CREATE DATABASE liga360_identity;
SELECT 'CREATE DATABASE liga360_teams'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_teams')\gexec
SELECT 'CREATE DATABASE liga360_identity'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_identity')\gexec
