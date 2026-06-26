# Telegram Mini App — настройка бота @Toplivo_map_bot

Бот и канал **@toplivo99** («Топливо России»): карта открывается через `Keyboard.webApp()` и Menu Button.

**Текущий URL карты:** `https://announced-cap-romantic-committee.trycloudflare.com`  
(меняется при перезапуске Cloudflare Quick Tunnel — см. `deploy/vnc-free-public-url.sh`)

**Архитектура:** см. `deploy/MINI-APP-BUILD-PLAN.md` (mermaid: парсер → PostgreSQL → API → Mini App)

---

## Mini App frontend (реализовано)

| Функция | Описание |
|---------|----------|
| `@twa-dev/sdk` | `ready()`, `expand()`, theme colors, haptic |
| MainButton | «Сообщить о топливе» — скролл к форме отчёта |
| BackButton | закрыть карточку АЗС |
| Брендинг | «Топливо России», ссылка @toplivo99 |
| Цены | из `/api/stations` → баннер + превью на карте |
| Telegram mobile | компактный header, фильтры 92/95/ДТ |

Цены приходят из таблицы `reports` (парсер benzin-price.ru + отчёты водителей). Отдельного `/api/prices` нет.

---

## 1. BotFather — Menu Button

1. Откройте [@BotFather](https://t.me/BotFather) → `/mybots`
2. Выберите **@Toplivo_map_bot** → **Bot Settings** → **Menu Button**
3. **Configure menu button**
   - **Text:** `Открыть карту`
   - **URL:** актуальный `WEB_APP_URL` из `.env` (сейчас trycloudflare URL выше)

> Бот при старте сам вызывает `setChatMenuButton(web_app)`. Если API отклонит URL — в логах будет fallback на `default`; тогда Menu Button настраивайте вручную в BotFather.

---

## 2. BotFather — Web App (/newapp)

Для полноценного Mini App в каталоге (опционально, для будущего):

1. `/newapp` → выберите @Toplivo_map_bot
2. **Title:** `Карта топлива`
3. **Description:** `Где есть и нет топлива на АЗС — отметки от водителей`
4. **Photo:** иконка 640×360 (можно `frontend/public/icons/`)
5. **Web App URL:** тот же `WEB_APP_URL`

---

## 3. Ограничения trycloudflare.com

| Проблема | Обход |
|----------|--------|
| BotFather **Edit Domains** не принимает `*.trycloudflare.com` | Menu Button через BotFather вручную; или только reply-кнопка `webApp` в боте (часто работает без домена) |
| URL туннеля сменился после перезапуска | `bash deploy/vnc-fix-bot-url.sh` на VPS → обновит `.env`, пересоберёт бота |
| Mini App не открывается из Menu Button | Удалите чат с ботом → `/start` → кнопка «🗺 Открыть карту» внизу |
| Нужен стабильный URL | Постоянный домен + Cloudflare Tunnel с именем (см. `deploy/cloudflare-tunnel-setup.md`) |

**Пока нет своего домена:** канал @toplivo99 ведёт на карту **только по HTTPS-ссылке**, без @бота. Бот — отдельный вход для Mini App и /nearby.

---

## 4. Деплой на VPS (VNC)

```bash
cd /opt/fuel-map
git pull
bash deploy/vnc-fix-bot-url.sh
```

Скрипт:
- прописывает `WEB_APP_URL` в `.env`
- пересобирает `telegram-bot` (`docker compose --profile telegram up -d --build`)
- в логах ищет `Menu button → web_app` или fallback

Проверка в Telegram:
1. Удалить чат с @Toplivo_map_bot
2. `/start`
3. Кнопка **«🗺 Открыть карту»** внизу → Mini App
4. Слева внизу у бота — **Menu Button «Открыть карту»** (если домен принят)

---

## 5. Редактирование закреплённого поста канала (message_id=2)

Пост без упоминания бота: `marketing/telegram/channel-posts/00-launch-official.md`

### Вариант A — скрипт (нужен `TELEGRAM_BOT_TOKEN` в `.env`, бот — админ канала)

```bash
cd /path/to/fuel-map
node scripts/edit-pinned-launch-post.mjs
```

Или явно:

```bash
node scripts/edit-channel-post.mjs \
  --message-id=2 \
  --file=marketing/telegram/channel-posts/00-launch-official.md
```

### Вариант B — вручную в Telegram

1. Канал @toplivo99 → закреплённый пост (обычно message_id=2)
2. **Изменить** → убрать блок «🤖 Бот: @Toplivo_map_bot»
3. В шагах оставить только ссылку на карту
4. Сохранить

### Обновить закреп + опубликовать notice об URL

```bash
node scripts/update-channel-url.mjs
```

---

## 6. Подключить бота к каналу позже

Когда будет постоянный домен:

1. BotFather → Edit Domains → добавить домен
2. `/newapp` или Menu Button с финальным URL
3. Вернуть строку про бота в пост канала (опционально)
4. Добавить бота админом канала (`marketing/telegram/channel-setup.md`)

---

## Переменные `.env`

```env
TELEGRAM_BOT_TOKEN=...
WEB_APP_URL=https://announced-cap-romantic-committee.trycloudflare.com
TELEGRAM_CHANNEL_URL=https://t.me/toplivo99
```
