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

### Диагностика «в Москве только 3 АЗС»

Различайте: **3 маркера на карте** (счётчик «N АЗС в области») vs **3 АЗС с ценами** (зелёные / превью цены).

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# 1) Всего станций в БД (ожидание ~25560; ~100 = только seed после git pull)
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) AS stations_total FROM stations;"

# 2) Станции в bbox Москвы (lat 55.5–56.0, lng 37.3–37.9)
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c \
  "SELECT COUNT(*) AS moscow_bbox FROM stations WHERE lat BETWEEN 55.5 AND 56.0 AND lng BETWEEN 37.3 AND 37.9;"

# 3) Привязки benzin для региона 77 (Москва)
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c \
  "SELECT COUNT(*) AS benzin_links_moscow FROM benzin_station_links b JOIN stations s ON s.id=b.station_id WHERE s.lat BETWEEN 55.5 AND 56.0 AND s.lng BETWEEN 37.3 AND 37.9;"

# 4) Станции с ценой за 7 дней в bbox Москвы
$COMPOSE exec -T db psql -U fuelmap -d fuelmap -c \
  "SELECT COUNT(DISTINCT r.station_id) AS moscow_priced_7d FROM reports r JOIN stations s ON s.id=r.station_id WHERE s.lat BETWEEN 55.5 AND 56.0 AND s.lng BETWEEN 37.3 AND 37.9 AND r.price IS NOT NULL AND r.created_at > NOW() - INTERVAL '7 days';"

# 5) API: все маркеры в bbox (без фильтра топлива)
curl -sS "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,56.0" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('api_count', len(d.get('stations',[])), 'meta', d.get('meta'))"

# 6) API: только с отчётами по АИ-95 + скрыть без топлива (как фильтр «только с ценами»)
curl -sS "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,56.0&fuel_types=ai95&hide_without_fuel=true" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('api_with_fuel', len(d.get('stations',[])))"
```

| Симптом | Причина | Лечение |
|---------|---------|---------|
| `stations_total` ~100, `moscow_bbox` ~100 | Полный дамп не восстановлен, только Docker seed | `bash deploy/vnc-restore-db.sh` |
| `stations_total` ~25560, `api_count` 3 | Баг фронта (устаревший bbox) или сильный зум | `git pull` + rebuild nginx; отдалить карту |
| `api_count` сотни, `moscow_priced_7d` 3 | Цены не импортированы | `bash deploy/run-benzin-import.sh --region 77` |
| `benzin_links_moscow` 3 | Импорт benzin только начался / gate | `tail -f /var/log/fuel-map-import.log` |

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
| `parsed: 0 prices for 0 stations` | **Блокировка IP датацентра** — benzin-price.ru отдаёт пустой `<body></body>` (HTTP 200, ~39 байт). См. ниже |
| Импорт завис | `tail -f /var/log/fuel-map-import.log`; Playwright может ждать benzin-price.ru |
| Дубликат cron | `deploy/install-price-import-cron.sh` идемпотентен |
| Gate/captcha на benzin | экспорт cookies с домашнего ПК → `scripts/data/benzin-cookies3.txt`, rebuild importer |

### Блокировка VPS (0 станций, пустой HTML)

**Причина:** `price.php` редиректит на `price2.php`, но с IP Timeweb сервер отдаёт пустую страницу без таблицы цен — парсер молча возвращал 0 строк.

**Диагностика на VPS:**

```bash
# curl — ожидаемо пусто с датацентра
curl -sL -o /tmp/bp.html -w "HTTP %{http_code} size %{size_download}\n" \
  "https://www.benzin-price.ru/price2.php?region_id=77&sort=2"
wc -c /tmp/bp.html   # ~39 байт = блокировка

# dry-run с логами (после git pull)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile importer run --rm price-importer -- --region 77 --dry-run
# Смотреть [benzin] status=... len=... empty=true
# Артефакты: docker cp <container>:/tmp/benzin-debug ./benzin-debug
```

**Обход (seed):** если scraper не работает, подставить уже экспортированные цены:

```bash
bash deploy/apply-reports-seed.sh
# или вручную (7293 отчёта, 44 АЗС по РФ):
gunzip -c deploy/reports-seed.sql.gz | docker compose ... exec -T db psql -U fuelmap -d fuelmap
```

Seed срабатывает автоматически только при `priced_7d < 100`. При 360+ отчётах по РФ — **принудительно** через `apply-reports-seed.sh`.

**Cookies с браузера (если IP не заблокирован полностью):**

1. Зайти на benzin-price.ru в Chrome, открыть цены Москвы
2. Экспорт cookies (расширение или DevTools) → `scripts/data/benzin-cookies3.txt` (Netscape format)
3. `git pull` на VPS, rebuild: `docker compose --profile importer build price-importer`

**Важно:** benzin-price.ru запрещает автопарсинг без разрешения — `--delay 2000` обязателен.
