#!/bin/bash
# Быстрый фикс: открыть fuel-map на порту 80 (без git pull).
# Вставьте целиком в VNC-консоль Timeweb на VPS.
set -euo pipefail
cd /opt/fuel-map

echo "=== 1. Проверка порта 80 на хосте ==="
if ss -tlnp | grep -q ':80 '; then
  echo "WARN: порт 80 уже занят:"
  ss -tlnp | grep ':80 ' || true
  echo "Остановите конфликтующий сервис или используйте host nginx (deploy/nginx-host.conf.example)"
fi

echo "=== 2. docker-compose.prod.yml — проброс 80 ==="
if ! grep -q '0.0.0.0:80:80' docker-compose.prod.yml 2>/dev/null; then
  sed -i '/nginx:/,/depends_on:/{
    /ports:/a\      - "0.0.0.0:80:80"
  }' docker-compose.prod.yml 2>/dev/null || \
  python3 - <<'PY'
from pathlib import Path
p = Path("docker-compose.prod.yml")
text = p.read_text()
needle = '    ports:\n      - "0.0.0.0:${NGINX_PORT:-8090}:80"'
insert = '    ports:\n      - "0.0.0.0:80:80"\n      - "0.0.0.0:${NGINX_PORT:-8090}:80"'
if '0.0.0.0:80:80' not in text and needle in text:
    p.write_text(text.replace(needle, insert))
    print("patched docker-compose.prod.yml")
elif '0.0.0.0:80:80' in text:
    print("docker-compose.prod.yml already has port 80")
else:
    raise SystemExit("Could not patch docker-compose.prod.yml — run git pull")
PY
fi

echo "=== 3. .env — URL и CORS ==="
touch .env
grep -q '^ALLOWED_ORIGINS=' .env \
  && sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194,http://147.45.175.194:8090|' .env \
  || echo 'ALLOWED_ORIGINS=http://147.45.175.194,http://147.45.175.194:8090' >> .env
grep -q '^WEB_APP_URL=' .env \
  && sed -i 's|^WEB_APP_URL=.*|WEB_APP_URL=http://147.45.175.194|' .env \
  || echo 'WEB_APP_URL=http://147.45.175.194' >> .env

echo "=== 4. UFW ==="
ufw allow 80/tcp comment fuel-map-http 2>/dev/null || true
ufw allow 8090/tcp comment fuel-map-test 2>/dev/null || true
ufw reload 2>/dev/null || true

echo "=== 5. Docker Compose ==="
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx api
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo "=== 6. Health check ==="
curl -sf --max-time 5 http://127.0.0.1/api/health && echo " OK :80"
curl -sf --max-time 5 http://127.0.0.1:8090/api/health && echo " OK :8090"

echo "=== 7. Telegram bot ==="
if systemctl is-active fuel-map-bot >/dev/null 2>&1; then
  systemctl restart fuel-map-bot
  sleep 2
  journalctl -u fuel-map-bot -n 5 --no-pager || true
else
  echo "fuel-map-bot service not installed — skip or: systemctl restart fuel-map-bot"
fi

echo ""
echo "Готово. Откройте в браузере: http://147.45.175.194/"
echo "Timeweb Firewall: разрешите Inbound TCP 80 (0.0.0.0/0)"
