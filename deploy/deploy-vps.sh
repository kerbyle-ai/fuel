#!/bin/bash
# Deploy fuel-map to VPS. Run from WSL in project root.
# Usage: SSHPASS='your-password' ./deploy/deploy-vps.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-root@147.45.175.194}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/fuel-map}"
TARBALL="/tmp/fuel-map-deploy.tar.gz"

if [[ -z "${SSHPASS:-}" ]]; then
  echo "Set SSHPASS env var with root password, e.g.: SSHPASS='...' $0"
  exit 1
fi

echo "==> Building tarball..."
tar --exclude=node_modules --exclude=frontend/node_modules --exclude=backend/node_modules \
  --exclude=scripts/node_modules --exclude=.git --exclude=frontend/dist \
  -czf "$TARBALL" -C "$(dirname "$0")/.." .

echo "==> Uploading..."
sshpass -e scp -o StrictHostKeyChecking=no "$TARBALL" "$HOST:/tmp/fuel-map-deploy.tar.gz"
if [[ -f fuelmap-backup.sql.gz ]]; then
  sshpass -e scp -o StrictHostKeyChecking=no fuelmap-backup.sql.gz "$HOST:/tmp/"
fi

echo "==> Deploying on server..."
sshpass -e ssh -o StrictHostKeyChecking=no "$HOST" bash -s <<'REMOTE'
set -euo pipefail
mkdir -p /opt/fuel-map
tar -xzf /tmp/fuel-map-deploy.tar.gz -C /opt/fuel-map
cd /opt/fuel-map

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if [[ ! -f .env ]]; then
  cp deploy/.env.production.example .env
  sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194,http://147.45.175.194:8090|' .env
  sed -i 's|WEB_APP_URL=.*|WEB_APP_URL=http://147.45.175.194|' .env
  sed -i 's|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD='"$(openssl rand -base64 24)"'|' .env
fi

ufw allow 8090/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

if [[ -f /tmp/fuelmap-backup.sql.gz ]]; then
  STATIONS=$(docker compose exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;" 2>/dev/null || echo 0)
  if [[ "${STATIONS:-0}" -lt 100 ]]; then
    echo "Restoring DB from backup..."
    gunzip -c /tmp/fuelmap-backup.sql.gz | docker compose exec -T db psql -U fuelmap -d fuelmap
  fi
fi

curl -sf http://127.0.0.1/api/health && echo " OK :80"
curl -sf http://127.0.0.1:8090/api/health && echo " OK :8090"
REMOTE

echo "==> External check..."
curl -sf --connect-timeout 15 "http://147.45.175.194/api/health" && echo " Public OK :80"
curl -sf --connect-timeout 15 "http://147.45.175.194:8090/api/health" && echo " Public OK :8090"
