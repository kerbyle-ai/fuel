# Handover для чата разработки сайта (VPS deploy)

**Куда:** чат [fuel-map site deploy](58ce7c8a-2e37-4c51-b970-39dc03dfebff)  
**Дата:** 2026-06-26  
**Репозиторий:** https://github.com/kerbyle-ai/fuel.git  
**VPS:** `147.45.175.194` → `/opt/fuel-map`  
**Сайт:** http://147.45.175.194:8090

---

## Задача для агента в чате деплоя

Загрузить на сервер **актуальные цены на топливо** (7k+ отчётов) и включить **автообновление каждые 2 часа** с улучшенным сопоставлением АЗС (координаты + привязка к OSM).

---

## Что уже в GitHub (ветка `main`)

| Компонент | Описание |
|-----------|----------|
| `deploy/reports-seed.sql.gz` | дамп отчётов с ценами (обновляется после импорта на Windows) |
| `deploy/vnc-github-update.sh` | pull + docker rebuild + seed + cron |
| `scripts/` + `Dockerfile.importer` | парсер benzin-price.ru (Playwright) |
| `backend/migrations/003_benzin_links.sql` | таблица связи benzin_id ↔ station_id |
| cron `0 */2 * * *` | автоимпорт через `deploy/run-benzin-import.sh` |

### Улучшенное сопоставление (коммит после `c140db7`)

- Импорт **с координатами** (страница каждой АЗС на benzin-price.ru)
- Сначала поиск OSM-станции в радиусе **250 м** (с приоритетом по бренду)
- Постоянная таблица `benzin_station_links` — повторные импорты быстрее
- Без `--no-coords` в Docker/cron

---

## Команды на VPS (VNC, root)

### 1. Обновить код и применить данные

```bash
cd /opt/fuel-map
git pull --ff-only origin main
bash deploy/vnc-github-update.sh
```

Скрипт:
1. Пересоберёт контейнеры (применит миграцию `003_benzin_links`)
2. Загрузит `deploy/reports-seed.sql.gz` если в БД < 500 отчётов
3. Установит cron автоимпорта

### 2. Принудительно обновить цены (если отчётов уже много)

```bash
cd /opt/fuel-map
gunzip -c deploy/reports-seed.sql.gz | docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap -v ON_ERROR_STOP=1
```

### 3. Первый полный импорт с координатами (~1–2 ч)

```bash
cd /opt/fuel-map
bash deploy/run-benzin-import.sh
tail -f /var/log/fuel-map-import.log
```

### 4. Проверка

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) FROM stations;"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) FROM reports;"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) FROM benzin_station_links;"
curl -s http://127.0.0.1:8090/api/health
```

Ожидание: stations ~25 560, reports 7 000+, benzin_station_links растёт после импорта.

---

## Если `git pull` не работает

Репозиторий публичный: `git clone https://github.com/kerbyle-ai/fuel.git /opt/fuel-map`

`.env` не в git — скопировать с локальной машины или из `deploy/.env.production.example`.

---

## Локальное обновление seed (Windows, перед push)

```powershell
cd C:\Users\user\.cursor\fuel-map
docker compose up -d db
cd scripts
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"
npm run migrate
npm run import:benzin-price -- --region all --delay 2000 --match-radius 250
npm run export:reports -- ../deploy/reports-seed.sql.gz
cd ..
git add deploy/reports-seed.sql.gz backend/migrations/003_benzin_links.sql scripts/ deploy/
git commit -m "deploy: improved price matching + reports seed"
git push origin main
```

---

## Важно

- **Не коммитить** `.env` и пароли VPS в git
- Root-пароль VPS был в чате — **сменить** (`passwd`)
- benzin-price.ru запрещает парсинг без разрешения — задержка `--delay 2000` обязательна

---

## Контекст проекта

- Путь на ПК: `C:\Users\user\.cursor\fuel-map`
- БД: PostgreSQL + PostGIS, 25 560 АЗС из OSM
- Цены: краудсорсинг-формат (без указания источника в UI)
