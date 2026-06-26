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

echo "=== 3. Telegram API reachability (bot uses host network) ==="
if ! wget -qO- --timeout=8 https://api.telegram.org >/dev/null 2>&1; then
  echo "WARN: host cannot reach api.telegram.org — check Timeweb firewall outbound 443"
else
  echo "OK: host reaches api.telegram.org"
fi

echo "=== 4. Rebuild api + telegram-bot ==="
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
${COMPOSE} up -d api
${COMPOSE} --profile telegram up -d --build telegram-bot --force-recreate

echo "=== 5. Bot logs (need: Bot is polling for updates) ==="
sleep 5
${COMPOSE} --profile telegram logs telegram-bot --tail=40 2>/dev/null | grep -E 'API_URL=|WEB_APP_URL=|polling|getMe failed|Menu button' || true

echo ""
echo "ГОТОВО. В Telegram: удалите чат с ботом → /start → «Открыть карту»."
echo "Бот в host network — тест wget из контейнера не нужен. Menu Button: @BotFather → ${TUNNEL_URL}"
