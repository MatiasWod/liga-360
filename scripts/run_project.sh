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
  --frontend-only  Solo frontend container (docker compose).
  -h, --help       Muestra esta ayuda.

Notas:
  - Backend y frontend corren en Docker.
  - Frontend disponible en http://localhost:5173.
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

backend_services=(neo4j postgres auth-svc tournaments-svc teams-svc inscriptions-svc gateway)

if [[ "$FRONTEND_ONLY" != "true" ]]; then
  target_services=()
  if [[ "$BACKEND_ONLY" == "true" ]]; then
    target_services=("${backend_services[@]}")
  fi

  if [[ "$NO_BUILD" == "true" ]]; then
    echo "Levantando servicios Docker sin build..."
    if [[ "${#target_services[@]}" -gt 0 ]]; then
      docker compose up -d "${target_services[@]}"
    else
      docker compose up -d
    fi
  else
    echo "Levantando servicios Docker con build..."
    if [[ "${#target_services[@]}" -gt 0 ]]; then
      docker compose up -d --build "${target_services[@]}"
    else
      docker compose up -d --build
    fi
  fi

  if [[ "$BACKEND_ONLY" != "true" ]]; then
    echo "Esperando frontend container..."
    attempts=0
    until curl -fsS "http://localhost:5173" >/dev/null 2>&1; do
      attempts=$((attempts + 1))
      if [[ "$attempts" -ge 40 ]]; then
        echo "Warning: timeout esperando http://localhost:5173"
        break
      fi
      sleep 2
    done
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

if [[ "$FRONTEND_ONLY" == "true" ]]; then
  if [[ "$NO_BUILD" == "true" ]]; then
    docker compose up -d frontend
  else
    docker compose up -d --build frontend
  fi
  echo "Frontend container levantado en http://localhost:5173"
  exit 0
fi

echo "Proyecto levantado. Frontend: http://localhost:5173"

