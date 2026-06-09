# Liga360 — Kubernetes (GitOps)

Manifiestos [Kustomize](https://kustomize.io/) desplegados vía **Argo CD**. Un solo overlay de entorno en Git: **`deploy/k8s/overlays/dev`**.

## Modelo DevOps

```
Bitbucket (main) → CI build/test → push imágenes Docker Hub
                                        ↓
Git (deploy/k8s/overlays/dev) ← Argo CD Application liga360-dev → namespace liga360
                                        ↓
                         wave 0: Postgres, Neo4j
                         wave 1: Job db-migrate (liga360-migrator)
                         wave 2: Deployments (apps)
```

| Capa | Ubicación |
|------|-----------|
| Manifiestos | `deploy/k8s/base/` + `deploy/k8s/overlays/dev/` |
| GitOps | `deploy/argocd/application-dev.yaml` → `path: deploy/k8s/overlays/dev` |
| Imágenes | Docker Hub `bcanevaro/liga360-*` (CI en `bitbucket-pipelines.yml`) |
| Migraciones SQL | `database/migrations-{auth,teams,inscriptions}/` → imagen `database/Dockerfile` → Jobs `db-migrate-{auth,teams,inscriptions}` |
| Dev en máquina (sin K8s) | `docker-compose.yml` — camino aparte, no usa overlays K8s |

No hay overlay `local`: el clúster (kind, minikube o remoto) usa el **mismo** `overlays/dev` y las imágenes del registry.

## Requisitos

- `kubectl` 1.28+
- Clúster con **6 GB RAM** libres (Neo4j + PostgreSQL + apps)
- [Argo CD](https://argo-cd.readthedocs.io/) instalado
- Ingress controller (p. ej. `ingress-nginx`)
- Imágenes publicadas en Docker Hub (CI en `main` o push manual del migrator la primera vez)
- `imagePullSecret` `credenciales-dockerhub` en el namespace (overlay `dev`)

## Estructura

```
deploy/k8s/
├── base/                 # Recursos comunes + Job db-migrate
├── overlays/dev/         # Único overlay: Hub, Ingress, imagePullSecrets
├── secrets.env.example
└── README.md
deploy/argocd/
└── application-dev.yaml
database/
├── Dockerfile
├── package.json
└── migrations/
```

## 1. Secretos (una vez por clúster)

```bash
cp deploy/k8s/secrets.env.example deploy/k8s/secrets.env
# Editar valores en entornos reales

kubectl create namespace liga360 --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic liga360-secrets \
  --namespace liga360 \
  --from-env-file=deploy/k8s/secrets.env \
  --dry-run=client -o yaml | kubectl apply -f -
```

Claves: `JWT_SECRET`, `POSTGRES_PASSWORD`, `POSTGRES_URL`, `NEO4J_PASSWORD`, `NEO4J_AUTH`.

Registry privado: crear `credenciales-dockerhub` en `liga360` (el overlay `dev` lo referencia en Deployments).

## 2. Argo CD (camino recomendado)

1. Ajustar `deploy/argocd/application-dev.yaml` (`repoURL`, `targetRevision` = rama con los manifiestos).
2. Registrar el repo en Argo si es privado.
3. Aplicar la Application:

   ```bash
   kubectl apply -f deploy/argocd/application-dev.yaml
   ```

4. Sync `liga360-dev` en la UI o:

   ```bash
   argocd app sync liga360-dev
   ```

### Sync waves (orden automático)

| Wave | Recursos |
|------|----------|
| `0` | Postgres, Neo4j |
| `1` | Job `db-migrate` (imagen `bcanevaro/liga360-migrator`) |
| `2` | frontend, gateway, auth-svc, teams-svc, tournaments-svc, inscriptions-svc |

Si `db-migrate` falla, el sync debe quedar **Failed**; no desplegar apps sin esquema.

## 3. Imágenes en Docker Hub

CI publica en cada merge a `main`:

- `bcanevaro/liga360-frontend`
- `bcanevaro/liga360-gateway`
- `bcanevaro/liga360-auth-svc`
- `bcanevaro/liga360-teams-svc`
- `bcanevaro/liga360-tournaments-svc`
- `bcanevaro/liga360-inscriptions-svc`
- `bcanevaro/liga360-migrator`

Primera vez o rama sin CI: push manual del migrator (y del resto si falta):

```bash
docker login
docker build -f database/Dockerfile -t bcanevaro/liga360-migrator:latest .
docker push bcanevaro/liga360-migrator:latest
```

Luego **Sync** en Argo (no hace falta overlay distinto).

## 4. `kubectl apply` (solo bootstrap / emergencia)

Equivalente a lo que Argo aplica, pero **sin** sync waves de Argo:

```bash
kubectl kustomize deploy/k8s/overlays/dev
kubectl apply -k deploy/k8s/overlays/dev
```

Preferí **Argo Sync** como operación habitual para no divergir Git ↔ cluster.

Migración manual de emergencia (Postgres ya arriba), una por servicio:

```bash
kubectl -n liga360 port-forward svc/postgres 55432:5432
# En otra terminal, desde database/ (npm ci una vez):
DATABASE_URL=postgresql://liga:liga@localhost:55432/liga360_auth          npm run migrate:auth
DATABASE_URL=postgresql://liga:liga@localhost:55432/liga360_teams         npm run migrate:teams
DATABASE_URL=postgresql://liga:liga@localhost:55432/liga360_inscriptions  npm run migrate:inscriptions
DATABASE_URL=postgresql://liga:liga@localhost:55432/liga360_matchevents   npm run migrate:matchevents
```

## 5. Acceso a la aplicación

Ingress `liga360.local` (ver `deploy/k8s/overlays/dev/ingress.yaml`):

```bash
kubectl -n liga360 get ingress liga360
# Añadir <INGRESS_IP> liga360.local en hosts
```

## 6. Smoke / health

```bash
kubectl -n liga360 port-forward svc/gateway 4000:4000
curl -s http://localhost:4000/health
```

## Troubleshooting

### Job `db-migrate` ImagePullBackOff

La imagen no está en Hub. Push manual (sección 3) o esperar CI en `main`, luego Argo Sync.

### Neo4j CrashLoopBackOff (`PORT.7687.TCP.PORT`)

El StatefulSet usa `enableServiceLinks: false`. `kubectl -n liga360 delete pod neo4j-0`.

### `relation "Organizer" does not exist`

Migraciones no aplicadas. Revisar `kubectl -n liga360 logs job/db-migrate` y `\dt` en Postgres.

## Desarrollo local sin Kubernetes

Usar **docker-compose** en la raíz (`docker compose up`). Incluye servicio `migrate` antes de los servicios que usan Postgres. No reemplaza el flujo GitOps de Argo.

## Variables

`.env.example` (compose) y `deploy/k8s/secrets.env.example` (K8s). Config no sensible: ConfigMap `liga360-config`.

## Checklist de paridad de registro

- Secrets: `JWT_SECRET`, `POSTGRES_PASSWORD`, `POSTGRES_URL_AUTH`, `POSTGRES_URL_TEAMS`, `POSTGRES_URL_INSCRIPTIONS`, `POSTGRES_URL_MATCHEVENTS`, `NEO4J_PASSWORD`, `NEO4J_AUTH`.
- ConfigMap: `TOURNAMENTS_SUBGRAPH_URL`, `TOURNAMENTS_GRAPHQL_URL`, `CORS_ORIGINS`.
- Ingress apunta al frontend y el frontend enruta `/api/*` hacia los servicios.
- Jobs `db-migrate-{auth,teams,inscriptions,matchevents}` exitosos antes de desplegar apps.

## DB-per-service (Postgres)

Cada servicio SQL usa **su propia base**; `tournaments-svc` usa Neo4j (aparte). No hay tablas
compartidas: las referencias entre servicios son ids planos (sin FKs cross-DB ni datos duplicados).

| Servicio | Base de datos | Migraciones | Tablas |
|---|---|---|---|
| auth-svc | `liga360_auth` | `database/migrations-auth` | `Users` |
| teams-svc | `liga360_teams` | `database/migrations-teams` | `Person_Profile`, `Team`, `Participant`, `Team_Member` |
| inscriptions-svc | `liga360_inscriptions` | `database/migrations-inscriptions` | `Inscription`, `Invite` |
| matchevents-svc | `liga360_matchevents` | `database/migrations-matchevents` | `MatchEvent` |

Antes de aplicar los manifiestos hay que provisionar:

1. **Bases de datos** (en el Postgres del clúster): `liga360_auth`, `liga360_teams`, `liga360_inscriptions`, `liga360_matchevents`.
2. **Secret keys** en `liga360-secrets` (vía external-secrets / Vault), una por servicio:
   - `POSTGRES_URL_AUTH` → `postgresql://<user>:<pass>@postgres:5432/liga360_auth`
   - `POSTGRES_URL_TEAMS` → `postgresql://<user>:<pass>@postgres:5432/liga360_teams`
   - `POSTGRES_URL_INSCRIPTIONS` → `postgresql://<user>:<pass>@postgres:5432/liga360_inscriptions`
   - `POSTGRES_URL_MATCHEVENTS` → `postgresql://<user>:<pass>@postgres:5432/liga360_matchevents`

Los Jobs `db-migrate-{auth,teams,inscriptions,matchevents}` corren cada `migrate:<svc>` contra su DB (sync-wave 1).
Cada servicio lee su `POSTGRES_URL` de la key correspondiente. El ruteo `/profiles` lo resuelve el
nginx del frontend hacia `teams-svc` (no requiere cambios de Ingress).
