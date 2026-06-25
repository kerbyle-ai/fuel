# VNC deploy — fuel-map (/opt/fuel-map)

Generated: 2026-06-26

## Artifacts (local Windows)

| File | Path | Size |
|------|------|------|
| `fuel-map-deploy.tgz` | `c:\Users\user\.cursor\fuel-map\fuel-map-deploy.tgz` | ~2.2 MB |
| `fuelmap-backup.sql.gz` | `c:\Users\user\.cursor\fuel-map\fuelmap-backup.sql.gz` | ~1.1 MB |

Upload host: **litterbox** (transfer.sh unreachable; 0x0.st uploads disabled).

## Download URL

```text
https://litter.catbox.moe/nnrps2.tgz
```

```bash
wget -O /tmp/fuel-map-deploy.tgz 'https://litter.catbox.moe/nnrps2.tgz'
```

## VNC paste block (full bootstrap)

Paste into Timeweb VNC console as root:

```bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

mkdir -p /opt/fuel-map
wget -O /tmp/fuel-map-deploy.tgz 'https://litter.catbox.moe/nnrps2.tgz'
tar -xzf /tmp/fuel-map-deploy.tgz -C /opt/fuel-map
cd /opt/fuel-map

cat > .env <<'ENVEOF'
POSTGRES_PASSWORD=fuelmap_secret
TELEGRAM_BOT_TOKEN=8603471436:AAFLn9ShGsrO9XVIv9i0aXHXN1EVmVEAclw
ENVEOF

# Merge with production example if other keys missing
if [ -f deploy/.env.production.example ]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    [ -z "$key" ] || [[ "$key" =~ ^# ]] && continue
    grep -q "^${key}=" .env 2>/dev/null || echo "$line" >> .env
  done < deploy/.env.production.example
fi

sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194:8090|' .env 2>/dev/null || true

ufw allow 22/tcp 2>/dev/null || true
ufw allow 8090/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true

docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

for i in $(seq 1 60); do
  if curl -sf --max-time 5 http://127.0.0.1:8090/api/health >/dev/null; then
    curl -sS http://127.0.0.1:8090/api/health
    echo
    break
  fi
  sleep 10
done

echo "DONE: http://147.45.175.194:8090"
```

## Optional DB restore

If `fuelmap-backup.sql.gz` is on the server at `/tmp/fuelmap-backup.sql.gz`:

```bash
cd /opt/fuel-map
gunzip -c /tmp/fuelmap-backup.sql.gz | docker compose exec -T db psql -U fuelmap -d fuelmap
```

## Notes

- Litterbox link expires in **72h** (upload time 2026-06-26).
- Re-upload: `curl.exe -F "reqtype=fileupload" -F "time=72h" -F "fileToUpload=@fuel-map-deploy.tgz" https://litterbox.catbox.moe/resources/internals/api.php`
