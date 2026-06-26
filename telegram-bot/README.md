# Fuel Map — Telegram Bot

Минимальный бот для поиска ближайших АЗС и ссылки на веб-PWA для отчётов.

## Команды

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и список команд |
| `/nearby` | Запрос геолокации → 5 ближайших АЗС со статусом |
| `/report` | Ссылка на веб-приложение для отправки отчёта |

## Переменные окружения

```env
# Обязательно
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# URL backend API (по умолчанию http://localhost:3001/api)
API_URL=http://localhost:3001/api

# URL веб-PWA для команды /report и кнопок «Открыть карту»
# Без домена (Timeweb, HTTP снаружи заблокирован): Cloudflare Quick Tunnel
WEB_APP_URL=https://xxxx.trycloudflare.com
# После покупки домена: WEB_APP_URL=https://your-domain.ru

# Опционально: ID канала для уведомлений о новых отчётах
TELEGRAM_NOTIFY_CHANNEL_ID=-1001234567890
```

Получить токен: [@BotFather](https://t.me/BotFather) → `/newbot`.

## Запуск локально

```bash
cd telegram-bot
npm install
cp ../.env.example .env   # добавьте TELEGRAM_BOT_TOKEN
npm run dev
```

Убедитесь, что backend API запущен (`docker compose up api` или `npm run dev` в `backend/`).

## Уведомления в канал (stub)

Функция `notifyChannelNewReport()` в `src/api.ts` — точка интеграции для webhook.
Подключите вызов из backend после `POST /api/reports` или настройте отдельный webhook-сервис.

Пример вызова из backend (будущая интеграция):

```typescript
import { notifyChannelNewReport } from '../../telegram-bot/src/api.js';
await notifyChannelNewReport({ station_id, fuel_type, status });
```

## Docker (опционально)

Добавьте сервис в `docker-compose.yml`:

```yaml
  telegram-bot:
    build: ./telegram-bot
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      API_URL: http://api:3001/api
      WEB_APP_URL: ${WEB_APP_URL:-http://localhost:8090}
    depends_on:
      - api
    restart: unless-stopped
```
