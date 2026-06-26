#!/bin/bash
# fuel-map — fix Telegram bot map URL (Keyboard.url, no BotFather domain).
# VNC Timeweb: cd /opt/fuel-map && bash deploy/vnc-fix-bot-url.sh
set -euo pipefail

TUNNEL_URL="${TUNNEL_URL:-https://announced-cap-romantic-committee.trycloudflare.com}"
cd /opt/fuel-map

echo "=== fuel-map bot URL fix $(date -Is) ==="
echo "TUNNEL_URL=${TUNNEL_URL}"

echo "=== 1. Update WEB_APP_URL in .env ==="
touch .env
grep -q '^WEB_APP_URL=' .env \
  && sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env \
  || echo "WEB_APP_URL=${TUNNEL_URL}" >> .env
grep '^WEB_APP_URL=' .env

echo "=== 2. git pull ==="
git pull

echo "=== 3. Rebuild telegram-bot + api ==="
docker compose --profile telegram up -d --build telegram-bot api --force-recreate

echo "=== 4. WEB_APP_URL from bot logs ==="
sleep 3
docker compose logs telegram-bot --tail=30 2>/dev/null | grep -E 'WEB_APP_URL=' || \
  docker compose --profile telegram logs telegram-bot --tail=30 2>/dev/null | grep -E 'WEB_APP_URL=' || \
  echo "WARN: grep WEB_APP_URL in logs manually: docker compose logs telegram-bot --tail=50"

echo ""
echo "ГОТОВО. «Открыть карту» открывает ${TUNNEL_URL} в браузере (Keyboard.url, без BotFather)."
