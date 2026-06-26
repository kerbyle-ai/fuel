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

echo "=== 3. Docker outbound (host curl OK, container ETIMEDOUT) ==="
if ! ${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml} --profile telegram exec -T telegram-bot wget -qO- --timeout=8 https://api.telegram.org >/dev/null 2>&1; then
  echo "Container cannot reach api.telegram.org — adding DOCKER-USER ACCEPT rule"
  iptables -C DOCKER-USER -j ACCEPT 2>/dev/null || iptables -I DOCKER-USER -j ACCEPT
fi

echo "=== 4. Rebuild telegram-bot ==="
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
${COMPOSE} --profile telegram up -d --build telegram-bot --force-recreate

echo "=== 5. Bot logs (need: Bot is polling for updates) ==="
sleep 5
${COMPOSE} --profile telegram logs telegram-bot --tail=40 2>/dev/null | grep -E 'WEB_APP_URL=|polling|getMe failed|Menu button' || true

echo ""
echo "ГОТОВО. В Telegram: удалите чат с ботом → /start → «Открыть карту»."
echo "Если getMe ETIMEDOUT: Timeweb firewall → исходящий 443. Menu Button: @BotFather → ${TUNNEL_URL}"
