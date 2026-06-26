#!/usr/bin/env bash
# fuel-map — экстренное восстановление карты (0 станций / 502 на туннеле).
# VNC: cd /opt/fuel-map && bash deploy/vnc-emergency-restore.sh
set -euo pipefail

cd /opt/fuel-map
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
TUNNEL_URL="${TUNNEL_URL:-https://announced-cap-romantic-committee.trycloudflare.com}"

echo "=== fuel-map emergency restore $(date -Is) ==="

echo "=== 1. Docker status ==="
${COMPOSE} ps

echo "=== 2. API logs (last 80 lines) ==="
${COMPOSE} logs api --tail=80 2>/dev/null || true

echo "=== 3. Restart stack (api + nginx + db) ==="
${COMPOSE} up -d --build db api nginx

echo "=== 4. Wait for health on :8090 ==="
for _ in $(seq 1 40); do
  if curl -sf --max-time 5 http://127.0.0.1:8090/api/health >/dev/null; then
    echo "health OK"
    break
  fi
  sleep 3
done
curl -sS http://127.0.0.1:8090/api/health || { echo "FAIL: nginx/api not responding on :8090"; exit 1; }

echo "=== 5. Station count in DB ==="
STATIONS=$(${COMPOSE} exec -T db psql -U fuelmap -d fuelmap -tAc "SELECT COUNT(*) FROM stations;" 2>/dev/null || echo 0)
echo "stations=$STATIONS"
if [ "${STATIONS:-0}" -lt 1000 ]; then
  echo "WARN: low station count — run: bash deploy/vnc-restore-db.sh"
fi

echo "=== 6. Moscow bbox sample ==="
curl -sS "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,56.0" | head -c 500
echo ""

echo "=== 7. ALLOWED_ORIGINS + WEB_APP_URL (CORS) ==="
touch .env
grep -q '^ALLOWED_ORIGINS=' .env \
  && sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090,http://147.45.175.194:8090|" .env \
  || echo "ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090,http://147.45.175.194:8090" >> .env
grep -q '^WEB_APP_URL=' .env \
  && sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env \
  || echo "WEB_APP_URL=${TUNNEL_URL}" >> .env
${COMPOSE} up -d api nginx

echo "=== 8. Cloudflare tunnel ==="
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

echo "=== 9. Public check ==="
curl -sf --max-time 20 "${TUNNEL_URL}/api/health" && echo " public OK" || echo "WARN: public URL still failing — check journalctl -u cloudflared-quick"

echo ""
echo "DONE. stations=$STATIONS tunnel=${TUNNEL_URL}"
echo "Open: ${TUNNEL_URL}"
