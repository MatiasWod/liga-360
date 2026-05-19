## Why

Liga360 ya construye y publica imágenes Docker en cada merge a `main` (Bitbucket Pipelines), pero no existe una forma reproducible de desplegar el stack completo en un clúster Kubernetes. Sin manifiestos ni convención de variables de entorno, cada despliegue sería ad hoc y propenso a errores de configuración entre servicios (URLs internas, secretos, bases de datos).

Este cambio habilita el despliegue en K8s como siguiente paso natural tras la CI de contenedores (change `ci-pipeline`).

## What Changes

- Directorio `k8s/` con manifiestos para todos los servicios del `docker-compose.yml`: frontend, gateway, auth-svc, teams-svc, tournaments-svc, inscriptions-svc, neo4j y postgres.
- `kustomization.yaml` (base + overlay `dev` opcional) para aplicar el stack con un solo comando.
- Plantillas de `ConfigMap` y `Secret` (valores sensibles vía `secretGenerator` o archivos locales no versionados).
- `.env.example` en la raíz documentando todas las variables usadas por compose y K8s.
- `nginx.conf` ampliado (o ConfigMap dedicado) para que el frontend en producción enrute `/api/*` hacia los servicios backend, igual que el proxy de Vite en desarrollo.
- Documentación de despliegue (`k8s/README.md`): prerequisitos, build/push de imágenes, aplicar manifiestos, acceso al cluster.

No se incluye en este change: Helm charts, operadores de BD gestionados, Terraform, ni pipeline de deploy automático a un cluster remoto.

## Capabilities

### New Capabilities

- `kubernetes-manifests`: Deployments, Services, probes y dependencias entre pods para el stack Liga360.
- `environment-configuration`: ConfigMaps, Secrets, `.env.example` y convención de nombres de variables alineada con `docker-compose.yml`.
- `ingress-and-networking`: Ingress (o NodePort documentado), DNS interno entre servicios y proxy del frontend hacia APIs.

### Modified Capabilities

_(ninguna — no hay specs previos en `openspec/specs/`)_

## Impact

- **Nuevos archivos**: `k8s/**`, `.env.example`, posible actualización de `nginx.conf` y `Dockerfile.frontend`.
- **CI**: sin cambios obligatorios en `bitbucket-pipelines.yml`; las imágenes ya publicadas se referencian por tag en los manifiestos.
- **Desarrollo local**: `docker-compose.yml` sigue siendo el camino principal; K8s es complementario (kind/minikube o cluster de equipo).
- **Seguridad**: secretos de ejemplo solo en plantillas; valores reales fuera del repositorio.
