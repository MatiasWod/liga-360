#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_dev.sh — Modo desarrollo con hot-reload
#
# Uso:
#   ./run_dev.sh              → todo (DBs + backends + frontend Vite)
#   ./run_dev.sh --backend    → solo DBs + backends (sin Vite)
#   ./run_dev.sh --frontend   → solo Vite (asume backends ya corriendo)
#   ./run_dev.sh --svc <name> → reinicia un backend específico
#
# Diferencias con run_project.sh:
#   - DBs en Docker, backends en host con `node --watch` (auto-reload al guardar)
#   - Frontend con Vite dev server (HMR instantáneo)
#   - No hace docker build: ideal para editar código y ver cambios al toque
# ---------------------------------------------------------------------------

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

MODE="all"
TARGET_SVC=""

for arg in "$@"; do
  case "$arg" in
    --backend)  MODE="backend" ;;
    --frontend) MODE="frontend" ;;
    --svc)      MODE="svc" ;;
    --help|-h)
      cat <<'EOF'
Uso:
  ./run_dev.sh              Levanta todo en modo dev
  ./run_dev.sh --backend    Solo DBs + backends (sin Vite)
  ./run_dev.sh --frontend   Solo Vite dev server
  ./run_dev.sh --svc <svc>  Corre un solo backend con watch
                            Ej: ./run_dev.sh --svc tournaments-svc

Logs de backend: ./logs/<nombre>.log
Frontend:        http://localhost:5173
EOF
      exit 0
      ;;
    *)
      if [[ "$MODE" == "svc" && -z "$TARGET_SVC" ]]; then
        TARGET_SVC="$arg"
      else
        echo "Opción desconocida: $arg — usá --help"
        exit 1
      fi
      ;;
  esac
done

# ── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RESET='\033[0m'
log()  { echo -e "${CYAN}[dev]${RESET} $*"; }
ok()   { echo -e "${GREEN}[dev]${RESET} $*"; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*"; }

# ── Limpieza al salir ─────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Deteniendo backends..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "Listo."
}
trap cleanup EXIT INT TERM

# ── Funciones ─────────────────────────────────────────────────────────────────
wait_for_url() {
  local url=$1 label=$2
  local attempts=0
  log "Esperando $label..."
  until curl -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge 40 ]]; then
      warn "Timeout esperando $label ($url)"
      return 1
    fi
    sleep 2
  done
  ok "$label listo ✓"
}

wait_for_pg() {
  log "Esperando PostgreSQL..."
  local attempts=0
  until docker compose exec -T postgres pg_isready -U liga -d liga360 >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [[ $attempts -ge 30 ]] && { warn "Timeout esperando PostgreSQL"; break; }
    sleep 1
  done
  ok "PostgreSQL listo ✓"
}

start_backend() {
  local name=$1; shift            # nombre del servicio
  local log_file="$ROOT/logs/$name.log"
  log "Iniciando $name con watch → logs/$name.log"
  env "$@" node --watch "$ROOT/services/$name/src/index.js" \
    > "$log_file" 2>&1 &
  PIDS+=($!)
}

# ── Modo: un solo servicio ────────────────────────────────────────────────────
if [[ "$MODE" == "svc" ]]; then
  if [[ -z "$TARGET_SVC" ]]; then
    echo "Indicá el servicio: ./run_dev.sh --svc <nombre>"
    exit 1
  fi
  mkdir -p "$ROOT/logs"
  if [[ ! -d "$ROOT/services/$TARGET_SVC/node_modules/pino" ]]; then
    log "Instalando dependencias de $TARGET_SVC..."
    (cd "$ROOT/services/$TARGET_SVC" && npm install --silent)
  fi
  case "$TARGET_SVC" in
    auth-svc)
      start_backend auth-svc \
        PORT=4003 JWT_SECRET=devsecret NODE_ENV=development \
        POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360
      ;;
    tournaments-svc)
      start_backend tournaments-svc \
        PORT=4001 NODE_ENV=development \
        NEO4J_URI=bolt://localhost:7687 NEO4J_USERNAME=neo4j NEO4J_PASSWORD=password
      ;;
    teams-svc)
      start_backend teams-svc \
        PORT=4002 JWT_SECRET=devsecret NODE_ENV=development \
        POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360
      ;;
    inscriptions-svc)
      start_backend inscriptions-svc \
        PORT=4004 JWT_SECRET=devsecret NODE_ENV=development \
        POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360 \
        TOURNAMENTS_GRAPHQL_URL=http://localhost:4000/graphql
      ;;
    gateway)
      start_backend gateway \
        PORT=4000 NODE_ENV=development \
        TOURNAMENTS_SUBGRAPH_URL=http://localhost:4001/graphql
      ;;
    *)
      echo "Servicio desconocido: $TARGET_SVC"
      echo "Opciones: auth-svc | tournaments-svc | teams-svc | inscriptions-svc | gateway"
      exit 1
      ;;
  esac
  ok "$TARGET_SVC corriendo. Logs en logs/$TARGET_SVC.log"
  wait
  exit 0
