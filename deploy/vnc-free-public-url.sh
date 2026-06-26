#!/bin/bash
# fuel-map — бесплатный публичный HTTPS без домена (Cloudflare Quick Tunnel).
# VNC Timeweb: bash deploy/vnc-free-public-url.sh  ИЛИ построчно (см. ниже).
# Firewall не трогаем — только outbound. URL меняется при restart cloudflared-quick.
#
# --- VNC: одна команда на строку (ручной режим) ---
# curl -sf --max-time 5 http://127.0.0.1:8090/api/health && echo OK
# curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
# dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
# cloudflared tunnel --url http://127.0.0.1:8090
#   → скопируйте https://xxxx.trycloudflare.com, Ctrl+C
# cd /opt/fuel-map
# TUNNEL_URL="https://xxxx.trycloudflare.com"
# sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env
# sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${TUNNEL_URL}|" .env
# docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api
# systemctl restart fuel-map-bot
#
# ngrok (альтернатива): ngrok http 8090
#
set -euo pipefail
cd /opt/fuel-map

echo "=== fuel-map free public URL $(date -Is) ==="

echo "=== 1. Локальная проверка (127.0.0.1:8090) ==="
curl -sf --max-time 5 http://127.0.0.1:8090/api/health
echo " OK"

echo "=== 2. Установка cloudflared ==="
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
cloudflared --version

echo "=== 3. systemd — Quick Tunnel (автозапуск) ==="
cat > /etc/systemd/system/cloudflared-quick.service <<'EOF'
[Unit]
Description=Cloudflare Quick Tunnel for fuel-map
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --url http://127.0.0.1:8090
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cloudflared-quick
systemctl restart cloudflared-quick

echo "=== 4. Ожидание URL (до 30 сек) ==="
TUNNEL_URL=""
for i in $(seq 1 15); do
  TUNNEL_URL=$(journalctl -u cloudflared-quick -n 80 --no-pager 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
  if [ -n "$TUNNEL_URL" ]; then break; fi
  sleep 2
done
if [ -z "$TUNNEL_URL" ]; then
  echo "WARN: URL не найден в логах. Смотрите:"
  echo "  journalctl -u cloudflared-quick -n 30 --no-pager | grep trycloudflare"
  echo "Скопируйте https://....trycloudflare.com и выполните блок 5 вручную."
  exit 1
fi
echo "TUNNEL_URL=${TUNNEL_URL}"

echo "=== 5. .env — WEB_APP_URL и CORS ==="
touch .env
grep -q '^ALLOWED_ORIGINS=' .env \
  && sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090|" .env \
  || echo "ALLOWED_ORIGINS=${TUNNEL_URL},http://127.0.0.1:8090" >> .env
grep -q '^WEB_APP_URL=' .env \
  && sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env \
  || echo "WEB_APP_URL=${TUNNEL_URL}" >> .env

echo "=== 6. Перезапуск API + nginx (CORS) и Telegram-бота ==="
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api nginx
if systemctl is-active fuel-map-bot >/dev/null 2>&1; then
  systemctl restart fuel-map-bot
fi

echo "=== 7. Проверка публичного URL ==="
curl -sf --max-time 15 "${TUNNEL_URL}/api/health"
echo " OK public"

echo ""
echo "=============================================="
echo "ГОТОВО. Публичный URL (HTTPS, без домена):"
echo "  ${TUNNEL_URL}"
echo ""
echo "ВАЖНО: URL меняется при каждом restart cloudflared-quick."
echo "  systemctl restart cloudflared-quick  → новый URL → повторите блок 5–6."
echo ""
echo "Логи туннеля: journalctl -u cloudflared-quick -f"
echo "Проверка с телефона (моб. интернет): откройте ${TUNNEL_URL}"
echo "=============================================="
echo ""
echo "Альтернатива (ngrok, нужен бесплатный аккаунт ngrok.com):"
echo "  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null"
echo "  echo 'deb https://ngrok-agent.s3.amazonaws.com bookworm main' | tee /etc/apt/sources.list.d/ngrok.list"
echo "  apt-get update && apt-get install -y ngrok"
echo "  ngrok config add-authtoken ВАШ_ТОКЕН"
echo "  ngrok http 8090"
echo "  (URL в выводе; для автозапуска — отдельный systemd unit)"
