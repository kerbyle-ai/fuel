# UTM-ссылки — «Карта топлива»

Замените `WEB_APP_URL`, `TELEGRAM_BOT`, `TELEGRAM_CHANNEL` на реальные URL перед использованием.

## Шаблон

```
{BASE_URL}?utm_source={source}&utm_medium={medium}&utm_campaign={campaign}&utm_content={content}
```

## Канал Telegram

| Кампания | Ссылка |
|----------|--------|
| week-01-launch | `TELEGRAM_CHANNEL` + `?utm_source=telegram&utm_medium=channel&utm_campaign=week-01-launch` |
| week-01-route | `WEB_APP_URL?utm_source=telegram&utm_medium=channel&utm_campaign=week-01-route` |
| bot-onboarding | `TELEGRAM_BOT` + `?start=utm_week01` (если бот поддерживает deep link) |

## Соцсети / outreach

| Источник | medium | campaign | content пример |
|----------|--------|----------|----------------|
| vk | community | week-01-launch | city1-autochat |
| threads | post | week-01-launch | driver-story-01 |
| telegram | dm | week-01-outreach | personal-invite |

Пример PWA:

```
WEB_APP_URL?utm_source=vk&utm_medium=community&utm_campaign=week-01-launch&utm_content=city1-autochat
```

## Правила

- Один `utm_campaign` на неделю (`week-NN-*`)
- `utm_content` = город или slug поста — для дедупа аналитики
- Не менять UTM у уже опубликованных постов — добавлять новый content
