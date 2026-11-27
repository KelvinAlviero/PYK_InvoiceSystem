// Applies the SQL files in server/migrations/ in order (001_, 002_, ...), each exactly
// once, recording what ran in schema_migrations. Runs on every deploy (npm prestart),
// so adding a new numbered .sql file is all it takes to change the database.
// Never edit a migration that has already run in production: add a new one instead.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from '../config.js';
import { pool } from '../db.js';

const migrationsDir = path.join(PROJECT_ROOT, 'server', 'migrations');

await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
`);

// Databases created before migrations existed already have 001's tables.
const { rows: [{ has_users, migration_count }] } = await pool.query(`
    SELECT to_regclass('public.users') IS NOT NULL AS has_users,
           (SELECT count(*) FROM schema_migrations)::int AS migration_count
`);
if (has_users && migration_count === 0) {
    await pool.query("INSERT INTO schema_migrations (name) VALUES ('001_initial.sql')");
    console.log('Existing database detected: marked 001_initial.sql as applied.');
}

const applied = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
const files = (await fs.readdir(migrationsDir)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();

let ranAny = false;
for (const name of files) {
    if (applied.has(name)) {
        continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`Applied migration ${name}.`);
        ranAny = true;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Migration ${name} failed; nothing from it was applied.`);
        throw error;
    } finally {
        client.release();
    }
}

if (!ranAny) {
    console.log('Database is up to date.');
}

await pool.end();
