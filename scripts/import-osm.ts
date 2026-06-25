import {
  RUSSIA_FUEL_QUERY,
  fetchOverpass,
} from './lib/overpass.js';
import {
  deduplicateStations,
  insertStationsBatch,
  parseOverpassElements,
} from './lib/stations.js';
import { closePool, getDatabaseUrl, query } from './lib/db.js';

const BATCH_SIZE = 500;
const DEDUP_RADIUS_M = 50;

async function main() {
  console.log('=== Russia OSM fuel station import ===');
  console.log(`Database: ${getDatabaseUrl().replace(/:[^:@]+@/, ':****@')}`);

  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM stations'
  );
  const existing = parseInt(rows[0].count, 10);
  if (existing > 0) {
    console.log(`Found ${existing} existing stations. Use CLEAR=1 to truncate before import.`);
    if (process.env.CLEAR !== '1') {
      await closePool();
      process.exit(0);
    }
  }

  const data = await fetchOverpass(RUSSIA_FUEL_QUERY, {
    label: 'Russia fuel',
    maxRetries: 6,
  });

  console.log('Parsing OSM elements...');
  const parsed = parseOverpassElements(data.elements);
  console.log(`Parsed ${parsed.length} fuel amenities`);

  console.log(`Deduplicating within ${DEDUP_RADIUS_M}m...`);
  const deduped = deduplicateStations(parsed, DEDUP_RADIUS_M);
  const removed = parsed.length - deduped.length;
  console.log(`After dedup: ${deduped.length} stations (${removed} duplicates removed)`);

  let lastPct = -1;
  const inserted = await insertStationsBatch(deduped, {
    batchSize: BATCH_SIZE,
    clearExisting: process.env.CLEAR === '1',
    onProgress: (done, total) => {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastPct + 10 || done === total) {
        lastPct = pct;
        console.log(`Insert progress: ${done}/${total} (${pct}%)`);
      }
    },
  });

  const { rows: finalRows } = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM stations'
  );
  const total = parseInt(finalRows[0].count, 10);

  console.log('=== Import complete ===');
  console.log(`Upserted rows this run: ${inserted}`);
  console.log(`Total stations in DB: ${total}`);
  console.log(`Expected Russia total: ~26,000 (varies with OSM coverage)`);

  await closePool();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await closePool();
  process.exit(1);
});
