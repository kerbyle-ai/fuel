# Fuel Map — deploy in ~10 minutes (VNC + GitHub)

**Blocked today:** Timeweb panel file manager missing; `wget` from catbox → 0 bytes / SSL errors.

**Use this path:** GitHub push from PC (2 min) → `git clone` on VPS (5 min) → Docker up (3 min).

---

## Step 0 — VPS (optional, 30 sec)

In Timeweb VNC console as **root**, confirm GitHub is reachable:

```bash
curl -fsSIL --max-time 15 https://github.com | head -3
```

If you see `HTTP/2 200` or `301`, continue. If not, run full tests in `deploy/VNC-CURL-TESTS.md` or skip to `VNC-PASTE-CHUNKS.md`.

---

## Step 1 — Windows PowerShell (~2 min, while VNC is open)

`gh` is installed but **not logged in**. In a **new** PowerShell window:

```powershell
cd C:\Users\user\.cursor\fuel-map
$gh = "C:\Program Files\GitHub CLI\gh.exe"

& $gh auth login
# GitHub.com → HTTPS → Login with a web browser → copy one-time code → authorize

& $gh auth status
$USER = & $gh api user --jq .login
Write-Host "GitHub user: $USER"

# Public repo = clone on VPS without token (fastest for VNC-only)
& $gh repo create fuel-map --public --source=. --remote=origin --push
```

If `repo create` says the repo exists: `git remote add origin https://github.com/$USER/fuel-map.git` then `git push -u origin master`.

Note your username: **`$USER`** (from command above).

---

## Step 2 — VNC paste (replace YOUR_GITHUB_USER)

```bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git ca-certificates

mkdir -p /opt/fuel-map
cd /opt/fuel-map
git clone https://github.com/YOUR_GITHUB_USER/fuel-map.git .

if [ ! -f .env ]; then
  cp deploy/.env.production.example .env
  DB_PASS="$(openssl rand -base64 24)"
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env
  sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194:8090|' .env
  sed -i 's|DOMAIN=.*|DOMAIN=147.45.175.194|' .env
  sed -i 's|WEB_APP_URL=.*|WEB_APP_URL=http://147.45.175.194:8090|' .env
  sed -i 's|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=PASTE_FROM_LOCAL_DOT_ENV|' .env
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl -sS --max-time 120 http://127.0.0.1:8090/api/health || true
```

Browser: **http://147.45.175.194:8090**

Full details: `deploy/VNC-GITHUB-DEPLOY.md`.

---

## If GitHub push is impossible

1. **Base64 via VNC** — 74 paste blocks (~40 min): `deploy/VNC-PASTE-CHUNKS.md`, files in `deploy/vnc-chunks/`.
2. **When SSH works** (mobile hotspot / FW fix): upload `fuel-map-deploy.tgz` with WinSCP/FileZilla to `/opt/` — SFTP is port **22**, same as SSH; Timeweb has no separate “file manager” upload for cloud VPS disks (only snapshots/backups API).
3. **Recovery mode** — Timeweb → server → Recovery → mount root FS → `chroot` → fix `sshd`/network, then use SFTP or `git clone` from a normal boot.
