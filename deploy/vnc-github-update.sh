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
PRICED=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports WHERE price IS NOT NULL AND created_at > NOW() - INTERVAL '7 days';" 2>/dev/null || echo 0)
LINKS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM benzin_station_links;" 2>/dev/null || echo 0)
echo "Before seed: stations=$STATIONS reports=$REPORTS priced_7d=$PRICED benzin_links=$LINKS"

if [ "${STATIONS:-0}" -lt 1000 ] && [ -f deploy/fuelmap-backup.sql.gz ]; then
  echo "Restoring full DB from deploy/fuelmap-backup.sql.gz ..."
  bash deploy/vnc-restore-db.sh
fi

if [ -f deploy/reports-seed.sql.gz ] && [ "${PRICED:-0}" -lt 100 ]; then
  echo "Applying deploy/reports-seed.sql.gz (priced reports in last 7d: ${PRICED:-0}) ..."
  gunzip -c deploy/reports-seed.sql.gz | $COMPOSE exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1
  $COMPOSE exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1 -c \
    "UPDATE reports SET created_at = NOW() WHERE price IS NOT NULL;"
  REPORTS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports;")
  PRICED=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports WHERE price IS NOT NULL AND created_at > NOW() - INTERVAL '7 days';")
  echo "Reports after seed: total=$REPORTS priced_7d=$PRICED"
fi

# Benzin-price import (Docker Playwright → reports in DB → map)
if [ "${RUN_BENZIN_IMPORT:-0}" = "1" ]; then
  echo "Running benzin-price import (foreground)..."
  bash deploy/run-benzin-import.sh
elif [ "${LINKS:-0}" -eq 0 ] && [ "${AUTO_BENZIN_IMPORT:-1}" = "1" ]; then
  echo "No benzin_station_links yet — starting background import (~1–2 h)..."
  echo "Log: tail -f /var/log/fuel-map-import.log"
  nohup bash deploy/run-benzin-import.sh >> /var/log/fuel-map-import.log 2>&1 &
fi

for _ in $(seq 1 30); do
  curl -sf --max-time 5 http://127.0.0.1:8090/api/health && break
  sleep 3
done
curl -sS http://127.0.0.1:8090/api/health || true
REPORTS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports;")
PRICED=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM reports WHERE price IS NOT NULL AND created_at > NOW() - INTERVAL '7 days';")
STATIONS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;")
LINKS=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM benzin_station_links;" 2>/dev/null || echo 0)
echo "Done. stations=$STATIONS reports=$REPORTS priced_7d=$PRICED benzin_links=$LINKS"
echo "Open: http://147.45.175.194:8090"

if [ "${INSTALL_PRICE_CRON:-1}" = "1" ]; then
  bash deploy/install-price-import-cron.sh
fi
