# Карта АЗС — наличие топлива по России

MVP-сервис для отображения заправок на карте России с краудсорсинговыми отчётами о наличии топлива.

## Стек

| Компонент | Технологии |
|-----------|------------|
| **frontend/** | Vite + React + TypeScript + Leaflet + PWA |
| **backend/** | Node.js + Fastify + TypeScript |
| **scripts/** | OSM import, Moscow seed (Overpass + JSON) |
| **nginx/** | Multi-stage: `npm run build` фронтенда + reverse proxy |
| **telegram-bot/** | grammY (опционально, не в compose) |
| **БД** | PostgreSQL 16 + PostGIS |

## Быстрый старт (Docker)

```bash
cd fuel-map
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d --build
```

- **Frontend:** http://localhost:8090
- **API:** http://localhost:3001/api/health
- **PostgreSQL:** localhost:5432

При первом запуске контейнер `api` автоматически:
1. Ждёт готовности PostgreSQL
2. Применяет миграции (`backend/migrations/`)
3. Загружает ~100 тестовых АЗС из `backend/seed-data/seed-moscow.json`
4. Создаёт демо-отчёты

Проверка compose-файла: `docker compose config`

## Локальная разработка

```bash
# Только БД в Docker
docker compose up db -d

# Backend
cd backend
npm install
npm run migrate
npm run seed
npm run dev

# Frontend (другой терминал)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173 (прокси `/api` → :3001)

## Windows без Docker (когда pull не работает)

Если `docker pull` даёт EOF на docker.io / daocloud, см. **[docs/WINDOWS-NO-DOCKER.md](docs/WINDOWS-NO-DOCKER.md)**.

```powershell
cd fuel-map
.\scripts\start-windows-dev.ps1 -StartServers
```

Карта: **http://127.0.0.1:5173** (PostgreSQL 16 + PostGIS локально, без образов Docker).


Dev override (только db без api/nginx): `docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d`

## Seed Moscow (~100 АЗС)

Два способа загрузить тестовые данные:

### A. Автоматически при Docker (backend seed)

Файл `backend/seed-data/seed-moscow.json` копируется в образ API и загружается при старте.

Перегенерировать JSON (синтетические ~100 точек):

```bash
cd scripts
npm install
npm run generate-seed
```

Обновляет `scripts/seed-moscow.json` и `backend/seed-data/seed-moscow.json`. Затем пересоберите:

```bash
docker compose down -v    # сброс БД
docker compose up -d --build
```

### B. Скрипт с Overpass / curated JSON (рекомендуется для dev)

Подробности: [scripts/README.md](scripts/README.md)

```bash
cd scripts
npm install
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"   # PowerShell

npm run seed              # из data/moscow-stations.json (~100)
npm run seed:fetch        # скачать bbox Москвы из Overpass, затем seed
CLEAR=1 npm run seed      # заменить существующие станции
```

## Полный импорт OSM (~26k АЗС)

```bash
cd scripts
npm install
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"
npm run import:osm
```

> 5–15 минут, возможны rate limits Overpass API.

## Telegram Bot (опционально)

Папка `telegram-bot/` — grammY-бот для уведомлений и deep-link в PWA. **Не включён в `docker-compose.yml`** (нужен `TELEGRAM_BOT_TOKEN`).

```bash
cd telegram-bot
npm install
npm run build
# Задайте TELEGRAM_BOT_TOKEN, API_URL, WEB_APP_URL — см. .env.example
npm run dev
```

См. [telegram-bot/README.md](telegram-bot/README.md).

## Проверка сборки (без Docker)

```bash
cd backend   && npm install && npm run build   # ✓ tsc → dist/
cd frontend  && npm install && npm run build   # ✓ tsc + vite build → dist/
cd telegram-bot && npm install && npm run build
```

## Структура

```
fuel-map/
├── docker-compose.yml       # db + api + nginx
├── docker-compose.dev.yml   # только db для локальной разработки
├── docker-compose.prod.yml  # VPS: db/api без публичных портов
├── deploy/                  # production: .env, nginx, backup, systemd
├── docs/DEPLOY-TIMEWEB.md   # пошаговый деплой на Timeweb
├── backend/                 # Fastify API, migrations, seed-data/
├── frontend/                # React PWA
├── scripts/                 # seed-moscow, import-osm, generate-seed
├── nginx/                   # Dockerfile: vite build + nginx.conf
├── telegram-bot/            # опциональный grammY бот
└── .env.example
```

## API (кратко)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/config` | Настройки карты |
| GET | `/api/stations?bbox=...` | АЗС в viewport |
| GET | `/api/stations/search?q=...` | Поиск |
| GET | `/api/stations/:id` | Детали + история |
| GET | `/api/stations/nearby?lat=&lng=` | Ближайшие |
| POST | `/api/reports` | Создать отчёт |
| GET | `/api/users/me/stats` | Репутация (fingerprint header) |

## Деплой на VPS

Пошаговый гайд для **Timeweb VPS** (Docker, SSL, бэкапы, Telegram-бот): **[docs/DEPLOY-TIMEWEB.md](docs/DEPLOY-TIMEWEB.md)**

Кратко:

1. Скопируйте проект, `cp deploy/.env.production.example .env` (смените пароли и домен)
2. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
3. Host nginx + certbot на порт 8090, бэкап `deploy/backup.sh`


## Устранение неполадок: Docker pull / EOF (РФ)

При `docker compose up` иногда обрывается загрузка образов с Docker Hub (`EOF`, `connection reset`, `timeout`). Это типично для нестабильного доступа к `registry-1.docker.io`.

### Быстрый обход (PostGIS)

```powershell
cd fuel-map
docker pull docker.m.daocloud.io/postgis/postgis:16-3.4
docker tag docker.m.daocloud.io/postgis/postgis:16-3.4 postgis/postgis:16-3.4
docker compose up -d --build
```

Либо укажите зеркало в `.env` (см. `.env.example`):

```env
POSTGIS_IMAGE=docker.m.daocloud.io/postgis/postgis:16-3.4
```

### Скрипт prefetch

```powershell
cd fuel-map
.\scripts\docker-pull-images.ps1
docker compose up -d --build
```

Скрипт тянет `postgis/postgis:16-3.4` (или значение `POSTGIS_IMAGE`), `node:22-alpine` и `nginx:alpine`: сначала Hub, при ошибке — зеркало DaoCloud.

### Если зеркало тоже не работает

- Подключите VPN или другой канал до Docker Hub и повторите pull.
- В Docker Desktop: **Settings → Docker Engine** — добавьте `registry-mirrors` (корпоративное или публичное зеркало вашего провайдера).
- Скачайте образ на другой машине, `docker save` / `docker load`, или используйте свой registry.


## Лицензия

Данные OSM — © OpenStreetMap contributors (ODbL). Код — MIT.
