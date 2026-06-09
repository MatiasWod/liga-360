-- Crea las bases por servicio (DB-per-service) en el primer arranque de Postgres.
-- Solo se ejecuta cuando el volumen de datos está vacío (docker-entrypoint-initdb.d).
-- Para volúmenes existentes, crear manualmente:
--   CREATE DATABASE liga360_auth;  CREATE DATABASE liga360_teams;
--   CREATE DATABASE liga360_inscriptions;  CREATE DATABASE liga360_matchevents;
-- (tournaments-svc usa Neo4j, no Postgres.)
SELECT 'CREATE DATABASE liga360_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_auth')\gexec
SELECT 'CREATE DATABASE liga360_teams'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_teams')\gexec
SELECT 'CREATE DATABASE liga360_inscriptions'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_inscriptions')\gexec
SELECT 'CREATE DATABASE liga360_matchevents'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'liga360_matchevents')\gexec
