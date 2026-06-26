import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  if (process.env.SKIP_MIGRATE === '1' || process.env.SKIP_MIGRATE === 'true') {
    console.log('SKIP_MIGRATE set, skipping migrations');
    return;
  }

  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  const migrationsDir = join(__dirname, '..', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('Migrations complete');
  await closePool();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
