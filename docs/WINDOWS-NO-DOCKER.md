# Windows: запуск без Docker (npm + PostgreSQL)

Если `docker pull` падает с **EOF**, **connection reset** или **timeout** на `registry-1.docker.io`, `auth.docker.io` и зеркалах (в т.ч. **daocloud** — не путать с опечаткой `doacloud`), приложение можно поднять **полностью без скачивания образов Docker**.

На этой машине **PostgreSQL не найден в PATH** (`psql` отсутствует, служба PostgreSQL не обнаружена). Сначала установите БД по шагам ниже.

## Что получится

| Компонент | Как запускается |
|-----------|-----------------|
| PostgreSQL 16 + PostGIS | Установщик EDB / Stack Builder |
| Backend API | `npm run dev` в `backend/` |
| Frontend (карта) | `npm run dev` в `frontend/` |
| URL карты | **http://127.0.0.1:5173** |
| API (health) | http://127.0.0.1:3001/api/health |

Vite проксирует `/api` на порт 3001 — отдельный nginx не нужен.

---

## 1. Node.js

Нужен **Node.js 20+** (LTS или новее).

```powershell
node --version
npm --version
```

Если команды нет — установите с https://nodejs.org/

---

## 2. PostgreSQL 16 для Windows

1. Скачайте установщик: https://www.postgresql.org/download/windows/
2. Запустите **EDB installer** (PostgreSQL 16).
3. Запомните пароль суперпользователя `postgres` — запомните пароль (понадобится для миграций).

### PostGIS (обязательно)

Миграции выполняют `CREATE EXTENSION postgis`. Без PostGIS backend не стартует.

**Вариант A — Stack Builder** (рекомендуется):

- После установки PostgreSQL откройте **Stack Builder** из меню Пуск.
- Выберите установленный сервер → категория **Spatial Extensions** → **PostGIS**.

**Вариант B — отдельный bundle**

- Установите пакет PostGIS, совместимый с PostgreSQL 16, если Stack Builder недоступен.

---

## 3. База и пользователь

Откройте **«SQL Shell (psql)»** или PowerShell (путь к `psql` часто такой):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

В psql (подставьте свой пароль `postgres`):

```sql
CREATE USER fuelmap WITH PASSWORD 'fuelmap_secret';
CREATE DATABASE fuelmap OWNER fuelmap;
\c fuelmap
GRANT ALL ON SCHEMA public TO fuelmap;
ALTER DATABASE fuelmap OWNER TO fuelmap;
```

Расширение PostGIS можно включить сразу (от имени `postgres`):

```sql
\c fuelmap
CREATE EXTENSION IF NOT EXISTS postgis;
```

Либо миграция создаст extension при первом `npm run migrate` — для этого пользователю `fuelmap` нужны права суперпользователя **или** extension уже создано шагом выше.

---

## 4. Переменные окружение

В корне проекта (при необходимости скопируйте `.env` из `.env.example`):
```powershell
# PowerShell — из корня fuel-map
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"
```

При необходимости создайте файл `.env` в корне (скопируйте из `.env.example`) с тем же `DATABASE_URL`.

---

## 5. Автоматический старт (скрипт)

Из корня репозитория:

```powershell
cd C:\users\user\.cursor\fuel-map
.\scripts\start-windows-dev.ps1
```

С флагом `-StartServers` — откроет два окна терминала с backend и frontend:

```powershell
.\scripts\start-windows-dev.ps1 -StartServers
```

Без флага скрипт выполнит migrate и seed и выведет команды для двух терминалов.

---

## 6. Ручной запуск (два терминала)

**Терминал 1 — backend:**

```powershell
cd C:\users\user\.cursor\fuel-map\backend
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"
npm run migrate
npm run seed
npm run dev
```

**Терминал 2 — frontend:**

```powershell
cd C:\users\user\.cursor\fuel-map\frontend
npm run dev
```

Откройте **http://127.0.0.1:5173** — на карте Москвы должны появиться ~100 тестовых АЗС после seed.

Проверка API:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
```

---

## 7. Если Docker всё же нужен (pull не обязателен для dev)

### DNS в Docker Desktop

**Settings → Docker Engine**, добавьте или дополните JSON:

```json
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
```

Нажмите **Apply & Restart**.

### VPN

Часто помогает VPN с выходом в регион, где Docker Hub доступен, затем обычный `docker compose up db -d` только для БД (опционально).

### Зеркало PostGIS (имя **daocloud**, не doacloud)

```powershell
docker pull docker.m.daocloud.io/postgis/postgis:16-3.4
docker tag docker.m.daocloud.io/postgis/postgis:16-3.4 postgis/postgis:16-3.4
```

### Образ без pull с другой машины

На ПК, где pull работает:

```powershell
docker save postgis/postgis:16-3.4 -o postgis-16-3.4.tar
```

Скопируйте `.tar` на эту машину и:

```powershell
docker load -i postgis-16-3.4.tar
```

---

## Устранение проблем

| Симптом | Решение |
|--------|---------|
| `psql` не найден | Установите PostgreSQL 16 и добавьте `...\PostgreSQL\16\bin` в PATH |
| `extension "postgis" does not exist` | Установите PostGIS через Stack Builder |
| `password authentication failed` | Проверьте пароль в `DATABASE_URL` |
| Пустая карта | Выполните `npm run seed` в `backend/` |
| Порт 5432 занят | Другой PostgreSQL или старый Docker `db` — смените порт в URL |

---

## Команды «сегодня» (кратко)

После установки PostgreSQL 16 + PostGIS и создания БД:

```powershell
cd C:\users\user\.cursor\fuel-map
.\scripts\start-windows-dev.ps1 -StartServers
```

Либо вручную migrate/seed/dev — см. раздел 6.