fi

# ── Modo: solo frontend ───────────────────────────────────────────────────────
if [[ "$MODE" == "frontend" ]]; then
  log "Iniciando Vite dev server..."
  npm run dev
  exit 0
fi

# ── Modo: backend (y si es all, también frontend) ─────────────────────────────

# 0. Dependencias de cada servicio (si falta alguna dep clave)
ensure_deps() {
  local svc=$1
  local dir="$ROOT/services/$svc"
  # Verifica si pino (dep común) está instalada como indicador de instalación completa
  if [[ ! -d "$dir/node_modules/pino" ]]; then
    log "Instalando dependencias de $svc..."
    (cd "$dir" && npm install --silent) || warn "npm install en $svc falló — continuando de todas formas"
  fi
}
for svc in auth-svc tournaments-svc teams-svc inscriptions-svc gateway; do
  ensure_deps "$svc"
done

# 1. Bases de datos en Docker
log "Levantando bases de datos (neo4j, postgres)..."
docker compose up -d neo4j postgres
wait_for_pg
wait_for_url "http://localhost:7474" "Neo4j"

# 2. Backends con node --watch
mkdir -p "$ROOT/logs"

start_backend auth-svc \
  PORT=4003 JWT_SECRET=devsecret NODE_ENV=development \
  POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360

start_backend tournaments-svc \
  PORT=4001 NODE_ENV=development \
  NEO4J_URI=bolt://localhost:7687 NEO4J_USERNAME=neo4j NEO4J_PASSWORD=password

start_backend teams-svc \
  PORT=4002 JWT_SECRET=devsecret NODE_ENV=development \
  POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360

start_backend inscriptions-svc \
  PORT=4004 JWT_SECRET=devsecret NODE_ENV=development \
  POSTGRES_URL=postgresql://liga:liga@localhost:55432/liga360 \
  TOURNAMENTS_GRAPHQL_URL=http://localhost:4000/graphql

# Gateway depende de tournaments-svc — le damos 2 segundos
sleep 2
# El gateway (Apollo IntrospectAndCompose) toma el schema del subgraph sólo AL ARRANCAR.
# Si tocás tournaments-svc/schema.graphql o resolvers nuevos, reiniciá el gateway tras levantar
# tournaments-svc: ./run_dev.sh --svc gateway   (o Ctrl+C run_dev.sh y ./run_dev.sh de nuevo).
start_backend gateway \
  PORT=4000 NODE_ENV=development \
  TOURNAMENTS_SUBGRAPH_URL=http://localhost:4001/graphql

# 3. Espera backends
wait_for_url "http://localhost:4001/health" "tournaments-svc (4001)"
wait_for_url "http://localhost:4002/health" "teams-svc (4002)"
wait_for_url "http://localhost:4003/health" "auth-svc (4003)"
wait_for_url "http://localhost:4004/health" "inscriptions-svc (4004)"
wait_for_url "http://localhost:4000/health" "gateway (4000)"

if [[ "$MODE" == "backend" ]]; then
  ok "Backends listos. Logs en ./logs/"
  ok "Para ver logs en vivo: tail -f logs/<nombre>.log"
  wait
  exit 0
fi

# 4. Frontend Vite en foreground (Ctrl+C para parar todo)
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "  Backends listos · Logs en ./logs/"
ok "  Guardá un .js de backend → node --watch lo reinicia"
ok "  Guardá un .tsx → Vite HMR, sin reload de página"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
npm run dev
