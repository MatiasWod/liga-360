# Liga360 — Kubernetes (GitOps)

Manifiestos [Kustomize](https://kustomize.io/) desplegados vía **Argo CD**. Un solo overlay de entorno en Git: **`k8s/overlays/dev`**.

## Modelo DevOps

```
Bitbucket (main) → CI build/test → push imágenes Docker Hub
                                        ↓
Git (k8s/overlays/dev) ← Argo CD Application liga360-dev → namespace liga360
                                        ↓
                         wave 0: Postgres, Neo4j
                         wave 1: Job db-migrate (liga360-migrator)
                         wave 2: Deployments (apps)
```

| Capa | Ubicación |
|------|-----------|
| Manifiestos | `k8s/base/` + `k8s/overlays/dev/` |
| GitOps | `argocd/application-dev.yaml` → `path: k8s/overlays/dev` |
| Imágenes | Docker Hub `bcanevaro/liga360-*` (CI en `bitbucket-pipelines.yml`) |
| Migraciones SQL | `migrations/` → imagen `Dockerfile.migrator` → Job `db-migrate` |
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
k8s/
├── base/                 # Recursos comunes + Job db-migrate
├── overlays/dev/         # Único overlay: Hub, Ingress, imagePullSecrets
├── secrets.env.example
└── README.md
argocd/
└── application-dev.yaml
Dockerfile.migrator
migrations/
```

## 1. Secretos (una vez por clúster)

```bash
cp k8s/secrets.env.example k8s/secrets.env
# Editar valores en entornos reales

kubectl create namespace liga360 --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic liga360-secrets \
  --namespace liga360 \
  --from-env-file=k8s/secrets.env \
  --dry-run=client -o yaml | kubectl apply -f -
```

Claves: `JWT_SECRET`, `POSTGRES_PASSWORD`, `POSTGRES_URL`, `NEO4J_PASSWORD`, `NEO4J_AUTH`.

Registry privado: crear `credenciales-dockerhub` en `liga360` (el overlay `dev` lo referencia en Deployments).

## 2. Argo CD (camino recomendado)

1. Ajustar `argocd/application-dev.yaml` (`repoURL`, `targetRevision` = rama con los manifiestos).
2. Registrar el repo en Argo si es privado.
3. Aplicar la Application:

   ```bash
   kubectl apply -f argocd/application-dev.yaml
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
docker build -f Dockerfile.migrator -t bcanevaro/liga360-migrator:latest .
docker push bcanevaro/liga360-migrator:latest
```

Luego **Sync** en Argo (no hace falta overlay distinto).

## 4. `kubectl apply` (solo bootstrap / emergencia)

Equivalente a lo que Argo aplica, pero **sin** sync waves de Argo:

```bash
kubectl kustomize k8s/overlays/dev
kubectl apply -k k8s/overlays/dev
```

Preferí **Argo Sync** como operación habitual para no divergir Git ↔ cluster.

Migración manual de emergencia (Postgres ya arriba):

```bash
kubectl -n liga360 port-forward svc/postgres 55432:5432
# En otra terminal, desde la raíz del repo:
export DATABASE_URL=postgresql://liga:liga@localhost:55432/liga360
npm run migrate
```

## 5. Acceso a la aplicación

Ingress `liga360.local` (ver `k8s/overlays/dev/ingress.yaml`):

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

`.env.example` (compose) y `k8s/secrets.env.example` (K8s). Config no sensible: ConfigMap `liga360-config`.
