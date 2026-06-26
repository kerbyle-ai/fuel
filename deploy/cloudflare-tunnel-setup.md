# Cloudflare Tunnel — публичный URL без открытых портов Timeweb

**VPS:** `147.45.175.194`  
**Backend:** `http://127.0.0.1:8090` (nginx в Docker)

Используйте, если с интернета TCP на 80/8090/8888 подключается, но HTTP висит — туннель обходит фильтрацию провайдера.

---

## Путь 1 — Quick Tunnel (БЕЗ домена, ~5 минут)

Даёт временный HTTPS-URL вида `https://xxxx.trycloudflare.com`. Подходит для запуска **прямо сейчас**.

### VNC — вставьте по блокам

```bash
# 1. Установка cloudflared
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
cloudflared --version
```

```bash
# 2. Проверка, что сайт жив локально
curl -sf --max-time 5 http://127.0.0.1:8090/api/health && echo " OK"
```

```bash
# 3. Запуск Quick Tunnel (URL появится в выводе через 10–20 сек)
cloudflared tunnel --url http://127.0.0.1:8090
```

Скопируйте строку вида:

```
https://random-words-here.trycloudflare.com
```

Откройте в браузере с телефона (моб. интернет). Проверка:

```bash
curl -sf "https://ВАШ-URL.trycloudflare.com/api/health"
```

### Автозапуск Quick Tunnel (systemd)

```bash
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

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now cloudflared-quick
journalctl -u cloudflared-quick -f
```

URL меняется при каждом перезапуске сервиса. Для постоянного URL нужен именованный туннель (путь 2).

### Обновить .env и бота под Quick Tunnel URL

```bash
cd /opt/fuel-map
TUNNEL_URL="https://ВАШ-URL.trycloudflare.com"
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${TUNNEL_URL}|" .env
sed -i "s|^WEB_APP_URL=.*|WEB_APP_URL=${TUNNEL_URL}|" .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api
systemctl restart fuel-map-bot 2>/dev/null || true
```

---

## Путь 2 — Именованный туннель (нужен домен в Cloudflare)

Когда появится домен (например `fuel.example.ru`):

### 1. Cloudflare Dashboard

1. Добавьте домен в [Cloudflare](https://dash.cloudflare.com/) (бесплатный план).
2. У регистратора смените NS на Cloudflare.

### 2. VNC — авторизация и создание туннеля

```bash
cloudflared tunnel login
# Откроется URL — скопируйте в браузер на ПК, выберите домен

cloudflared tunnel create fuel-map
# Запомните Tunnel ID из вывода

mkdir -p /etc/cloudflared
```

```bash
# Замените TUNNEL_ID и your-domain.ru
cat > /etc/cloudflared/config.yml <<EOF
tunnel: TUNNEL_ID
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: fuel.your-domain.ru
    service: http://127.0.0.1:8090
  - service: http_status:404
EOF

cloudflared tunnel route dns fuel-map fuel.your-domain.ru
```

### 3. systemd

```bash
cloudflared service install
systemctl enable --now cloudflared
systemctl status cloudflared
```

Публичный URL: `https://fuel.your-domain.ru`

---

## Сравнение

| Метод | Домен | Постоянный URL | Открытые порты Timeweb |
|-------|-------|----------------|------------------------|
| Quick Tunnel | нет | нет (меняется) | не нужны |
| Named Tunnel | да | да | не нужны |
| Порт 8888 | нет | да (IP:8888) | TCP 8888 inbound |

**Сейчас (без домена):** `deploy/vnc-free-public-url.sh` — Quick Tunnel, автоматический systemd + обновление `.env`. Порт 8888 — если нужен стабильный IP-адрес в ссылках (но HTTP снаружи может не работать).
