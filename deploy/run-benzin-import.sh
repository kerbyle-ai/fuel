#!/usr/bin/env bash
# Run benzin-price import inside Docker (DB via internal network).
# Cron: every 2h — see deploy/install-price-import-cron.sh
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/fuel-map}"
LOG_DIR="${LOG_DIR:-/var/log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/fuel-map-import.lock}"

cd "$PROJECT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

mkdir -p "$(dirname "$LOCK_FILE")" "$LOG_DIR"

exec flock -n "$LOCK_FILE" bash -c "
  echo \"=== benzin import \$(date -Is) ===\"
  $COMPOSE --profile importer run --rm --no-TTY price-importer
  echo \"=== done \$(date -Is) ===\"
"
