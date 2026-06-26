#!/usr/bin/env bash
# fuel-map — экстренное восстановление карты (0 станций / 502 / port bind conflict).
# VNC: cd /opt/fuel-map && bash deploy/vnc-emergency-restore.sh
set -euo pipefail

cd /opt/fuel-map
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
TUNNEL_URL="${TUNNEL_URL:-https://announced-cap-romantic-committee.trycloudflare.com}"
API_HOST_PORTS=(3001 3002)

free_host_port() {
  local port=$1
  if ! ss -tlnp 2>/dev/null | grep -qE ":${port}\b"; then
    return 0
  fi
  echo "WARN: port ${port} in use — freeing..."
  # Stale fuel-map containers holding the port
  docker ps -a --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null \
    | grep -E ":${port}->" \
    | awk '{print $1}' \
    | xargs -r docker rm -f 2>/dev/null || true
  # Orphan / stopped containers with published port
  docker ps -a --filter "publish=${port}" -q 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  else
    pid=$(ss -tlnp 2>/dev/null | grep -E ":${port}\b" | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    if [ -n "${pid:-}" ]; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  sleep 1
  if ss -tlnp 2>/dev/null | grep -qE ":${port}\b"; then
    echo "FAIL: port ${port} still in use:"
    ss -tlnp | grep -E ":${port}\b" || true
    return 1
  fi
  echo "OK: port ${port} free"
}

echo "=== fuel-map emergency restore $(date -Is) ==="

echo "=== 0. Free stuck API host ports (3001 legacy, 3002 current) ==="
for p in "${API_HOST_PORTS[@]}"; do
  free_host_port "$p" || true
done

echo "=== 1. Docker status (before) ==="
${COMPOSE} ps 2>/dev/null || true
docker ps -a --filter "name=fuel-map" 2>/dev/null || true

echo "=== 2. Stop api, remove orphans ==="
${COMPOSE} stop api telegram-bot 2>/dev/null || true
${COMPOSE} rm -f api 2>/dev/null || true
${COMPOSE} down --remove-orphans 2>/dev/null || true

echo "=== 3. API logs (last 40 lines, if container exists) ==="
${COMPOSE} logs api --tail=40 2>/dev/null || true

echo "=== 4. Bring up full stack ==="
${COMPOSE} up -d --build db api nginx
${COMPOSE} --profile telegram up -d telegram-bot 2>/dev/null || true

echo "=== 5. Wait for health on :8090 ==="
for _ in $(seq 1 40); do
  if curl -sf --max-time 5 http://127.0.0.1:8090/api/health >/dev/null; then
    echo "health OK"
    break
  fi
  sleep 3
done
curl -sS http://127.0.0.1:8090/api/health || { echo "FAIL: nginx/api not responding on :8090"; exit 1; }

echo "=== 6. API direct on host :3002 (telegram-bot) ==="
curl -sf --max-time 5 http://127.0.0.1:3002/api/health && echo " api :3002 OK" || echo "WARN: api not on :3002 (check docker compose prod ports)"

echo "=== 7. Station count in DB ==="
STATIONS=$(${COMPOSE} exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;" 2>/dev/null || echo 0)
echo "stations=$STATIONS"
if [ "${STATIONS:-0}" -lt 1000 ]; then
  echo "WARN: low station count — run: bash deploy/vnc-restore-db.sh"
fi

echo "=== 8. Moscow bbox sample ==="
curl -sS "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,56.0" | head -c 500
echo ""

echo "=== 9. ALLOWED_ORIGINS + WEB_APP_URL (CORS) ==="
touch .env
grep -q '^ALLOWED_ORIGINS=' .env \
  && sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090,http://147.45.175.194:8090|" .env \
  || echo "ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090,http://147.45.175.194:8090" >> .env
grep -q '^WEB_APP_URL=' .env \
  && sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env \
  || echo "WEB_APP_URL=${TUNNEL_URL}" >> .env
${COMPOSE} up -d api nginx
${COMPOSE} --profile telegram up -d telegram-bot 2>/dev/null || true

echo "=== 10. Cloudflare tunnel ==="
if systemctl is-active cloudflared-quick >/dev/null 2>&1; then
  systemctl restart cloudflared-quick
  sleep 5
  NEW_URL=$(journalctl -u cloudflared-quick -n 50 --no-pager 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
  if [ -n "$NEW_URL" ] && [ "$NEW_URL" != "$TUNNEL_URL" ]; then
    echo "WARN: tunnel URL changed to $NEW_URL — update .env and restart api"
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${NEW_URL},http://127.0.0.1:8090|" .env
    sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${NEW_URL}|" .env
    ${COMPOSE} up -d api
    TUNNEL_URL="$NEW_URL"
  fi
else
  echo "cloudflared-quick not installed — run: bash deploy/vnc-free-public-url.sh"
fi

echo "=== 11. Public check ==="
curl -sf --max-time 20 "${TUNNEL_URL}/api/health" && echo " public OK" || echo "WARN: public URL still failing — check journalctl -u cloudflared-quick"

echo ""
echo "DONE. stations=$STATIONS tunnel=${TUNNEL_URL}"
echo "Open: ${TUNNEL_URL}"
