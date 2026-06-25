#!/usr/bin/env bash
# Ежедневный бэкап PostgreSQL (fuel-map в Docker)
# Использование: ./deploy/backup.sh
# Cron: 0 3 * * * /opt/fuel-map/deploy/backup.sh >> /var/log/fuel-map-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$PROJECT_DIR"

# Загрузить POSTGRES_* из .env
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-fuelmap}"
POSTGRES_DB="${POSTGRES_DB:-fuelmap}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT="$BACKUP_DIR/fuelmap_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Backup started → $OUTPUT"

docker compose $COMPOSE_FILES exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip > "$OUTPUT"

echo "[$(date -Iseconds)] Backup done ($(du -h "$OUTPUT" | cut -f1))"

# Удалить старые бэкапы
find "$BACKUP_DIR" -name 'fuelmap_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Iseconds)] Pruned backups older than ${RETENTION_DAYS} days"
