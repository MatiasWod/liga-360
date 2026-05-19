## 1. Estructura y configuración base

- [x] 1.1 Crear `k8s/base/namespace.yaml` y `k8s/base/kustomization.yaml` con lista de recursos
- [x] 1.2 Crear `k8s/overlays/dev/kustomization.yaml` referenciando base + patches
- [x] 1.3 Añadir `.env.example` en la raíz con todas las variables de compose/K8s documentadas

## 2. Bases de datos

- [x] 2.1 Manifiestos StatefulSet + Service + PVC para `postgres` (alineado a compose: user/db/ports)
- [x] 2.2 Manifiestos StatefulSet + Service + PVC para `neo4j` (auth, heap, puertos 7474/7687)
- [x] 2.3 ConfigMap/Secret refs para credenciales de BD en pods de aplicación

## 3. Microservicios backend

- [x] 3.1 Deployment + Service `auth-svc` (env, probes `/health`, puerto 4003)
- [x] 3.2 Deployment + Service `teams-svc` (puerto 4002)
- [x] 3.3 Deployment + Service `tournaments-svc` (Neo4j env, puerto 4001)
- [x] 3.4 Deployment + Service `inscriptions-svc` (`TOURNAMENTS_GRAPHQL_URL`, puerto 4004)
- [x] 3.5 Deployment + Service `gateway` (dependencia tournaments, puerto 4000)

## 4. Frontend y networking

- [x] 4.1 Extender `nginx.conf` con upstream/proxy `/api/*` hacia Services K8s
- [x] 4.2 Deployment + Service `frontend` (imagen nginx, puerto 80)
- [x] 4.3 Ingress en overlay `dev` (host `liga360.local`, backend frontend:80)
- [x] 4.4 Patches Kustomize: `images:`, `imagePullPolicy`, recursos mínimos para dev

## 5. Secretos y ConfigMaps

- [x] 5.1 `k8s/base/configmap.yaml` con variables no sensibles compartidas
- [x] 5.2 Plantilla `k8s/secrets.env.example` y documentación de creación de Secret
- [x] 5.3 Wire envFrom (configMapRef + secretRef) en todos los Deployments de apps

## 6. Documentación y validación

- [x] 6.1 Escribir `k8s/README.md` (prerequisitos kind/minikube, build imágenes, apply, secrets, acceso UI)
- [x] 6.2 Validar `kubectl kustomize k8s/overlays/dev` sin errores
- [x] 6.3 Smoke manual: aplicar en cluster local, verificar `/health` de servicios y carga de UI
- [x] 6.4 Actualizar `AgentContext` o README del proyecto con enlace a `k8s/README.md` si aplica
