# Маркетинг «Карта топлива» — как запускать агентов

Краткая инструкция для ежедневного growth-цикла. Полный контекст продукта — в [CONTEXT.md](CONTEXT.md).

## Быстрый старт (утро, ~15–30 мин)

1. **Координатор** — главная точка входа:
   ```
   Запусти daily growth по fuel-map-growth-coordinator
   ```
   Или в Cursor: skill `fuel-map-growth-coordinator` / agent `fuel-map-growth-coordinator`.

2. Координатор читает `CONTEXT.md`, срез из `calendar/week-NN.md` и выдаёт **брифы** трём агентам.

3. **Запустите sibling-агентов** (отдельные чаты или subagents):
   - `fuel-map-telegram-growth` — посты канала, тексты бота
   - `fuel-map-social-outreach` — VK, Threads, авто-сообщества
   - `fuel-map-monetization-prep` — материалы под будущую монетизацию (без paywall кризиса)

4. Каждый агент сохраняет черновики в **`queue/`** по шаблону:
   `YYYY-MM-DD-{agent}-{slug}.md`

5. Снова **координатор**: merge очереди, дедуп, approve → handoff на публикацию.

6. После публикации перенести файл в **`published/`**.

## Структура папок

| Папка | Назначение |
|-------|------------|
| `queue/` | Ожидают ревью / публикации |
| `published/` | Архив опубликованного |
| `calendar/` | Недельные планы (`week-01.md`, …), daily-отчёты, KPI |
| `assets/` | UTM-ссылки, фирменные формулировки |

**Telegram `channel-posts/`:** YAML frontmatter (`--- ... ---`) — только внутренний учёт, в канал не публикуется. См. `telegram/channel-setup.md`.

## Еженедельно (понедельник)

- Обновить или создать `calendar/week-NN.md` на новую неделю.
- Проверить KPI в `calendar/kpi-log.md` (создаёт координатор).
- Уточнить 5 городов волны запуска в `CONTEXT.md`, если изменились.

## Перед первым запуском

1. Заполнить в `CONTEXT.md`:
   - `WEB_APP_URL`
   - `TELEGRAM_BOT`
   - `TELEGRAM_CHANNEL`
   - список 5 городов волны
2. Скопировать UTM из `assets/utm-links.md` после подстановки домена.

## KPI (цели playbook)

- **10 000** активных репортёров
- **5 городов** в первой волне
- Продукт **бесплатный**; кризисная информация **не** за paywall

## Правила для всех агентов

- Не выдумывать цены и наличие топлива
- Тон: водитель помогает водителю
- Указывать, что данные краудсорсинговые

## Где лежат skill и agent

- Skill: `c:\Users\user\.cursor\skills\fuel-map-growth-coordinator\SKILL.md`
- Agent: `C:\Users\user\.claude\agents\fuel-map-growth-coordinator.md`
