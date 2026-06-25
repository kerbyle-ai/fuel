import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closePool, query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedStation {
  name: string;
  brand?: string;
  lat: number;
  lng: number;
  osm_id: number;
  region: string;
}

const FALLBACK_STATIONS: SeedStation[] = [
  {
    name: 'Лукойл',
    brand: 'Лукойл',
    lat: 55.7558,
    lng: 37.6173,
    osm_id: 100001,
    region: 'Москва',
  },
  {
    name: 'Газпромнефть',
    brand: 'Газпромнефть',
    lat: 55.7512,
    lng: 37.6184,
    osm_id: 100002,
    region: 'Москва',
  },
  {
    name: 'Роснефть',
    brand: 'Роснефть',
    lat: 55.7601,
    lng: 37.6256,
    osm_id: 100003,
    region: 'Москва',
  },
  {
    name: 'Татнефть',
    brand: 'Татнефть',
    lat: 55.7489,
    lng: 37.6051,
    osm_id: 100004,
    region: 'Москва',
  },
  {
    name: 'Shell',
    brand: 'Shell',
    lat: 55.7634,
    lng: 37.6389,
    osm_id: 100005,
    region: 'Москва',
  },
];

function loadStations(): SeedStation[] {
  const candidates = [
    join(__dirname, '..', 'seed-data', 'seed-moscow.json'),
    join(__dirname, '..', '..', 'scripts', 'seed-moscow.json'),
  ];
  for (const seedPath of candidates) {
    if (existsSync(seedPath)) {
      return JSON.parse(readFileSync(seedPath, 'utf-8')) as SeedStation[];
    }
  }
  console.log('seed-moscow.json not found, using fallback Moscow stations');
  return FALLBACK_STATIONS;
}

async function seed() {
  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM stations'
  );
  if (parseInt(rows[0].count, 10) > 0) {
    console.log('Stations already seeded, skipping');
    await closePool();
    return;
  }

  const stations = loadStations();
  console.log(`Seeding ${stations.length} stations...`);

  for (const s of stations) {
    await query(
      `INSERT INTO stations (name, brand, lat, lng, location, osm_id, region)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6)
       ON CONFLICT (osm_id) DO NOTHING`,
      [s.name, s.brand || null, s.lat, s.lng, s.osm_id, s.region]
    );
  }

  const { rows: stationRows } = await query<{ id: number }>(
    'SELECT id FROM stations LIMIT 10'
  );
  const { rows: fuelRows } = await query<{ id: number; code: string }>(
    'SELECT id, code FROM fuel_types'
  );

  const statuses = ['available', 'unavailable', 'unknown'] as const;
  const queues = ['none', 'short', 'long', 'unknown'] as const;

  for (const st of stationRows) {
    for (const ft of fuelRows.slice(0, 3)) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await query(
        `INSERT INTO reports (station_id, fuel_type_id, status, price, queue_status, user_fingerprint, weight)
         VALUES ($1, $2, $3, $4, $5, 'seed', 1.0)`,
        [
          st.id,
          ft.id,
          status,
          status === 'available' ? 52.5 + Math.random() * 10 : null,
          queues[Math.floor(Math.random() * queues.length)],
        ]
      );
    }
  }

  console.log('Seed complete');
  await closePool();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
