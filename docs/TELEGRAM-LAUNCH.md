# Запуск Telegram-бота «Карта топлива»

Пошаговая инструкция: создание бота в BotFather, настройка окружения, деплой и привязка к каналу.

---

## 1. Создать бота в @BotFather

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте `/newbot`.
3. **Имя бота** (отображаемое): `Карта топлива`
4. **Username** (уникальный, заканчивается на `bot`):
   - `ToplivoBot` — короткий и запоминающийся *(рекомендуется)*
   - `Toplivo_map_bot` — если первый занят
   - `FuelMapRussia_bot` — альтернатива под канал @FuelMapRussia
5. BotFather пришлёт **токен** вида `1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. Скопируйте его — он понадобится один раз.

> Токен — секрет. Не коммитьте в git и не публикуйте в чатах.

---

## 2. Добавить токен в `.env`

В корне проекта (`fuel-map/`):

```bash
cp .env.example .env
```

Откройте `.env` и добавьте:

```env
TELEGRAM_BOT_TOKEN=1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
API_URL=http://localhost:3001/api
WEB_APP_URL=https://xxxx.trycloudflare.com
```

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather |
| `API_URL` | Backend API. Локально: `http://localhost:3001/api`. В Docker: `http://api:3001/api` |
| `WEB_APP_URL` | Публичный HTTPS URL веб-карты (PWA). **Без домена:** Cloudflare Quick Tunnel — `deploy/vnc-free-public-url.sh` на VPS → `https://xxxx.trycloudflare.com` (URL меняется при перезапуске туннеля). **С доменом:** `https://ваш-домен.ru` |
| `TELEGRAM_CHANNEL_URL` | *(опционально)* Ссылка на канал для кнопки в `/start`. По умолчанию `https://t.me/toplivo99` |
| `TELEGRAM_NOTIFY_CHANNEL_ID` | *(опционально)* ID канала для уведомлений о новых отчётах, напр. `-1001234567890` |

---

## 3. Описание и команды в BotFather

### Описание бота

```
/setdescription
```
Выберите бота → вставьте:

```
Бесплатная карта АЗС по России: где сейчас есть или нет топлива. Данные обновляют водители в реальном времени. Найдите АЗС рядом или отметьте статус на карте.
```

### Короткое описание (about)

```
/setabouttext
```

```
Карта топлива — краудсорсинговая карта АЗС. Бесплатно.
```

### Команды меню

```
/setcommands
```

```
start - Начать
nearby - АЗС рядом (отправьте геолокацию)
report - Открыть карту для отчёта
help - Список команд
```

### Аватар бота (опционально)

```
/setuserpic
```

Загрузите квадратное изображение 512×512 px. Исходник в проекте: `frontend/public/icons/icon.svg` (экспортируйте в PNG перед загрузкой).

---

## 4. Web App в BotFather (опционально)

Если хотите кнопку «Открыть приложение» прямо в профиле бота:

```
/newapp
```
или для существующего бота:
```
/myapps
```

- **Title:** Карта топлива
- **Description:** Карта АЗС с отметками наличия топлива
- **Photo:** тот же аватар
- **Web App URL:** `http://147.45.175.194:8090` (позже — ваш домен с HTTPS)

> Для production Telegram рекомендует HTTPS. После настройки домена и SSL обновите URL через `/myapps`.

Кнопки в командах `/start` и `/report` уже ведут на `WEB_APP_URL` — отдельный Web App в BotFather не обязателен для старта.

---

## 5. Локальный запуск бота

Бот автоматически читает `fuel-map/.env` (и при необходимости `telegram-bot/.env`).

```bash
cd telegram-bot
npm install
npm run build
npm start
```

Убедитесь, что backend запущен (`docker compose up -d db api` или см. `docs/WINDOWS-NO-DOCKER.md`).

**Windows (PowerShell):**

```powershell
cd telegram-bot
npm install
npm run build
npm start
```

Режим разработки с автоперезагрузкой:

```bash
npm run dev
```

### Быстрая проверка без Telegram

```bash
# getMe (подставьте токен из .env)
curl "https://api.telegram.org/bot<TOKEN>/getMe"

# nearby через API (backend на :3001)
curl "http://localhost:3001/api/stations/nearby?lat=55.75&lng=37.62&radius=10000"
```

