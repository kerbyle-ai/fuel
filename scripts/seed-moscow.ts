import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  MOSCOW_BBOX_QUERY,
  fetchOverpass,
} from './lib/overpass.js';
import {
  deduplicateStations,
  insertStationsBatch,
  parseOverpassElements,
  type StationInput,
} from './lib/stations.js';
import { closePool, getDatabaseUrl, query } from './lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'moscow-stations.json');
const TARGET_COUNT = 100;
const BATCH_SIZE = 500;

async function loadFromJson(): Promise<StationInput[]> {
  if (!existsSync(DATA_FILE)) {
    throw new Error(`Missing ${DATA_FILE}. Run: npm run seed:fetch`);
  }
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as StationInput[];
  return deduplicateStations(raw, 50);
}

async function fetchMoscowFromOverpass(): Promise<StationInput[]> {
  const data = await fetchOverpass(MOSCOW_BBOX_QUERY, { label: 'Moscow bbox' });
  const parsed = parseOverpassElements(data.elements);
  const deduped = deduplicateStations(parsed, 50);
  const trimmed = deduped.slice(0, TARGET_COUNT);
  writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  console.log(`Wrote ${trimmed.length} stations to ${DATA_FILE}`);
  return trimmed;
}

async function main() {
  const fetchMode = process.argv.includes('--fetch');

  console.log('=== Moscow / MO gas station seed ===');
  console.log(`Database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':****@')}`);

  let stations: StationInput[];

  if (fetchMode) {
    stations = await fetchMoscowFromOverpass();
  } else {
    stations = await loadFromJson();
    console.log(`Loaded ${stations.length} stations from ${DATA_FILE}`);
  }

  if (stations.length === 0) {
    throw new Error('No stations to seed');
  }

  const clear = process.env.CLEAR === '1';
  if (!clear) {
    const { rows } = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM stations'
    );
    const existing = parseInt(rows[0].count, 10);
    if (existing > 0) {
      console.log(`${existing} stations already in DB. Set CLEAR=1 to replace. Skipping insert.`);
      await closePool();
      return;
    }
  }

  const inserted = await insertStationsBatch(stations, {
    batchSize: BATCH_SIZE,
    clearExisting: clear,
    onProgress: (done, total) => {
      if (done === total || done % BATCH_SIZE === 0) {
        console.log(`Insert progress: ${done}/${total}`);
      }
    },
  });

  const { rows: finalRows } = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM stations'
  );

  console.log('=== Seed complete ===');
  console.log(`Inserted/updated: ${inserted}`);
  console.log(`Total in DB: ${finalRows[0].count}`);
  console.log(`Expected Moscow seed: ~${TARGET_COUNT} stations`);

  await closePool();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await closePool();
  process.exit(1);
});
