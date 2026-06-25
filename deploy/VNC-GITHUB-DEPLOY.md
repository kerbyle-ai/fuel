# Fuel Map — deploy on VPS via GitHub (VNC console)

**VPS:** `147.45.175.194`  
**App dir:** `/opt/fuel-map` (empty before first deploy)  
**Prerequisites on VPS:** Docker + Docker Compose plugin (already installed)

---

## 1. Push from Windows (one-time)

GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe`. If not logged in:

```powershell
cd C:\Users\user\.cursor\fuel-map
& "C:\Program Files\GitHub CLI\gh.exe" auth login
# Choose: GitHub.com → HTTPS → Login with browser (or paste PAT)
& "C:\Program Files\GitHub CLI\gh.exe" auth status
$USER = & "C:\Program Files\GitHub CLI\gh.exe" api user --jq .login
& "C:\Program Files\GitHub CLI\gh.exe" repo create fuel-map --private --source=. --remote=origin --push
```

After push, repo URL: `https://github.com/<YOUR_USER>/fuel-map`

**Alternative repo name:** `toplivo-map` — replace `fuel-map` in commands above.

`.env` is **not** in git (see `.gitignore`). Only `.env.example` and `deploy/.env.production.example` are committed.

---

## 2. Private repo: clone on VPS

Pick **one** method:

### A) Fine-grained PAT (simplest for VNC)

1. GitHub → **Settings → Developer settings → Fine-grained tokens** → generate with **Contents: Read** on this repo.
2. On VPS (paste token when prompted):

```bash
cd /opt/fuel-map
git clone https://github.com/YOUR_USER/fuel-map.git .
```

Username: your GitHub login; password: the PAT (not your GitHub password).

### B) Deploy key (read-only, no PAT on server)

On VPS:

```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/fuel-map-deploy -C "fuel-map-vps"
cat /root/.ssh/fuel-map-deploy.pub
```

GitHub → repo → **Settings → Deploy keys → Add** (read-only). Then:

```bash
cd /opt/fuel-map
GIT_SSH_COMMAND='ssh -i /root/.ssh/fuel-map-deploy -o IdentitiesOnly=yes' \
  git clone git@github.com:YOUR_USER/fuel-map.git .
```

### C) Temporary public repo

Make the repo **public** in GitHub settings, clone without auth, then set back to **private** after deploy.

---

## 3. VNC paste block (production)

Replace `YOUR_USER`, domain/email, and paste **TELEGRAM_BOT_TOKEN** from your local `fuel-map\.env` (same value as on your PC — do not commit it to git).

```bash
set -euo pipefail
cd /opt/fuel-map

if [ ! -d .git ]; then
  git clone https://github.com/YOUR_USER/fuel-map.git .
else
  git pull --ff-only
fi

if [ ! -f .env ]; then
  cp deploy/.env.production.example .env
  DB_PASS="$(openssl rand -base64 24)"
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env
  sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194:8090|' .env
  sed -i 's|DOMAIN=.*|DOMAIN=147.45.175.194|' .env
  sed -i 's|WEB_APP_URL=.*|WEB_APP_URL=http://147.45.175.194:8090|' .env
  # Paste token from local .env (BotFather):
  sed -i 's|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE|' .env
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

for i in $(seq 1 30); do
  if curl -sf --max-time 5 http://127.0.0.1:8090/api/health; then
    echo OK
    break
  fi
  sleep 10
done
curl -sS http://127.0.0.1:8090/api/health || true
```

Open in browser: **http://147.45.175.194:8090**

### Telegram bot (optional, systemd)

After containers are healthy:

```bash
cd /opt/fuel-map/telegram-bot
npm ci
npm run build
cp /opt/fuel-map/deploy/fuel-map-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now fuel-map-bot
systemctl status fuel-map-bot --no-pager
```

---

## 4. Updates

```bash
cd /opt/fuel-map
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 5. Troubleshooting

| Issue | Action |
|-------|--------|
| `git clone` 403 / auth | Use PAT, deploy key, or temporary public repo |
| PostGIS pull timeout | Set `POSTGIS_IMAGE=docker.m.daocloud.io/postgis/postgis:16-3.4` in `.env` |
| Port 8090 closed | `ufw allow 8090/tcp` (see `deploy/vnc-one-shot.sh`) |
