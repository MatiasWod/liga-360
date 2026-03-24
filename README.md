# Liga360 - Guia de arranque (actualizada)

Monorepo con frontend React y backend en microservicios para gestion de torneos, equipos, participantes, inscripciones e invitaciones.

## Stack del proyecto

- Frontend: `React + Vite + Tailwind` (en `src/`)
- Backend:
  - `gateway` (Apollo Gateway): `http://localhost:4000`
  - `tournaments-svc` (GraphQL + Neo4j): `http://localhost:4001`
  - `teams-svc` (REST + Postgres): `http://localhost:4002`
  - `auth-svc` (REST + Postgres): `http://localhost:4003`
  - `inscriptions-svc` (REST + Postgres): `http://localhost:4004`
- Bases:
  - Neo4j: `7474/7687`
  - Postgres: host `localhost`, puerto `55432`, db `liga360`

## Requisitos

- Docker Desktop encendido
- Node.js 18 o superior
- npm

## 1) Levantar backend completo

Desde la raiz del repo:

```bash
docker compose up -d --build
docker compose ps
```

### Health checks rapidos

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4001/health
curl -s http://localhost:4002/health
curl -s http://localhost:4003/health
curl -s http://localhost:4004/health
```

Todos deberian responder algo como `{"status":"ok"}`.

## 2) Levantar frontend

```bash
npm install
npm run dev
```

Abrir: `http://localhost:5173`

## 3) Flujo minimo recomendado para probar rapido

1. Registrar usuario `organizer` desde la UI.
2. Crear un torneo.
3. Entrar al detalle del torneo y:
   - agregar equipo manual en inscripciones basicas,
   - generar invitacion general o por equipo.
4. Registrar usuario `team` y validar:
   - gestion de plantilla del equipo,
   - asociacion por invitacion.

## 4) Endpoints utiles por servicio

### `auth-svc` (`http://localhost:4003`)

- `POST /register`
- `POST /login`

Payload de ejemplo:

```json
{
  "mode": "organizer",
  "username": "org_demo",
  "password": "pass123",
  "name": "Liga Demo"
}
```

### `teams-svc` (`http://localhost:4002`)

- `GET /teams`
- `POST /teams`
- `PATCH /teams/:id`
- `POST /participants`
- `PATCH /participants/:id`
- `POST /teams/:id/members`
- `DELETE /teams/:id/members/:participantId`
- `GET /profiles/me`
- `POST /profiles/me/claim-by-dni`
- `DELETE /profiles/me/participants/:id/unlink`
- `POST /teams/:id/access-code/rotate`
- `GET /teams/:id`

### `inscriptions-svc` (`http://localhost:4004`)

- `GET /inscriptions?tournamentId=...`
- `POST /inscriptions/manual-team`
- `POST /inscriptions`
- `PATCH /inscriptions/:id/status`
- `GET /invites?tournamentId=...`
- `POST /invites/general`
- `POST /invites/team`
- `GET /invites/:token`
- `POST /invites/:token/claim-general`
- `POST /invites/:token/claim-team`

### `gateway` GraphQL (`http://localhost:4000/graphql`)

Operaciones principales:

- `createTournament`
- `createCompetition`
- `addStage`
- `addTransitionTopN`
- `tournaments`
- `tournament(id)`

## 5) Variables y credenciales de desarrollo

Definidas en `docker-compose.yml`:

- JWT secret: `devsecret`
- Neo4j:
  - user: `neo4j`
  - pass: `password`
- Postgres:
  - user: `liga`
  - pass: `liga`
  - db: `liga360`

## 6) Troubleshooting (lo mas comun)

- **No conecta a `:4000/graphql`**
  - Esperar unos segundos y reiniciar gateway:
  ```bash
  docker compose restart gateway
  ```

- **Error de schema GraphQL (ej: `Unknown argument "configJson"`):**
  ```bash
  docker compose up -d --build tournaments-svc gateway
  ```

- **`teams-svc` devuelve 404 en endpoints nuevos**
  - El contenedor quedo viejo, reconstruir:
  ```bash
  docker compose up -d --build teams-svc
  ```

- **Error por token invalido**
  - cerrar sesion y volver a loguear para regenerar JWT.

- **Error de imagen muy pesada (`HTTP 413`)**
  - usar imagen mas chica o comprimida antes de subir.

## 7) Comandos utiles

```bash
# Ver logs de un servicio
docker logs -f liga360-gateway

# Reiniciar un servicio puntual
docker compose restart inscriptions-svc

# Reconstruir servicios puntuales
docker compose up -d --build teams-svc inscriptions-svc
```

## 8) Estructura resumida

```txt
.
├── src/                 # Frontend React
├── services/
│   ├── gateway/
│   ├── tournaments-svc/
│   ├── teams-svc/
│   ├── auth-svc/
│   └── inscriptions-svc/
├── docker-compose.yml
└── README.md
```

## 9) Política de testing y gating (recomendada)

Para minimizar regresiones en features nuevas:

- Cambios de lógica de negocio deben traer tests nuevos o actualizados.
- El push local corre validaciones con hook `pre-push`:
  - guard de cambios de lógica sin tests,
  - `npm run test:ci`,
  - `npm run test:e2e:smoke`.
- En remoto, el PR debe quedar en verde con:
  - Build + Unit + Integration,
  - E2E Smoke.

### Instalación del hook local

```bash
npm run hooks:install
```

### Bypass excepcional (emergencias)

Si realmente es necesario, se puede saltar hooks locales:

```bash
git push --no-verify
```

Esto **no** evita los checks remotos del pipeline para mergear a ramas protegidas.

---

Si seguis estos pasos deberias poder levantar y usar el flujo completo de Liga360 localmente sin configuracion adicional.


