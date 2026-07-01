#!/usr/bin/env bash
# Quick check: how many priced stations in Moscow bbox per fuel type
set -euo pipefail
cd "${PROJECT_DIR:-/opt/fuel-map}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "=== Moscow bbox (55.5-56.0, 37.3-37.9) priced stations by fuel ==="
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c "
SELECT ft.code,
       COUNT(DISTINCT r.station_id) AS stations_with_price,
       COUNT(*) AS report_rows
FROM reports r
JOIN stations s ON s.id = r.station_id
JOIN fuel_types ft ON ft.id = r.fuel_type_id
WHERE r.price IS NOT NULL
  AND r.created_at > NOW() - INTERVAL '7 days'
  AND s.lat BETWEEN 55.5 AND 56.0
  AND s.lng BETWEEN 37.3 AND 37.9
GROUP BY ft.code
ORDER BY ft.code;
"

echo ""
echo "=== API test (ai95, hide without fuel) ==="
curl -sS "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,56.0&fuel_types=ai95&hide_without_fuel=true" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('api_stations', len(d.get('stations',[])))"
