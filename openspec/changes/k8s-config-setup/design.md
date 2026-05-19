## Context

Liga360 es un monorepo con:

- **Frontend**: React + Vite, build estático servido por nginx (`Dockerfile.frontend`).
- **Backend**: 5 microservicios Node (puertos 4000–4004) + Apollo Gateway.
- **Datos**: PostgreSQL (auth, teams, inscriptions) y Neo4j (tournaments).
- **Orquestación local**: `docker-compose.yml` con healthchecks y variables de entorno documentadas implícitamente en el compose.
- **CI**: Bitbucket publica imágenes `DOCKER_USER/liga360-<service>:<commit>` en merge a `main`.

No existe carpeta `k8s/` ni `.env.example`. El frontend en Docker usa rutas relativas `/api/*` (ver `src/services/config.ts`) pero `nginx.conf` actual solo sirve SPA estático sin proxy — en K8s el proxy debe resolverse vía nginx en el pod frontend o vía Ingress con paths separados.

## Goals / Non-Goals

**Goals:**

- Manifiestos K8s aplicables con `kubectl apply -k k8s/` (o overlay `k8s/overlays/dev`).
- Paridad funcional con `docker-compose.yml` (mismos servicios, env vars equivalentes, orden de arranque vía `depends_on` → init/containers o probes).
- Imágenes parametrizables por variable de entorno en Kustomize (`images:`) para apuntar al registry de Bitbucket.
- Secretos y config no hardcodeados en Deployments (ConfigMap + Secret).
- Documentación clara para un desarrollador con cluster local (kind/minikube).

**Non-Goals:**

- Helm, ArgoCD, GitOps completo.
- Bases de datos gestionadas en la nube (RDS, Aura) — se despliegan en-cluster para dev; producción puede sustituir URLs vía overlay.
- Autoscaling (HPA), mTLS, NetworkPolicies avanzadas.
- Modificar la lógica de negocio de los servicios.

## Decisions

### 1. Kustomize (base + overlay `dev`) en lugar de Helm

**Elegido:** `k8s/base/` + `k8s/overlays/dev/`.

**Rationale:** El equipo ya usa YAML plano en compose y pipelines; Kustomize no añade runtime ni templating complejo. Helm sería overkill para el primer despliegue.

**Alternativa descartada:** Helm charts — más mantenimiento y curva de aprendizaje.

### 2. Namespace dedicado `liga360`

Todos los recursos en un namespace aislado. Facilita `kubectl delete namespace liga360` en entornos de prueba.

### 3. Bases de datos in-cluster (StatefulSet + PVC)

**Elegido:** PostgreSQL y Neo4j como StatefulSets con PersistentVolumeClaims para dev/staging.

**Rationale:** Paridad con compose; un solo comando levanta el stack.

**Alternativa:** ExternalName / solo URLs en Secret para prod — soportado vía overlay futuro sin bloquear este change.

### 4. Proxy API en nginx del frontend

**Elegido:** Extender `nginx.conf` con `location /api/graphql`, `/api/teams`, etc., apuntando a Services K8s (`gateway`, `teams-svc`, …) por nombre DNS interno.

**Rationale:** Mantiene las mismas URLs que Vite en dev y `config.ts` en prod sin rebuild por entorno.

**Alternativa:** Ingress con múltiples paths — válida para prod pero duplica reglas; se puede añadir Ingress además del proxy nginx para exposición externa única.

### 5. Ingress para exposición externa

Ingress `liga360` en overlay `dev` con host `liga360.local` (documentar entrada en `/etc/hosts` o `nip.io`). TLS opcional fuera de scope inicial.

### 6. Imágenes y tags

Kustomize `images:` reemplaza placeholders `liga360/<service>:latest` por registry real. Default en overlay dev: imágenes locales (`imagePullPolicy: Never` o `IfNotPresent`) construidas con `docker compose build`.

Para cluster remoto: setear `REGISTRY` y `TAG` antes de `kustomize build | kubectl apply`.

### 7. Secretos

- `Secret` `liga360-secrets`: `JWT_SECRET`, `NEO4J_PASSWORD`, `POSTGRES_PASSWORD`, etc.
- Plantilla `k8s/base/secrets.env.example` + documentación para `kubectl create secret generic --from-env-file`.
- No commitear `secrets.env`.

### 8. Estructura de directorios

```
k8s/
├── README.md
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── postgres/
│   ├── neo4j/
│   ├── auth-svc/
│   ├── teams-svc/
│   ├── tournaments-svc/
│   ├── inscriptions-svc/
│   ├── gateway/
│   └── frontend/
└── overlays/
    └── dev/
        ├── kustomization.yaml
        ├── ingress.yaml
        └── patches/   # imagePullPolicy, replicas, recursos
```

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Neo4j/Postgres en cluster consumen muchos recursos en laptops | Documentar requisitos mínimos; overlay futuro `external-db` solo con URLs |
| Imágenes de Bitbucket privadas requieren `imagePullSecrets` | Documentar creación de secret en README |
| Orden de arranque: gateway antes que tournaments listo | `readinessProbe` en todos los servicios; reintentos en inscriptions-svc ya existen en código |
| `nginx.conf` con upstream hardcodeado dificulta multi-namespace | Usar nombres de Service DNS cortos (`gateway`, `auth-svc`) dentro del mismo namespace |

## Migration Plan

1. Implementar manifiestos y `.env.example` en rama `LIGA-154`.
2. Validar en kind/minikube: build imágenes locales → `kubectl apply -k k8s/overlays/dev`.
3. Smoke: health endpoints y login vía UI.
4. En producción futura: overlay con registry Bitbucket + BD externa sin cambiar base.

**Rollback:** `kubectl delete -k k8s/overlays/dev` o borrar namespace.

## Open Questions

- ¿El cluster objetivo de producción es GKE, EKS, AKS u on-prem? (afecta Ingress class y storage class — por ahora `ingressClassName: nginx` genérico).
- ¿Se usará un registry privado de Bitbucket con credenciales por proyecto? (documentar en README, no bloquear dev local).
