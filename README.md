# Liga360 – Guía de ejecución

Proyecto monorepo con:
- Frontend: React + Vite + Tailwind (formulario de definición de torneos, home, listado y detalle de torneos, registro/login).
- Backend (microservicios):
  - `gateway` (Apollo Gateway) en `:4000`
  - `tournaments-svc` (Apollo Subgraph + Neo4j driver) en `:4001`
  - `auth-svc` (Express + Postgres) en `:4003`
  - `teams-svc` (placeholder) en `:4002`
  - `inscriptions-svc` (placeholder) en `:4004`
  - Bases: Neo4j (7474/7687), Postgres (55432→5432)

## Requisitos
- Docker Desktop (running)
- Node 18+ y npm (para el frontend)

## 1) Backend – levantar con Docker
Desde la raíz del repo:
```bash
docker compose up -d --build
docker compose ps
```

Health checks:
```bash
# Gateway
curl -s http://localhost:4000/health
# Tournaments subgraph
curl -s http://localhost:4001/health
# Auth service
curl -s http://localhost:4003/health
```

Puertos:
- Gateway: `http://localhost:4000`
- Tournaments: `http://localhost:4001/graphql`
- Auth: `http://localhost:4003`
- Neo4j: `http://localhost:7474` (user: `neo4j` pass: `password`)
- Postgres: `localhost:55432` (user: `liga` pass: `liga` db: `liga360`)

> Nota: si cambiaste el schema de `tournaments-svc`, reconstruí el subgrafo y reiniciá el gateway:
```bash
docker compose up -d --build tournaments-svc
docker compose restart gateway
```

## 2) Frontend – modo dev
```bash
npm install
npm run dev
```
Abrí `http://localhost:5173/`.

### Vistas principales
- Home: bienvenida; si estás logueado como “organizer” muestra “Crear torneo”; todos ven “Visualizar torneos”.
- Crear torneo: builder con competencias y etapas; “Añadir nueva etapa” se muestra anclado en la esquina inferior de la sidebar (solo en esta vista).
- Visualizar torneos: cards con torneos, competiciones (mini-cards) y etapas (chips con iconos SVG). Click abre el detalle.
- Detalle de torneo: info general + competiciones y etapas.
- Registro/Login: pantallas dedicadas (full-screen), con opción “Continuar sin iniciar sesión/registrarme”.

## 3) Autenticación (auth-svc)
### Registro (3 modos)
Endpoint: `POST http://localhost:4003/register`
Body:
```json
{ "mode": "team|participant|organizer", "username": "user", "password": "pass", "name": "Nombre" }
```
- Acepta alias en español: `equipo`, `participante`, `organizador`.
- Crea:
  - Users(id, username, password bcrypt, type, type_id)
  - Team/Participant/Organizer según `mode`

Ejemplos:
```bash
# Organizador (alias en español)
curl -s -X POST http://localhost:4003/register \
  -H 'Content-Type: application/json' \
  -d '{"mode":"organizador","username":"org_demo","password":"pass","name":"Liga Demo"}'
```

### Login
Endpoint: `POST http://localhost:4003/login`
Body:
```json
{ "username": "org_demo", "password": "pass" }
```
Response:
```json
{ "token": "...", "user": { "id": 1, "username": "org_demo", "type": "organizer", "type_id": 1 } }
```

> La UI guarda `token` y `user` en `localStorage`. “Crear torneo” solo se muestra si `user.type === 'organizer'`.

## 4) GraphQL – torneos (gateway:4000)
### Crear torneo
```graphql
mutation CreateTournament($name:String!, $season:String, $venue:String, $organizer:String, $pt:String){
  createTournament(name:$name, season:$season, venue:$venue, organizer:$organizer, participantType:$pt){
    id name season
  }
}
```
Vars:
```json
{ "name":"Mundial", "season":"2026", "venue":"USA", "organizer":"FIFA", "pt":"teams" }
```

### Crear competencia
```graphql
mutation($tid:ID!){
  createCompetition(tournamentId:$tid, name:"Copa", order:1){ id name order }
}
```

### Agregar etapa
```graphql
mutation($cid:ID!){
  addStage(competitionId:$cid, name:"Fase de grupos", order:1, format:groups){
    id name order format
  }
}
```

### Transición TopN
```graphql
mutation($from:ID!, $to:ID!, $n:Int!){
  addTransitionTopN(fromStageId:$from, toStageId:$to, topN:$n){ id type topN }
}
```

### Consultar torneos
```graphql
{
  tournaments {
    id name venue organizer participantType
    competitions { id name order stages { id name order format } }
  }
}
```

### Detalle de torneo
```graphql
query($id:ID!){
  tournament(id:$id){
    id name venue organizer participantType
    competitions { id name order stages { id name order format } }
  }
}
```

## 5) Estructura de carpetas (resumen)
```
.
├── src/                            # Frontend (React + Vite)
│   ├── modules/
│   │   ├── home/Home.tsx
│   │   ├── auth/{Login,Register}.tsx
│   │   ├── tournaments-list/{TournamentsList,TournamentDetail}.tsx
│   │   └── tournament-form/...
│   └── ...
├── services/
│   ├── gateway/
│   ├── tournaments-svc/            # GraphQL + Neo4j
│   ├── auth-svc/                   # Express + Postgres
│   ├── teams-svc/                  # placeholder
│   └── inscriptions-svc/           # placeholder
├── docker-compose.yml
└── README.md
```

## 6) Problemas frecuentes
- “Cannot connect to the Docker daemon…”: abrí Docker Desktop.
- Cambié el schema y el gateway no ve `tournaments`: reiniciá el gateway tras reconstruir el subgrafo:
  ```bash
  docker compose up -d --build tournaments-svc
  docker compose restart gateway
  ```
- Neo4j vacío: creá un torneo como arriba y refrescá `Visualizar torneos`.

## 7) Scripts útiles
```bash
# Limpiar torneos que NO se llamen “Mundial” (Neo4j)
docker exec -i liga360-neo4j cypher-shell -u neo4j -p password \
  "MATCH (t:Tournament) WHERE toLower(t.name) <> 'mundial'
   OPTIONAL MATCH (t)-[:HAS_COMPETITION]->(c:Competition)
   OPTIONAL MATCH (c)-[:HAS_STAGE]->(s:Stage)
   OPTIONAL MATCH (s)-[:EMITS]->(tr:Transition)
   DETACH DELETE tr,s,c,t;"
```

---
¡Listo! Con esto deberías poder levantar backend y frontend, registrar usuarios (equipo/participante/organizador), crear torneos y visualizarlos. Cualquier duda o mejora que quieras sumar, avisá. 🚀


