# Liga360 - Guía de arranque

Monorepo con frontend React y backend en microservicios para gestión de torneos, equipos, participantes, inscripciones e invitaciones.

## Stack del proyecto

- Frontend: React + Vite + Tailwind (`frontend/`)
- Backend:
  - gateway (Apollo Gateway): http://localhost:4000
  - tournaments-svc (GraphQL + Neo4j): http://localhost:4001
  - teams-svc (REST + Postgres): http://localhost:4002
  - auth-svc (REST + Postgres): http://localhost:4003
  - inscriptions-svc (REST + Postgres): http://localhost:4004
- Bases:
  - Neo4j: 7474 / 7687
  - Postgres: host localhost, puerto 55432, db liga360

## Requisitos

- Docker Desktop encendido
- Docker Compose

## Arranque rápido

### Opción recomendada (todo en Docker)

```bash
docker compose up -d --build
```

Abrir frontend en: http://localhost:5173

## Health checks rápidos

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4001/health
curl -s http://localhost:4002/health
curl -s http://localhost:4003/health
curl -s http://localhost:4004/health
```

## Flujo mínimo sugerido

1. Registrar usuario organizer desde la UI.
2. Crear un torneo.
3. Ir al detalle del torneo y:
   - agregar equipo manual en inscripciones básicas,
   - generar invitación general o por equipo.
4. Registrar usuario team y validar:
   - gestión de plantilla del equipo,
   - asociación por invitación.

## Estructura de root recomendada

- `index.html` en raíz: correcto para Vite.
- Assets estáticos sueltos en `public/` y referenciados como `/archivo.ext`.

## Despliegue en Kubernetes

Manifiestos Kustomize en `deploy/k8s/` (overlay `dev` para cluster local). Guía completa: [deploy/k8s/README.md](deploy/k8s/README.md).

```bash
cp deploy/k8s/secrets.env.example deploy/k8s/secrets.env
kubectl create secret generic liga360-secrets -n liga360 --from-env-file=deploy/k8s/secrets.env --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k deploy/k8s/overlays/dev
```

## Comandos útiles

```bash
# Ver logs de un servicio
docker logs -f liga360-gateway

# Reiniciar un servicio puntual
docker compose restart inscriptions-svc

# Reconstruir servicios puntuales
docker compose up -d --build teams-svc inscriptions-svc
```
