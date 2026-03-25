#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NO_BUILD="false"
BACKEND_ONLY="false"
FRONTEND_ONLY="false"

for arg in "$@"; do
  case "$arg" in
    --no-build)
      NO_BUILD="true"
      ;;
    --backend-only)
      BACKEND_ONLY="true"
      ;;
    --frontend-only)
      FRONTEND_ONLY="true"
      ;;
    -h|--help)
      cat <<'EOF'
Uso:
  ./run_project.sh [opciones]

Opciones:
  --no-build       Levanta Docker sin --build.
  --backend-only   Solo backend (docker compose).
  --frontend-only  Solo frontend (npm run dev).
  -h, --help       Muestra esta ayuda.

Notas:
  - Backend: Docker Compose en segundo plano.
  - Frontend: Vite en primer plano (bloquea la terminal).
EOF
      exit 0
      ;;
    *)
      echo "Opción no reconocida: $arg"
      echo "Ejecutá ./run_project.sh --help para ver opciones."
      exit 1
      ;;
  esac
done

if [[ "$BACKEND_ONLY" == "true" && "$FRONTEND_ONLY" == "true" ]]; then
  echo "No se puede usar --backend-only y --frontend-only juntos."
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Error: docker no está instalado."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm no está instalado."; exit 1; }

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  if [[ "$NO_BUILD" == "true" ]]; then
    echo "Levantando backend sin build..."
    docker compose up -d
  else
    echo "Levantando backend con build..."
    docker compose up -d --build
  fi

  echo "Esperando healthchecks backend..."
  for url in \
    "http://localhost:4000/health" \
    "http://localhost:4001/health" \
    "http://localhost:4002/health" \
    "http://localhost:4003/health" \
    "http://localhost:4004/health"
  do
    attempts=0
    until curl -fsS "$url" >/dev/null 2>&1; do
      attempts=$((attempts + 1))
      if [[ "$attempts" -ge 40 ]]; then
        echo "Warning: timeout esperando $url"
        break
      fi
      sleep 2
    done
  done
  echo "Backend listo."
fi

if [[ "$BACKEND_ONLY" == "true" ]]; then
  echo "Modo backend-only finalizado."
  exit 0
fi

if [[ ! -d node_modules ]]; then
  echo "Instalando dependencias frontend..."
  npm install
fi

echo "Levantando frontend en http://localhost:5173 ..."
npm run dev

