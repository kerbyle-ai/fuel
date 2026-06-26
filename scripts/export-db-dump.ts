#!/usr/bin/env tsx
/** Export stations + reports as SQL for VPS restore. */
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { getPool, closePool } from './lib/db.js';

async function main() {
  const outPath = process.argv[2] ?? '../deploy/fuelmap-backup.sql.gz';
  const pool = getPool();
  const client = await pool.connect();

  const lines: string[] = [
    'BEGIN;',
    'SET session_replication_role = replica;',
    'TRUNCATE reports RESTART IDENTITY CASCADE;',
  ];

  const { rows: reports } = await client.query<{
    station_id: number;
    fuel_type_id: number;
    status: string;
    price: string | null;
    queue_status: string;
    limit_liters: number | null;
    comment: string | null;
    user_fingerprint: string | null;
    weight: string;
    created_at: Date;
  }>(
    `SELECT station_id, fuel_type_id, status, price, queue_status,
            limit_liters, comment, user_fingerprint, weight, created_at
     FROM reports ORDER BY id`
  );

  for (const r of reports) {
    const price = r.price === null ? 'NULL' : r.price;
    const limit = r.limit_liters === null ? 'NULL' : String(r.limit_liters);
    const comment = r.comment === null ? 'NULL' : `'${r.comment.replace(/'/g, "''")}'`;
    const fp = r.user_fingerprint === null ? 'NULL' : `'${r.user_fingerprint.replace(/'/g, "''")}'`;
    lines.push(
      `INSERT INTO reports (station_id, fuel_type_id, status, price, queue_status, limit_liters, comment, user_fingerprint, weight, created_at) VALUES (${r.station_id}, ${r.fuel_type_id}, '${r.status}', ${price}, '${r.queue_status}', ${limit}, ${comment}, ${fp}, ${r.weight}, '${r.created_at.toISOString()}');`
    );
  }

  lines.push('SET session_replication_role = DEFAULT;', 'COMMIT;');

  const sql = lines.join('\n');
  const gzip = createGzip();
  const out = createWriteStream(outPath);
  await pipeline(
    async function* () {
      yield sql;
    },
    gzip,
    out
  );

  const { rows: counts } = await client.query<{ stations: string; reports: string }>(
    `SELECT (SELECT COUNT(*)::text FROM stations) AS stations,
            (SELECT COUNT(*)::text FROM reports) AS reports`
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Stations in DB: ${counts[0].stations}, reports exported: ${reports.length} (total ${counts[0].reports})`);

  client.release();
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
