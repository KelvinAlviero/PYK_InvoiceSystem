import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(serverDir, '..');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env (locally) or add a Postgres service (Railway).');
}

export const config = {
    port: Number(process.env.PORT) || 3000,
    isProduction: process.env.NODE_ENV === 'production',
    databaseUrl: process.env.DATABASE_URL,
    // Railway's public Postgres URL needs SSL; its private (*.railway.internal) one does not.
    databaseSsl: process.env.DATABASE_SSL === 'true',
    // Where uploaded PDFs are written. On Railway, point this at a mounted volume (e.g. /data/uploads),
    // otherwise every redeploy wipes the files.
    uploadDir: path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || 'server/data/uploads'),
    sessionHours: Number(process.env.SESSION_HOURS) || 8,
    maxFileBytes: 5 * 1024 * 1024
};