Проверка в Telegram:
1. Найдите бота [@Toplivo_map_bot](https://t.me/Toplivo_map_bot).
2. `/start` — приветствие, кнопки «Открыть карту» и «Канал».
3. `/nearby` → «Отправить геолокацию» → список до 5 ближайших АЗС со ссылками на карту.
4. `/report` → кнопка перехода на веб-карту.
5. `/help` — список команд.

---

## 6. Деплой: Docker Compose или systemd

### Вариант A — Docker Compose (профиль `telegram`)

В `docker-compose.yml` добавлен сервис `telegram-bot`. Запуск вместе со стеком:

```bash
# из корня fuel-map/
docker compose --profile telegram up -d --build
```

Переменные берутся из `.env`. Внутри Docker:
- `API_URL=http://api:3001/api`
- `WEB_APP_URL` — из `.env` (публичный URL карты)

Остановить только бота:

```bash
docker compose --profile telegram stop telegram-bot
```

Логи:

```bash
docker compose logs -f telegram-bot
```

### Вариант B — systemd на VPS

Файл готов: `deploy/fuel-map-bot.service`

```bash
# на сервере, после git clone в /opt/fuel-map
cd /opt/fuel-map/telegram-bot
npm install && npm run build

sudo cp /opt/fuel-map/deploy/fuel-map-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fuel-map-bot
sudo systemctl start fuel-map-bot
sudo systemctl status fuel-map-bot
```

Логи: `journalctl -u fuel-map-bot -f`

Сервис читает `/opt/fuel-map/.env` и обращается к API через nginx на `127.0.0.1:8090`.

---

## 7. Production: `WEB_APP_URL`

Перед публичным запуском канала установите в `.env` актуальный адрес карты.

### Без домена (Timeweb, inbound HTTP заблокирован)

На VNC VPS выполните скрипт из репозитория:

```bash
cd /opt/fuel-map && git pull origin main
bash deploy/vnc-free-public-url.sh
```

Скрипт поднимает Cloudflare Quick Tunnel → `https://xxxx.trycloudflare.com`, прописывает `WEB_APP_URL` и `ALLOWED_ORIGINS`, перезапускает API и бота.

> **Важно:** URL `trycloudflare.com` **меняется** при `systemctl restart cloudflared-quick`. После перезапуска скопируйте новый URL из `journalctl -u cloudflared-quick` и обновите `.env`.

Ручной one-liner (тест, без автозапуска):

```bash
cloudflared tunnel --url http://127.0.0.1:8090
```

Альтернатива: `ngrok http 8090` (нужен аккаунт ngrok.com).

### С доменом

```env
WEB_APP_URL=https://fuelmap.ru
```

Перезапустите бота после смены URL:

```bash
# Docker
docker compose --profile telegram up -d --build telegram-bot

# systemd
sudo systemctl restart fuel-map-bot
```

---

## 8. Привязка к каналу

См. `marketing/telegram/channel-setup.md`:
- создать канал @FuelMapRussia (или аналог);
- добавить бота администратором;
- закрепить первый пост из `marketing/telegram/channel-posts/00-launch-official.md`.

---

## Чеклист перед анонсом

- [ ] Токен в `.env`, бот отвечает на `/start`
- [ ] `WEB_APP_URL` указывает на рабочую карту
- [ ] `/nearby` возвращает АЗС (API запущен)
- [ ] Команды и описание настроены в BotFather
- [ ] Канал создан, первый пост опубликован и закреплён
- [ ] Бот — админ канала (для будущих уведомлений)

---

## Устранение неполадок

| Симптом | Причина | Решение |
|---------|---------|---------|
| `TELEGRAM_BOT_TOKEN is required` | `.env` не загружен | Запускайте из `telegram-bot/` после `npm run build` — бот читает `fuel-map/.env` автоматически |
| Бот не отвечает в Telegram | Процесс не запущен или второй экземпляр конфликтует | Один процесс polling: `npm start` или Docker `telegram-bot`. Остановите дубликаты |
| «Не удалось подключиться к серверу карты» | Backend API не запущен | `docker compose up -d db api` или локальный backend на `:3001` |
| `/nearby` — пустой список | В радиусе 10 км нет АЗС в БД | Нормально для редких регионов; проверьте API: `GET /api/stations/nearby?lat=55.75&lng=37.62&radius=10000` |
| Кнопка Web App в BotFather | Нужен HTTPS | До SSL используйте inline-кнопки «Открыть карту» (уже в `/start` и `/report`) |

---

## Полезные ссылки

- Канал (шаблон): @FuelMapRussia
- Бот (шаблон): @ToplivoBot
- Boosty: https://boosty.to/toplivo
- Первый пост: `marketing/telegram/channel-posts/00-launch-official.md`
