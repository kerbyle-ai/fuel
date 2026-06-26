#!/usr/bin/env bash
# Update production from GitHub + apply price reports seed.
# VNC: cd /opt/fuel-map && bash deploy/vnc-github-update.sh
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
PROJECT_DIR="${PROJECT_DIR:-/opt/fuel-map}"
REPO_URL="${REPO_URL:-https://github.com/kerbyle-ai/fuel.git}"

cd "$PROJECT_DIR"

echo "=== fuel-map GitHub update $(date -Is) ==="

if [ ! -d .git ]; then
  git clone "$REPO_URL" .
else
  git fetch origin
  git pull --ff-only origin main
fi

$COMPOSE up -d --build

echo "Waiting for DB..."
for _ in $(seq 1 30); do
  $COMPOSE exec -T db pg_isready -U "${POSTGRES_USER:-fuelmap}" -d "${POSTGRES_DB:-fuelmap}" && break
  sleep 2
done

STATIONS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;" 2>/dev/null || echo 0)
REPORTS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports;" 2>/dev/null || echo 0)
echo "Before seed: stations=$STATIONS reports=$REPORTS"

if [ "${STATIONS:-0}" -lt 1000 ] && [ -f deploy/fuelmap-backup.sql.gz ]; then
  echo "Restoring full DB from deploy/fuelmap-backup.sql.gz ..."
  bash deploy/vnc-restore-db.sh
fi

if [ -f deploy/reports-seed.sql.gz ] && [ "${REPORTS:-0}" -lt 500 ]; then
  echo "Applying deploy/reports-seed.sql.gz ..."
  gunzip -c deploy/reports-seed.sql.gz | $COMPOSE exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1
  REPORTS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports;")
  echo "Reports after seed: $REPORTS"
fi

# Optional: refresh prices from web (Docker importer)
if [ "${RUN_BENZIN_IMPORT:-0}" = "1" ]; then
  echo "Running benzin-price import (Docker)..."
  bash deploy/run-benzin-import.sh
fi

for _ in $(seq 1 30); do
  curl -sf --max-time 5 http://127.0.0.1:8090/api/health && break
  sleep 3
done
curl -sS http://127.0.0.1:8090/api/health || true
REPORTS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports;")
STATIONS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;")
echo "Done. stations=$STATIONS reports=$REPORTS"
echo "Open: http://147.45.175.194:8090"

if [ "${INSTALL_PRICE_CRON:-1}" = "1" ]; then
  bash deploy/install-price-import-cron.sh
fi
