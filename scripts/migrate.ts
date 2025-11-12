import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withClient } from '../src/db.js';

async function main() {
  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'migrations',
  );
  const entries = await readdir(migrationsDir);
  const migrations = entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => ({
      version: entry.replace(/\.sql$/, ''),
      filePath: path.join(migrationsDir, entry),
    }));

  if (migrations.length === 0) {
    console.log('No migrations found.');
    return;
  }

  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
        migration.version,
      ]);
      if ((applied.rowCount ?? 0) > 0) {
        console.log(`Skipping already applied migration ${migration.version}`);
        continue;
      }

      const sql = await readFile(migration.filePath, 'utf8');
      console.log(`Applying migration ${migration.version}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Migration ${migration.version} failed`, error);
        throw error;
      }
    }
  });

  console.log('Migrations complete.');
}

main().catch((error) => {
  console.error('Migration run failed', error);
  process.exit(1);
});
