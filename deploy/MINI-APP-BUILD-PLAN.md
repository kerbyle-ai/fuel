# Mini App «Топливо России» — план сборки

Канал: [@toplivo99](https://t.me/toplivo99) · Бот: [@Toplivo_map_bot](https://t.me/Toplivo_map_bot)

---

## Архитектура: парсинг → API → Mini App

```mermaid
flowchart LR
  subgraph Parser["Парсер (scripts/)"]
    BP[benzin-price.ru]
    PW[Playwright fetcher]
    IMP[import-benzin-price.ts]
    BP --> PW --> IMP
  end

  subgraph DB["PostgreSQL"]
    ST[(stations 25 560)]
    RP[(reports + prices)]
    BL[(benzin_station_links)]
    ST --- BL
    ST --- RP
  end

  subgraph Backend["Fastify API :3001"]
    API1["GET /api/stations?bbox=…"]
    API2["GET /api/stations/:id"]
    API3["POST /api/reports"]
  end

  subgraph Frontend["Vite React Leaflet"]
    TWA["@twa-dev/sdk"]
    MAP[FuelMap + Leaflet]
    POP[Station popup / bottom sheet]
    MB[MainButton «Сообщить о топливе»]
    TWA --> MAP --> POP
    TWA --> MB
  end

  subgraph Telegram["Telegram"]
    BOT[@Toplivo_map_bot]
    CH[@toplivo99]
    BOT -->|webApp URL| Frontend
    CH -->|HTTPS ссылка| Frontend
  end

  IMP -->|importPriceReport| RP
  IMP -->|match/upsert| ST
  IMP --> BL
  API1 --> MAP
  API2 --> POP
  API3 --> RP
```

---

## Поток данных цен

1. **Cron / Docker** (`price-importer`, каждые 2 ч) запускает `scripts/import-benzin-price.ts`
2. Парсер скачивает региональные страницы benzin-price.ru (Playwright)
3. Для каждой АЗС: `matchStationByProximity` → `importPriceReport` → запись в `reports` (status=available, price=₽)
4. Backend агрегирует отчёты за 7 дней в `fuel_status.price` (`/api/stations`, `/api/stations/:id`)
5. Mini App показывает цены в:
   - баннере «Цены на топливо» в карточке АЗС
   - превью над картой (Telegram mobile)
   - сетке статусов по типам топлива

Отчёты водителей идут тем же путём через `POST /api/reports`.

---

## Стек Mini App

| Слой | Технология |
|------|------------|
| UI | React 18 + Vite 6 |
| Карта | Leaflet + markercluster |
| Telegram | `@twa-dev/sdk` — `ready()`, `expand()`, theme, MainButton, BackButton |
| Брендинг | «Топливо России», канал @toplivo99 |
| Деплой | Docker nginx :8090, Cloudflare Quick Tunnel |

---

## Что реализовано в frontend

- `@twa-dev/sdk`: авто `expand()`, тема Telegram (light/dark)
- MainButton «Сообщить о топливе» при выборе АЗС
- BackButton закрывает карточку АЗС
- Компактный header для Telegram mobile (без sidebar)
- Фильтры 92/95/ДТ чипами на карте
- Превью цен выбранной АЗС
- Баннер цен в popup с пометкой benzin-price.ru
- Ссылка на канал @toplivo99

---

## Сборка и деплой (VNC)

```bash
cd /opt/fuel-map
git pull --ff-only origin main
bash deploy/vnc-github-update.sh
```

Скрипт пересобирает frontend, backend, бота; обновляет `WEB_APP_URL`.

### Проверка парсера и цен

```bash
cd /opt/fuel-map
bash deploy/run-benzin-import.sh          # полный импорт
# или тест одного региона:
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile importer run --rm price-importer -- --region 77 --delay 2000

# счётчики
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  psql -U fuelmap -d fuelmap -c "SELECT COUNT(*) FROM reports WHERE price IS NOT NULL;"

curl -s "http://127.0.0.1:8090/api/stations?bbox=37.3,55.5,37.9,55.9" | head -c 1500
```

### Проверка Mini App в Telegram

1. Удалить чат с @Toplivo_map_bot → `/start`
2. «🗺 Открыть карту» → полноэкранная карта
3. Тап по АЗС → цены + MainButton внизу
4. Канал: кнопка @toplivo99 в шапке

Подробнее: `deploy/BOT-MINIAPP-SETUP.md`, `deploy/VNC-PRICES-RU.md`
