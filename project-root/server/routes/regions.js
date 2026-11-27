import express from 'express';
import { query } from '../db.js';
import { HttpError } from '../lib/auth.js';

// Public (registration needs them before anyone is logged in).
export const regionsRouter = express.Router();

function idParam(value) {
    if (!/^\d+$/.test(value)) {
        throw new HttpError(400, 'error.invalidId');
    }
    return value;
}

regionsRouter.get('/provinces', async (_req, res) => {
    const { rows } = await query('SELECT id::text, name FROM provinces ORDER BY name');
    res.set('Cache-Control', 'public, max-age=3600').json(rows);
});

regionsRouter.get('/provinces/:id/cities', async (req, res) => {
    const { rows } = await query(
        'SELECT id::text, name FROM cities WHERE province_id = $1 ORDER BY name',
        [idParam(req.params.id)]
    );
    res.set('Cache-Control', 'public, max-age=3600').json(rows);
});

regionsRouter.get('/cities/:id/villages', async (req, res) => {
    const { rows } = await query(
        'SELECT id::text, name FROM villages WHERE city_id = $1 ORDER BY name',
        [idParam(req.params.id)]
    );
    res.set('Cache-Control', 'public, max-age=3600').json(rows);
});
