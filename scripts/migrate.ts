import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closePool, getDatabaseUrl, getPool } from './lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'backend', 'migrations');

async function migrate() {
  console.log(`Running migrations against ${getDatabaseUrl().replace(/:[^:@]+@/, ':****@')}`);

  const pool = getPool();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`  → ${file}`);
    await pool.query(sql);
  }

  console.log('Migrations complete');
  await closePool();
}

migrate().catch(async (err) => {
  console.error('Migration failed:', err);
  await closePool();
  process.exit(1);
});
