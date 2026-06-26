#!/usr/bin/env bash
# Restore ~25k Russia fuel stations from fuelmap-backup.sql.gz (VNC / SSH on VPS).
# Run as root: cd /opt/fuel-map && bash deploy/vnc-restore-db.sh
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
PROJECT_DIR="${PROJECT_DIR:-/opt/fuel-map}"
BACKUP="${BACKUP:-$PROJECT_DIR/fuelmap-backup.sql.gz}"
CATBOX_TGZ="${CATBOX_TGZ:-https://files.catbox.moe/2yny7r.tgz}"

cd "$PROJECT_DIR"

count_stations() {
  $COMPOSE exec -T db psql -U "${POSTGRES_USER:-fuelmap}" -d "${POSTGRES_DB:-fuelmap}" -tAc \
    "SELECT COUNT(*) FROM stations;" 2>/dev/null || echo 0
}

ensure_backup() {
  if [[ -f "$BACKUP" ]]; then
    echo "Using backup: $BACKUP ($(du -h "$BACKUP" | cut -f1))"
    return 0
  fi

  echo "Backup not found at $BACKUP — trying deploy tarball..."
  local tmp
  tmp="$(mktemp -d)"
  if wget -q -O "$tmp/fuel-map-deploy.tgz" "$CATBOX_TGZ" && [[ -s "$tmp/fuel-map-deploy.tgz" ]]; then
    tar -xzf "$tmp/fuel-map-deploy.tgz" -C "$tmp" fuel-map/fuelmap-backup.sql.gz
    cp "$tmp/fuel-map/fuelmap-backup.sql.gz" "$BACKUP"
    echo "Extracted backup from catbox tarball → $BACKUP"
    rm -rf "$tmp"
    return 0
  fi
  rm -rf "$tmp"

  echo "ERROR: fuelmap-backup.sql.gz missing."
  echo "  Upload fuel-map-deploy.tgz to /opt/ and extract, or place fuelmap-backup.sql.gz in $PROJECT_DIR"
  exit 1
}

echo "=== fuel-map DB restore $(date -Is) ==="

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 30); do
  $COMPOSE exec -T db pg_isready -U "${POSTGRES_USER:-fuelmap}" -d "${POSTGRES_DB:-fuelmap}" && break
  sleep 2
done

BEFORE="$(count_stations)"
echo "Stations before restore: $BEFORE"

ensure_backup

echo "Restoring (this may take 1–3 minutes)..."
gunzip -c "$BACKUP" | $COMPOSE exec -T db psql -U "${POSTGRES_USER:-fuelmap}" -d "${POSTGRES_DB:-fuelmap}" -v ON_ERROR_STOP=1

AFTER="$(count_stations)"
echo "Stations after restore: $AFTER"

if [[ "${AFTER:-0}" -lt 1000 ]]; then
  echo "WARN: expected ~25,000 stations; restore may have failed."
  exit 1
fi

echo "Verifying API..."
curl -sf --max-time 10 "http://127.0.0.1:8090/api/health" && echo " health OK"
curl -sf --max-time 15 \
  "http://127.0.0.1:8090/api/stations/nearby?lat=55.75&lng=37.62&radius=50000" \
  | head -c 200 || true
echo ""
echo "Done. Open http://147.45.175.194:8090 (Moscow should show many markers; all Russia after zoom/pan)."
