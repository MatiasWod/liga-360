# Liga360 - Guía de arranque

Monorepo con frontend React y backend en microservicios para gestión de torneos, equipos, participantes, inscripciones e invitaciones.

## Documentación de la API

La API REST está documentada en SwaggerHub: https://app.swaggerhub.com/apis-docs/MATIASWODTKE/liga-360/2.0.0#/

## Stack del proyecto

- Frontend: React + Vite + Tailwind (`frontend/`)
- Backend:
  - gateway (Apollo Gateway): http://localhost:4000
  - tournaments-svc (GraphQL + Neo4j): http://localhost:4001
  - teams-svc (REST + Postgres, incluye Person_Profile): http://localhost:4002
  - auth-svc (REST + Postgres): http://localhost:4003
  - inscriptions-svc (REST + Postgres): http://localhost:4004
  - matchevents-svc (REST + Postgres): http://localhost:4006
- Bases:
  - Neo4j: 7474 / 7687
  - Postgres: host localhost, puerto 55432. DB-per-service: `liga360_auth`, `liga360_teams`, `liga360_inscriptions`, `liga360_matchevents`

## Requisitos

- Docker Desktop encendido
- Docker Compose

## Configuración (`.env`)

Copiar el ejemplo y ajustar lo necesario:

```bash
cp .env.example .env
```

Variables relevantes:

- **PostgreSQL / Neo4j**: credenciales de las bases.
- **`JWT_SECRET`**: secreto compartido para firmar/validar los JWT. Generar uno propio en cualquier entorno real (`openssl rand -hex 64`).
- **Admin bootstrap (`ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`)**: auth-svc crea este usuario admin al arrancar (no hay registro de admins). Cambiar fuera de dev local.
- **Mail (`SMTP_*`, `FRONTEND_URL`)**: envío de los mails de verificación de cuenta. Si `SMTP_HOST` queda vacío, no se manda el mail y el registro igual funciona.

Para desarrollo local los defaults del `.env.example` alcanzan.

## Arranque rápido

### Opción recomendada (todo en Docker)

```bash
docker compose up -d --build
```

Abrir frontend en: http://localhost:5173

Usuario admin por defecto (dev): `admin` / `admin123`.

## Health checks rápidos

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4001/health
curl -s http://localhost:4002/health
curl -s http://localhost:4003/health
curl -s http://localhost:4004/health
curl -s http://localhost:4006/health
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
