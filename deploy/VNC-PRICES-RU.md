# Цены на карте — парсер benzin-price.ru (VPS)

**VPS:** `147.45.175.194` · **Путь:** `/opt/fuel-map` · **Сайт:** http://147.45.175.194:8090

Парсер **не в коде API** — он в `scripts/`, запускается как Docker-сервис `price-importer` и пишет цены в ту же PostgreSQL, откуда сайт читает `/api/stations`.

| Компонент | Назначение |
|-----------|------------|
| `scripts/import-benzin-price.ts` | парсинг benzin-price.ru (Playwright) |
| `docker compose --profile importer run price-importer` | одноразовый импорт в контейнере |
| `deploy/run-benzin-import.sh` | обёртка для VPS (flock + compose) |
| cron `0 */2 * * *` | автообновление каждые 2 часа |
| `deploy/reports-seed.sql.gz` | начальный дамп ~7k отчётов (если priced_7d < 100) |
| `benzin_station_links` | привязка benzin_id → station_id (миграция 003) |

---

## 1. Обновить код и включить cron

```bash
cd /opt/fuel-map
git pull --ff-only origin main
bash deploy/vnc-github-update.sh
```

Скрипт: rebuild Docker, seed отчётов (если мало), установка cron, **фоновый первый импорт** если `benzin_station_links` пуста.

---

## 2. Принудительный импорт цен (вручную)

Полный проход по всем регионам (~1–2 ч):

```bash
cd /opt/fuel-map
bash deploy/run-benzin-import.sh
```

Или с логом в фоне:

```bash
cd /opt/fuel-map
nohup bash deploy/run-benzin-import.sh >> /var/log/fuel-map-import.log 2>&1 &
tail -f /var/log/fuel-map-import.log
```

Один регион (тест, ~5 мин):

```bash
cd /opt/fuel-map
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile importer run --rm price-importer -- --region 77 --delay 2000 --match-radius 250
```

---

## 3. Начальные данные (если цен в API нет)

Если отчётов с ценой за 7 дней < 100 — seed подставится автоматически. Принудительно:

```bash
cd /opt/fuel-map
gunzip -c deploy/reports-seed.sql.gz | \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1
```

---

## 4. Проверка БД и API

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Счётчики
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) AS stations FROM stations;"
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) AS reports FROM reports;"
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) AS benzin_links FROM benzin_station_links;"

# Отчёты с ценой за последние 7 дней (API читает только их)
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c \
  "SELECT COUNT(*) AS priced_7d FROM reports WHERE price IS NOT NULL AND created_at > NOW() - INTERVAL '7 days';"

# API
curl -s http://127.0.0.1:8090/api/health

# Станции с ценами в bbox Москвы (пример)
curl -s "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,55.9&fuel_types=ai95" | head -c 2000
```

**Ожидание:** stations ~25 560, priced_7d 7 000+, benzin_links растёт после импорта.

---

## 5. Cron (авто каждые 2 часа)

```bash
cd /opt/fuel-map
bash deploy/install-price-import-cron.sh
crontab -l | grep benzin
tail -20 /var/log/fuel-map-import.log
```

---

## 6. Устранение неполадок

| Проблема | Действие |
|----------|----------|
| На карте нет цен | `bash deploy/run-benzin-import.sh`, проверить `reports` и `benzin_station_links` |
| Импорт завис | `tail -f /var/log/fuel-map-import.log`; Playwright может ждать benzin-price.ru |
| Дубликат cron | `deploy/install-price-import-cron.sh` идемпотентен |
| Gate/captcha на benzin | увеличить `--delay 3000`, повторить позже |

**Важно:** benzin-price.ru запрещает автопарсинг без разрешения — `--delay 2000` обязателен.
