# Деплой Fuel Map на Timeweb VPS — пошаговая инструкция

Полный гайд для выкладки **Карты АЗС** на VPS Timeweb с Docker, SSL, Telegram-ботом и бэкапами.

**Стек на сервере:** PostgreSQL + PostGIS (Docker) → API (Docker) → nginx в Docker (localhost:8090) → host nginx + Let's Encrypt (443).

> У вас уже ~25 560 АЗС локально — в шаге 7 описан перенос через `pg_dump` / `scp` / `psql`.

---

## Что понадобится

| Что | Пример |
|-----|--------|
| VPS Timeweb | 2 vCPU, 4 GB RAM, Ubuntu 22.04 |
| Домен | `fuel.example.ru` → A-запись на IP VPS |
| SSH с Windows | PowerShell, OpenSSH |
| Репозиторий | git или копия папки `fuel-map` |
| Telegram | токен от @BotFather |

---

## Шаг 1. Заказ VPS на Timeweb

1. Войдите в [панель Timeweb](https://timeweb.cloud/) → **Облачные серверы** (или **VPS/VDS**).
2. Нажмите **Создать сервер** / **Заказать VPS**.
3. Параметры:
   - **ОС:** Ubuntu **22.04** LTS
   - **Конфигурация:** **2 vCPU**, **4 GB RAM**, SSD от 40 GB
   - **Регион:** ближайший к аудитории (Москва / СПб)
   - **IPv4:** включён (запомните IP — понадобится для DNS и SSH)
4. Задайте **root-пароль** или добавьте **SSH-ключ** (рекомендуется).
5. Имя сервера, например: `fuel-map-prod`.
6. Нажмите **Создать** и дождитесь статуса **Активен** (1–3 минуты).
7. Скопируйте **публичный IPv4** из карточки сервера.

---

## Шаг 2. Подключение по SSH с Windows

Откройте **PowerShell** (Win + X → Terminal / PowerShell):

```powershell
ssh root@ВАШ_IP
```

При первом подключении ответьте `yes` на вопрос о fingerprint.

- С паролем: введите root-пароль из панели Timeweb.
- С ключом: ключ должен быть в `C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\.ssh\id_ed25519` (или укажите `-i путь\к\ключу`).

Проверка:

```bash
uname -a    # должно быть Ubuntu 22.04
```

Опционально — обновление системы:

```bash
apt update && apt upgrade -y
```

---

## Шаг 3. Установка Docker на Ubuntu

Одной командой (официальный скрипт Docker):

```bash
curl -fsSL https://get.docker.com | sh
```

Проверка:

```bash
docker --version
docker compose version
```

Docker Compose v2 входит в пакет `docker-ce` — отдельно ставить не нужно.

---

## Шаг 4. Загрузка проекта на сервер

Рекомендуемый путь на сервере: `/opt/fuel-map`.

### Вариант A — git clone (если репозиторий на GitHub/GitLab)

На сервере:

```bash
apt install -y git
cd /opt
git clone https://github.com/ВАШ_АККАУНТ/fuel-map.git
cd fuel-map
```

### Вариант B — scp с Windows (без git)

На **Windows** в PowerShell (из папки с проектом):

```powershell
cd C:\Users\user\.cursor
scp -r fuel-map root@ВАШ_IP:/opt/
```

На сервере:

```bash
cd /opt/fuel-map
```

> Исключите при копировании `node_modules`, `frontend/dist`, `.git` если архив тяжёлый — на сервере всё соберётся в Docker.

### Вариант C — архив

```powershell
# Windows: упаковать без node_modules
tar -czf fuel-map.tar.gz --exclude=node_modules --exclude=.git fuel-map
scp fuel-map.tar.gz root@ВАШ_IP:/opt/
```

```bash
# Сервер
cd /opt && tar -xzf fuel-map.tar.gz && cd fuel-map
```

---

## Шаг 5. Настройка production `.env`

```bash
cd /opt/fuel-map
cp deploy/.env.production.example .env
nano .env
```

**Обязательно замените:**

| Переменная | Что указать |
|------------|-------------|
| `POSTGRES_PASSWORD` | Сильный пароль (`openssl rand -base64 32`) |
| `DOMAIN` | Ваш домен, напр. `fuel.example.ru` |
| `CERTBOT_EMAIL` | Email для Let's Encrypt |
| `ALLOWED_ORIGINS` | `https://fuel.example.ru` (тот же домен) |
| `WEB_APP_URL` | `https://fuel.example.ru` |
| `API_URL` | `http://127.0.0.1:8090/api` (для бота на хосте) |
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather |

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Шаг 6. Запуск Docker Compose (production)

Production-режим использует override без открытых портов БД и API:

```bash
cd /opt/fuel-map
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Первый запуск: 5–15 минут (сборка frontend, миграции, seed ~100 АЗС).

Проверка контейнеров:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Локально на сервере (ещё без домена):

```bash
curl -s http://127.0.0.1:8090/api/health
# {"status":"ok"}
```

Полезные логи:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

---

## Шаг 7. Данные: OSM-импорт или перенос с локальной машины (~25k АЗС)

### Вариант A — перенос вашей локальной базы (рекомендуется)

**На Windows (локально), где уже 25 560 станций:**

```powershell
cd C:\Users\user\.cursor\fuel-map
docker compose exec -T db pg_dump -U fuelmap fuelmap | gzip > fuelmap-backup.sql.gz
```

Размер дампа обычно десятки–сотни МБ. Загрузка на VPS:

```powershell
scp fuelmap-backup.sql.gz root@ВАШ_IP:/opt/fuel-map/
```

**На сервере** (контейнеры должны быть запущены):

```bash
cd /opt/fuel-map

# Остановить API чтобы не писал в БД во время restore (опционально)
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop api

# Восстановление (перезапишет данные в volume pgdata)
gunzip -c fuelmap-backup.sql.gz | docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap

# Запустить API снова
docker compose -f docker-compose.yml -f docker-compose.prod.yml start api
```

Проверка количества станций:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) FROM stations;"
```

### Вариант B — полный импорт OSM на сервере (5–15 мин, ~26k АЗС)

Если локального дампа нет:

```bash
cd /opt/fuel-map/scripts
docker run --rm -v "$(pwd):/app" -w /app --network fuel-map_default \
  -e DATABASE_URL=postgresql://fuelmap:ВАШ_ПАРОЛЬ@db:5432/fuelmap \
  node:22-alpine sh -c "npm install && npm run import:osm"
```

> Замените `ВАШ_ПАРОЛЬ` и имя сети (`docker network ls` → обычно `fuel-map_default`).

Проще: временно пробросить порт БД только для импорта с вашего ПК — не оставляйте 5432 открытым в production.

---

## Шаг 8. DNS: A-запись домена на IP VPS

В панели регистратора домена (или Timeweb DNS):

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| **A** | `@` | `ВАШ_IP_VPS` | 300–3600 |
| **A** | `www` | `ВАШ_IP_VPS` | 300–3600 |

Проверка (с любого ПК):

```powershell
nslookup fuel.example.ru
```

Дождитесь распространения DNS (5 мин – 24 ч).

---

## Шаг 9. Host nginx + SSL (Let's Encrypt)

### Установка nginx и certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/certbot
```

### Конфиг reverse proxy

```bash
cd /opt/fuel-map
cp deploy/nginx-host.conf.example /etc/nginx/sites-available/fuel-map
nano /etc/nginx/sites-available/fuel-map
```

Замените **все** `your-domain.ru` на ваш домен.

```bash
ln -sf /etc/nginx/sites-available/fuel-map /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # опционально
nginx -t && systemctl reload nginx
```

### Выпуск сертификата

```bash
certbot --nginx -d fuel.example.ru
```

Следуйте подсказкам (email, согласие, редирект HTTP→HTTPS — **да**).

Автообновление:

```bash
certbot renew --dry-run
```

Проверка в браузере: `https://fuel.example.ru` — карта и `/api/health`.

---

## Шаг 10. Telegram-бот (systemd)

Бот **не** в docker-compose — запускается на хосте и ходит в API через `http://127.0.0.1:8090/api`.

### Сборка бота

```bash
cd /opt/fuel-map/telegram-bot
npm install
npm run build
```

Убедитесь, что в `/opt/fuel-map/.env` заданы `TELEGRAM_BOT_TOKEN`, `API_URL`, `WEB_APP_URL`.

### Установка systemd unit

```bash
cp /opt/fuel-map/deploy/fuel-map-bot.service /etc/systemd/system/
# Если путь не /opt/fuel-map — отредактируйте WorkingDirectory и EnvironmentFile
systemctl daemon-reload
systemctl enable fuel-map-bot
systemctl start fuel-map-bot
systemctl status fuel-map-bot
```

Логи:

```bash
journalctl -u fuel-map-bot -f
```

В Telegram: найдите бота → `/start`, `/nearby`, `/report`.

---

## Шаг 11. Файрвол UFW

Разрешить только SSH, HTTP и HTTPS. **Порт 5432 (PostgreSQL) наружу не открывать.**

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw enable
ufw status verbose
```

Проверка снаружи: `nmap -p 22,80,443,5432,3001,8090 ВАШ_IP` — открыты только 22, 80, 443.

---

## Шаг 12. Автоматический бэкап (cron)

```bash
chmod +x /opt/fuel-map/deploy/backup.sh
/opt/fuel-map/deploy/backup.sh
ls -lh /opt/fuel-map/backups/
```

Cron (ежедневно в 03:00):

```bash
crontab -e
```

Добавьте строку:

```cron
0 3 * * * /opt/fuel-map/deploy/backup.sh >> /var/log/fuel-map-backup.log 2>&1
```

Бэкапы: `/opt/fuel-map/backups/fuelmap_YYYYMMDD_HHMMSS.sql.gz` (хранение 14 дней).

Скачать бэкап на Windows:

```powershell
scp root@ВАШ_IP:/opt/fuel-map/backups/fuelmap_*.sql.gz .
```

---

## Шаг 13. Smoke test — чеклист перед запуском

- [ ] `https://ВАШ_ДОМЕН` — открывается карта, нет ошибок в консоли браузера (F12)
- [ ] `https://ВАШ_ДОМЕН/api/health` → `{"status":"ok"}`
- [ ] `https://ВАШ_ДОМЕН/api/config` — JSON с настройками
- [ ] На карте видны АЗС (zoom по России), поиск находит станции
- [ ] Отправка тестового отчёта с карты — успех, точка обновилась
- [ ] `SELECT COUNT(*) FROM stations` — ожидаемое число (~25k или ~26k)
- [ ] Telegram `/start` и `/nearby` отвечают
- [ ] `ufw status` — только 22, 80, 443
- [ ] `ss -tlnp | grep 5432` — PostgreSQL слушает только внутри Docker, не на `0.0.0.0:5432`
- [ ] `curl -I http://ВАШ_IP:8090` с внешнего ПК — **не** доступен (только localhost)
- [ ] SSL: замок в браузере, certbot `renew --dry-run` OK
- [ ] `deploy/backup.sh` создал файл в `backups/`
- [ ] После перезагрузки VPS: `docker compose ... ps` все `healthy` / `running`, `systemctl status fuel-map-bot` active

---

## Обновление приложения

```bash
cd /opt/fuel-map
git pull   # или залить новые файлы через scp
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
cd telegram-bot && npm install && npm run build
systemctl restart fuel-map-bot
```

---

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| `docker pull` EOF | В `.env`: `POSTGIS_IMAGE=docker.m.daocloud.io/postgis/postgis:16-3.4` |
| 502 Bad Gateway | `docker compose ... ps`, логи nginx и api; проверьте `127.0.0.1:8090` |
| CORS в браузере | `ALLOWED_ORIGINS=https://ваш-домен.ru` в `.env`, пересоберите api |
| Бот молчит | `journalctl -u fuel-map-bot`, проверьте `TELEGRAM_BOT_TOKEN` и `API_URL` |
| Мало памяти при build | `docker system prune`, swap 2G, или собирать образ локально и `docker load` |

---

## Файлы деплоя в репозитории

| Файл | Назначение |
|------|------------|
| `docker-compose.prod.yml` | Без публичных портов db/api |
| `deploy/.env.production.example` | Шаблон `.env` |
| `deploy/nginx-host.conf.example` | Host nginx + SSL |
| `deploy/fuel-map-bot.service` | systemd для бота |
| `deploy/backup.sh` | pg_dump + ротация |

---

## Быстрые команды (шпаргалка)

```bash
# Статус
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Логи API
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api

# Перезапуск всего стека
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Ручной бэкап
/opt/fuel-map/deploy/backup.sh
```
