#!/usr/bin/env bash
# Force-apply price reports seed (e.g. when benzin-price.ru blocks VPS IP).
# Usage: bash deploy/apply-reports-seed.sh
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/fuel-map}"
cd "$PROJECT_DIR"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
SEED="deploy/reports-seed.sql.gz"

if [ ! -f "$SEED" ]; then
  echo "Missing $SEED"
  exit 1
fi

echo "Applying $SEED ..."
gunzip -c "$SEED" | $COMPOSE exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1 -c \
  "UPDATE reports SET created_at = NOW() WHERE price IS NOT NULL;"

PRICED=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc \
  "SELECT COUNT(*) FROM reports WHERE price IS NOT NULL AND created_at > NOW() - INTERVAL '7 days';")
MSK=$($COMPOSE exec -T db psql -U fuelmap -d fuelmap -tAc \
  "SELECT COUNT(DISTINCT r.station_id) FROM reports r
   JOIN stations s ON s.id = r.station_id
   WHERE r.price IS NOT NULL AND r.created_at > NOW() - INTERVAL '7 days'
     AND s.lat BETWEEN 55.4 AND 56.1 AND s.lng BETWEEN 37.2 AND 38.2;")

echo "Done. priced_7d=$PRICED moscow_stations_with_price=$MSK"
