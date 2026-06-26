# Fuel Map — Data Import Scripts

Scripts for seeding and importing gas station data into PostgreSQL/PostGIS.

## Prerequisites

1. Start the database (from project root):

```bash
docker compose up -d db
```

2. Install script dependencies:

```bash
cd scripts
npm install
```

3. Set `DATABASE_URL` (host machine uses `localhost`, not `db`):

```bash
# Windows PowerShell
$env:DATABASE_URL = "postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap"

# Linux/macOS
export DATABASE_URL=postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap
```

Run migrations if the DB is fresh (docker init usually applies `backend/migrations` automatically):

```bash
npm run migrate
```

## Commands

| Command | Description | Expected rows |
|---------|-------------|---------------|
| `npm run seed` | Load ~100 Moscow/MO stations from `data/moscow-stations.json` | **~100** |
| `npm run seed:fetch` | Fetch Moscow bbox from Overpass, write JSON, then seed | **~100–400** (bbox) |
| `npm run generate-seed` | Generate synthetic JSON → `backend/seed-data/seed-moscow.json` (Docker auto-seed) | **100** |
| `npm run import:osm` | Full Russia import via Overpass (`amenity=fuel`) | **~26,000** |
| `npm run import:benzin-price` | Prices from [benzin-price.ru](https://www.benzin-price.ru/) (Playwright) | varies by region |

### Moscow seed (local dev)

```bash
npm run seed
```

- Reads curated/fetched data from `data/moscow-stations.json`
- Skips if stations already exist (use `CLEAR=1` to replace)
- Deduplicates within 50m before insert
- Batch inserts (500 rows per query)

Refresh JSON from Overpass:

```bash
npm run seed:fetch
```

### Full Russia OSM import

```bash
npm run import:osm
```

**Warning:** This queries the public Overpass API for all Russian fuel stations. It can take **5–15+ minutes**, may hit rate limits (retries with backoff), and loads **~26k** rows.

```bash
# Replace all existing stations
CLEAR=1 npm run import:osm
```

Overpass query used:

```
[out:json][timeout:300];
area["ISO3166-1"="RU"]->.ru;
(nwr["amenity"="fuel"](area.ru););
out center;
```

## Data fields

| Field | Source |
|-------|--------|
| `name` | `tags.name`, else brand/operator, else `АЗС` |
| `brand` | `tags.brand`, `operator`, `network`, `company` |
| `lat`, `lng` | node coords or `center` for ways/relations |
| `osm_id` | Signed OSM id (node `+id`, way `-id`, relation `-(id+1e9)`) |
| `region` | `addr:state`, `addr:region`, Moscow bbox fallback |
| `location` | PostGIS `GEOGRAPHY(POINT, 4326)` |

## Deduplication

Stations within **50 meters** are merged. The entry with richer metadata (brand, name, region) is kept.

### benzin-price.ru price import

Imports per-station prices via headless browser (site uses JS anti-bot gate).

```bash
# Moscow only, dry run (no DB writes)
npm run import:benzin-price -- --region 77 --dry-run

# Moscow + MO + Krasnodar
npm run import:benzin-price -- --region 77,50,23

# All preset regions
npm run import:benzin-price -- --region all
```

Requires `npx playwright install chromium` once after `npm install`.

**Автоимпорт каждые 2 часа (Windows, локальная БД):**

```powershell
powershell -ExecutionPolicy Bypass -File install-import-scheduler.ps1
```

**VPS:** `bash deploy/install-price-import-cron.sh` (Docker + cron, см. `deploy/VNC-GITHUB-DEPLOY.md`).

**Legal note:** [benzin-price.ru](https://www.benzin-price.ru/) prohibits automated parsing without written permission. Use low request rate (`--delay 2000`).

## Environment

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://fuelmap:fuelmap_secret@localhost:5432/fuelmap` |
| `CLEAR` | `1` truncates `stations` before import |

Matches `docker-compose.yml` credentials; use `@localhost:5432` when running scripts on the host.
