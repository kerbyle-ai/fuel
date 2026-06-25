---
type: bot
trigger: daily-digest
status: ready
title: "Daily digest (push to subscribers)"
---

📊 *Сводка за {date}*

*{city_or_federal}*
🟢 Отчётов «есть»: {green_count}
🔴 Отчётов «нет»: {red_count}
🏆 Fuel Hero дня: {hero_name} ({hero_reports} отч.)

*Где чаще отмечали «есть»:*
1. {area_1}
2. {area_2}
3. {area_3}

Данные от пользователей — проверяйте на месте.

📍 Открыть карту:
{WEB_APP_URL}?utm_source=telegram&utm_medium=bot&utm_campaign=fuel_{city}

/nearby — ближайшие АЗС сейчас
/report — отправить отчёт

Подписка на дайджест: /digest on | off
