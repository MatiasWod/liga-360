#!/usr/bin/env bash
# Levanta stack local completo + seed de demo para probar stats/presencias/historial.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
log()  { echo -e "${CYAN}[bootstrap]${RESET} $*"; }
ok()   { echo -e "${GREEN}[bootstrap]${RESET} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${RESET} $*"; }

if ! docker info >/dev/null 2>&1; then
  warn "Docker no está corriendo. Abrí Docker Desktop y volvé a ejecutar:"
  echo "  ./scripts/dev-bootstrap.sh"
  exit 1
fi

log "Levantando bases de datos y migraciones..."
docker compose up -d neo4j postgres
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U liga -d liga360 >/dev/null 2>&1 && break
  sleep 1
done

log "Asegurando bases por servicio (volumen existente puede no tenerlas)..."
for db in liga360_auth liga360_teams liga360_inscriptions liga360_matchevents; do
  exists="$(docker compose exec -T postgres psql -U liga -d liga360 -tAc "SELECT 1 FROM pg_database WHERE datname = '${db}'" 2>/dev/null | tr -d '[:space:]')"
  if [[ "${exists}" == "1" ]]; then
    continue
  fi
  # Idempotente: volumen existente o carrera paralela → "already exists" no es fatal.
  create_out="$(docker compose exec -T postgres psql -U liga -d liga360 -c "CREATE DATABASE \"${db}\";" 2>&1)" || {
    if echo "${create_out}" | grep -qi 'already exists'; then
      continue
    fi
    warn "No se pudo crear la base ${db}: ${create_out}"
    exit 1
  }
done

docker compose run --rm migrate-auth
docker compose run --rm migrate-teams
docker compose run --rm migrate-inscriptions
docker compose run --rm migrate-matchevents

log "Construyendo y levantando servicios (puede tardar unos minutos la primera vez)..."
docker compose up -d --build \
  auth-svc teams-svc tournaments-svc inscriptions-svc matchevents-svc gateway

wait_url() {
  local url=$1 label=$2
  log "Esperando $label..."
  for i in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "$label ✓"
      return 0
    fi
    sleep 2
  done
  warn "Timeout en $label ($url) — revisá: docker compose logs $label"
  return 1
}

wait_url "http://localhost:4001/health" "tournaments-svc"
wait_url "http://localhost:4002/health" "teams-svc"
wait_url "http://localhost:4003/health" "auth-svc"
wait_url "http://localhost:4004/health" "inscriptions-svc"
wait_url "http://localhost:4006/health" "matchevents-svc"
wait_url "http://localhost:4000/health" "gateway"

log "Cargando datos de demo..."
npm run seed:all

echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "  Stack listo. Iniciá el frontend en otra terminal:"
ok "    npm run dev"
ok "  UI: http://localhost:5173"
ok "  Clave demo: SeedLiga360!"
ok "  Equipo: equipo_alpha | Organizador: organizador"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
