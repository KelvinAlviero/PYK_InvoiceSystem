// Creates the tables from schema.sql on an empty database. Safe to re-run:
// it does nothing if the tables already exist.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from '../config.js';
import { pool } from '../db.js';

const { rows: [{ exists }] } = await pool.query("SELECT to_regclass('public.users') IS NOT NULL AS exists");

if (exists) {
    console.log('Tables already exist; nothing to do.');
} else {
    const schema = await fs.readFile(path.join(PROJECT_ROOT, 'schema.sql'), 'utf8');
    await pool.query(`BEGIN; ${schema}; COMMIT;`);
    console.log('Database schema created.');
}

await pool.end();
