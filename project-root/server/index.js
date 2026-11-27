import path from 'node:path';
import express from 'express';
import { config, PROJECT_ROOT } from './config.js';
import { pool } from './db.js';
import { HttpError, loadUser } from './lib/auth.js';
import { requestLanguage, translate } from './lib/messages.js';
import { deleteExpiredSessions } from './lib/sessions.js';
import { authRouter } from './routes/auth.js';
import { invoicesRouter } from './routes/invoices.js';
import { notificationsRouter } from './routes/notifications.js';
import { regionsRouter } from './routes/regions.js';
import { usersRouter } from './routes/users.js';
import { vendorsRouter } from './routes/vendors.js';

const app = express();

// Railway sits behind a proxy: trust it so req.ip (rate limiting) and secure cookies work.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
const api = express.Router();
api.use(express.json({ limit: '100kb' }));
api.use(loadUser);

api.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
});
api.use('/auth', authRouter);
api.use('/regions', regionsRouter);
api.use('/vendors', vendorsRouter);
api.use('/users', usersRouter);
api.use('/invoices', invoicesRouter);
api.use('/notifications', notificationsRouter);

api.use((_req, _res, next) => next(new HttpError(404, 'error.notFound')));

// eslint-disable-next-line no-unused-vars
api.use((error, req, res, _next) => {
    const status = error.status ?? error.statusCode ?? 500;
    if (status >= 500) {
        console.error(error);
    }
    const language = requestLanguage(req);
    res.status(status).json({
        success: false,
        // Never leak internals (SQL errors etc.) to the browser.
        message: status >= 500
            ? translate(language, 'error.server')
            : translate(language, error.key ?? error.message, error.params)
    });
});

app.use('/api', api);

// ---------------------------------------------------------------------------
// Front end: only these folders are public, so server/, .env, package.json etc. never are.
// ---------------------------------------------------------------------------
for (const folder of ['css', 'js', 'assets']) {
    app.use(`/${folder}`, express.static(path.join(PROJECT_ROOT, folder)));
}
app.get('/', (_req, res) => res.sendFile(path.join(PROJECT_ROOT, 'index.html')));

app.listen(config.port, () => {
    console.log(`PYK Invoice System listening on http://localhost:${config.port}`);
});

// Housekeeping: clear expired sessions hourly.
setInterval(() => deleteExpiredSessions().catch(console.error), 60 * 60 * 1000).unref();
