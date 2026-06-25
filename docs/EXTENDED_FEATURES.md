# Extended Features — Fuel Map MVP

Дополнительные модули к core MVP: anti-spam, репутация, Telegram-бот, PWA.

## 1. Anti-spam

**Файлы:** `backend/src/services/rateLimit.ts`, `backend/src/routes/reports.ts`

| Правило | Реализация |
|---------|------------|
| IP rate limit 10/час | `checkIpReportRateLimit(ip)` → таблица `rate_limits`, ключ `ip:{ip}` |
| Дубликат station+fuel 15 мин | `hasDuplicateReport()` по `user_fingerprint` |
| Honeypot | Поля `website` / `_hp` должны быть пустыми |

Ответы: `429` (лимит), `409` (дубликат), `400` (honeypot).

## 2. Reputation System

**Файлы:** `backend/src/services/reputation.ts`, `backend/src/services/users.ts`, `backend/migrations/002_reputation.sql`

| Событие | Очки |
|---------|------|
| Каждый отчёт | +5 |
| Первый на АЗС за 24ч | +10 |
| Противоречие за 1ч | −20 автору противоположного отчёта |

- Fingerprint: заголовок `x-user-fingerprint` (фронт: `localStorage` UUID)
- Вес отчёта: `0.5 + min(reputation/100, 1.5)`
- Ранги: **Новичок** (<50 очк. / <5 отч.), **Активист** (≥50 / ≥5), **Эксперт** (≥150 / ≥30)

**API:** `GET /api/users/me/stats` → `{ stats: { reports_count, reputation, rank, weight } }`

**UI:** `frontend/src/components/ReputationBadge.tsx` в сайдбаре.

## 3. Telegram Bot

**Папка:** `telegram-bot/` (grammY)

- `/start`, `/nearby` (геолокация → 5 АЗС), `/report` (ссылка на PWA)
- `notifyChannelNewReport()` — stub для канала

См. `telegram-bot/README.md`.

## 4. PWA Enhancements

- `frontend/public/offline.html` — fallback без сети
- `frontend/vite.config.ts` — `navigateFallback: '/offline.html'`
- `frontend/index.html` — mobile meta, `theme-color`, manifest link

## Env vars

```env
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=3600000
DUPLICATE_REPORT_WINDOW_MS=900000
TELEGRAM_BOT_TOKEN=
API_URL=http://localhost:3001/api
WEB_APP_URL=http://localhost:8090
TELEGRAM_NOTIFY_CHANNEL_ID=
```

## Integration Points

1. **Frontend → API:** все отчёты шлют `x-user-fingerprint` + honeypot `website: ''`
2. **POST /api/reports:** anti-spam → upsert user → insert report → reputation
3. **Telegram bot → API:** `GET /api/stations/nearby?lat=&lng=&radius=10000`
4. **Channel notify (future):** вызов `notifyChannelNewReport()` после создания отчёта
