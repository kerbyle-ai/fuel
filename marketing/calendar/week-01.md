# Неделя 01 — план growth (5-city launch wave)

> Координатор: `fuel-map-growth-coordinator`  
> Контекст: [CONTEXT.md](../CONTEXT.md)  
> Цели недели: первые репортёры в 5 городах, онбординг бота, без спама.

**Города волны (placeholder):** Город 1, Город 2, Город 3, Город 4, Город 5 — заменить в CONTEXT.md.

---

## Понедельник — «Запуск волны + онбординг»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Пост-анонс в канале: что такое карта, как добавить первую точку. Закреп с инструкцией бота. | 1 пост канала, 1 текст welcome бота → `queue/` |
| **fuel-map-social-outreach** | 3 нативных поста в авто-чатах **Город 1** (без копипасты): «кто на трассе — поделитесь точкой». | 3 черновика → `queue/` |
| **fuel-map-monetization-prep** | Документ «гипотезы монетизации v0»: что **не** монетизируем (кризис, базовая карта). | 1 memo → `queue/` |

**KPI фокус:** bot starts, первые репорты в Город 1.

---

## Вторник — «Первый репортёр в городе»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Серия «стань первым репортёром в {город}» — **Город 2**. CTA: `TELEGRAM_BOT`. | 1 пост + 1 stories-style короткий текст → `queue/` |
| **fuel-map-social-outreach** | Ответы на 5 релевантных тредов/постов про топливо в **Город 1–2** (helpful, не реклама). | 5 шаблонов ответа → `queue/` |
| **fuel-map-monetization-prep** | Список метрик для дашборда: reports/day, unique reporters, city coverage. | `assets/metrics-spec.md` draft → `queue/` |

**KPI фокус:** unique reporters, reports (7d).

---

## Среда — «Подтверди чужую точку»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Пост про репутацию: «подтвердил — помог соседу». Ссылка `WEB_APP_URL`. | 1 пост → `queue/` |
| **fuel-map-social-outreach** | VK/Threads: история «как я пользовался картой на объезде» (фиктивный водитель, disclaimer краудсорс). **Город 3**. | 2 поста → `queue/` |
| **fuel-map-monetization-prep** | Partner one-pager outline (АЗС, автоклубы) — без обещаний интеграций. | 1 outline → `queue/` |

**KPI фокус:** confirmations per report, retention D1 бота.

---

## Четверг — «Трасса и маршрут»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Пост «перед выездом — глянь карту, после — отметь». UTM `week-01-route`. | 1 пост → `queue/` |
| **fuel-map-social-outreach** | 5 outreach в regional drive-communities **Город 4** (личный тон, один CTA). | 5 DM/post drafts → `queue/` |
| **fuel-map-monetization-prep** | A/B идеи для будущего «pro» (не блокирует кризис): уведомления, offline PWA. | memo → `queue/` |

**KPI фокус:** reports on highways, cities live (4/5).

---

## Пятница — «Итоги недели + город 5»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Пост «неделя 1: спасибо репортёрам» + призыв в **Город 5**. Без выдуманных цифр — или «—» из KPI. | 1 пост → `queue/` |
| **fuel-map-social-outreach** | Подборка лучших community-reactions (скриншоты — только с разрешения). 2 поста recap. | 2 drafts → `queue/` |
| **fuel-map-monetization-prep** | Weekly monetization risk check: нет paywall messaging в queue. Sign-off list. | checklist → `queue/` |

**KPI фокус:** TG subs, queue approved vs rejected.

---

## Суббота — «Лёгкий контент»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Короткий FAQ: «данные от водителей, проверяйте на месте». | 1 пост → `queue/` |
| **fuel-map-social-outreach** | 2 helpful replies в чатах (без новых городов). | 2 drafts → `queue/` |
| **fuel-map-monetization-prep** | Пause / review only — обновить metrics-spec если есть данные от владельца. | note or skip |

**KPI фокус:** engagement, zero spam reports.

---

## Воскресенье — «Планирование week-02»

| Агент | Задачи | Deliverables |
|-------|--------|--------------|
| **fuel-map-telegram-growth** | Черновик 3 тем на след. неделю (не публиковать). | `queue/` prefix `draft-week02-` |
| **fuel-map-social-outreach** | Список 10 communities для week-02 по 5 городам. | spreadsheet-style md → `queue/` |
| **fuel-map-monetization-prep** | KPI gap vs 10k reporters — что нужно от product/owner. | 1 page → `queue/` |

**Координатор:** daily report вс week, dedupe всей очереди, draft `calendar/week-02.md` skeleton.

---

## Ежедневно (координатор)

- [ ] Briefs трём агентам по таблице дня
- [ ] Review `queue/` — dedupe, approve max 2 TG posts/day
- [ ] Append `calendar/kpi-log.md`
- [ ] Write `calendar/daily/YYYY-MM-DD-coordinator.md`
