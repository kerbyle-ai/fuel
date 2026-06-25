# Fuel Map - VNC deploy (Timeweb)

> **2026-06-26:** Catbox `wget` often fails on this VPS (0 bytes / SSL). Prefer **GitHub**: see `deploy/VNC-10MIN-PATH.md` (fast) or `deploy/VNC-GITHUB-DEPLOY.md` (full). Fallback: `deploy/VNC-PASTE-CHUNKS.md` (74 VNC pastes).
# Fuel Map — VNC deploy (Timeweb)

**Tarball:** `fuel-map-deploy.tgz` (~2.2 MB, no `node_modules`, includes `fuelmap-backup.sql.gz`)

**Public wget URL (verified upload 2026-06-26):**

```text
https://files.catbox.moe/2yny7r.tgz
```

Mirror note: catbox links are direct downloads; use `wget -O fuel-map-deploy.tgz 'https://files.catbox.moe/2yny7r.tgz'`.

---

## One-shot paste (VNC console)

Run as **root** on the VPS (`147.45.175.194`).

```bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# App tree (tarball root is fuel-map/)
mkdir -p /opt
cd /opt
wget -O fuel-map-deploy.tgz 'https://files.catbox.moe/2yny7r.tgz'
tar -xzf fuel-map-deploy.tgz
cd /opt/fuel-map

# Production .env (values from local .env — rotate POSTGRES_PASSWORD in production if needed)
cat > .env << 'ENVEOF'
POSTGRES_USER=fuelmap
POSTGRES_PASSWORD=fuelmap_secret
POSTGRES_DB=fuelmap
POSTGRES_PORT=5432

DATABASE_URL=postgresql://fuelmap:fuelmap_secret@db:5432/fuelmap
API_PORT=3001
NODE_ENV=production
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=3600000
DUPLICATE_REPORT_WINDOW_MS=900000

TELEGRAM_BOT_TOKEN=8603471436:AAFLn9ShGsrO9XVIv9i0aXHXN1EVmVEAclw
API_URL=http://api:3001/api
WEB_APP_URL=http://147.45.175.194:8090
TELEGRAM_NOTIFY_CHANNEL_ID=-1004414970849

NGINX_PORT=8090
VITE_API_URL=/api
VITE_DONATION_URL=https://boosty.to/toplivo

DB_HOST=db
DB_PORT=5432
DB_WAIT_RETRIES=30
DB_WAIT_INTERVAL=2

ALLOWED_ORIGINS=http://147.45.175.194:8090
ENVEOF

# Firewall (optional test port)
ufw allow 8090/tcp 2>/dev/null || true
ufw allow 22/tcp 2>/dev/null || true

# Start stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for DB
for i in $(seq 1 30); do
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db pg_isready -U fuelmap -d fuelmap && break
  sleep 2
done

# Restore backup if present in tree
if [ -f fuelmap-backup.sql.gz ]; then
  echo "Restoring fuelmap-backup.sql.gz ..."
  gunzip -c fuelmap-backup.sql.gz | docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap
fi

# Optional: Telegram bot profile
# docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile telegram up -d --build

# Health
for i in $(seq 1 30); do
  curl -sf --max-time 5 http://127.0.0.1:8090/api/health && break
  sleep 5
done
curl -sS http://127.0.0.1:8090/api/health || true
echo "Open: http://147.45.175.194:8090"
```

---

## Manual upload fallback (Timeweb file manager)

If `wget` fails from the server:

1. Upload local `c:\Users\user\.cursor\fuel-map\fuel-map-deploy.tgz` to `/opt/fuel-map-deploy.tgz` via Timeweb panel.
2. On VNC:

```bash
mkdir -p /opt && cd /opt
mv /opt/fuel-map-deploy.tgz ./fuel-map-deploy.tgz 2>/dev/null || true
tar -xzf fuel-map-deploy.tgz
cd fuel-map
# then create .env (block above) and docker compose up
```

---

## Local tarball rebuild (Windows)

```powershell
cd $env:USERPROFILE\.cursor
tar --exclude="fuel-map/node_modules" --exclude="fuel-map/**/node_modules" --exclude="fuel-map/.git" --exclude="fuel-map/fuel-map-deploy.tgz" -czf fuel-map\fuel-map-deploy.tgz fuel-map
```

Re-upload with:

```powershell
curl.exe --ssl-no-revoke -F "reqtype=fileupload" -F "fileToUpload=@$env:USERPROFILE\.cursor\fuel-map\fuel-map-deploy.tgz" https://catbox.moe/user/api.php
```

---

## Upload attempts log

| Service      | Result        |
|-------------|---------------|
| 0x0.st      | 503           |
| transfer.sh | connect fail  |
| litterbox   | 404           |
| file.io     | reset           |
| **catbox**  | **OK** → `https://files.catbox.moe/2yny7r.tgz` |
