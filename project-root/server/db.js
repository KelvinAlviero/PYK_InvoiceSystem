import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    max: 10
});

export function query(text, params) {
    return pool.query(text, params);
}

// Runs fn(client) inside BEGIN/COMMIT, rolling back if it throws.
export async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}
