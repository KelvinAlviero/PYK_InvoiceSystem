import express from 'express';
import { query } from '../db.js';
import { HttpError, requireRole, STAFF_ROLES } from '../lib/auth.js';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from '../lib/passwords.js';
import { deleteOtherSessions } from '../lib/sessions.js';

export const usersRouter = express.Router();

// ---------------------------------------------------------------------------
// Any logged-in user: change own password
// ---------------------------------------------------------------------------

usersRouter.post('/me/password', requireRole('vendor', ...STAFF_ROLES), async (req, res) => {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const { rows: [user] } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
        throw new HttpError(400, 'Current password is incorrect.');
    }

    await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, await hashPassword(newPassword)]);
    await deleteOtherSessions(req, req.user.id);
    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Admin only: staff accounts are created here, never by self-registration.
// ---------------------------------------------------------------------------

const adminOnly = requireRole('admin');

// GET /api/users  every login, with company name for vendors
usersRouter.get('/', adminOnly, async (_req, res) => {
    const { rows } = await query(
        `SELECT u.id::text, u.email, u.role, u.is_active, u.created_at,
                c.vendor_code, c.vendor_name, c.status AS company_status
           FROM users u
           LEFT JOIN companies c ON c.id = u.company_id
          ORDER BY u.created_at DESC
          LIMIT 1000`
    );
    res.json(rows);
});

// POST /api/users  { email, password, role: verification | treasury | admin }
usersRouter.post('/', adminOnly, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    const role = String(req.body?.role ?? '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, 'Please enter a valid email.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (!STAFF_ROLES.includes(role)) {
        throw new HttpError(400, `role must be one of: ${STAFF_ROLES.join(', ')}. Vendors register themselves.`);
    }

    try {
        const { rows: [user] } = await query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
             RETURNING id::text, email, role, is_active, created_at`,
            [email, await hashPassword(password), role]
        );
        res.status(201).json({ success: true, user });
    } catch (error) {
        if (error.code === '23505') {
            throw new HttpError(409, 'An account with this email already exists.');
        }
        throw error;
    }
});

// PATCH /api/users/:id  { isActive: boolean }  (deactivating also logs them out)
usersRouter.patch('/:id', adminOnly, async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
        throw new HttpError(400, 'Invalid id.');
    }
    if (typeof req.body?.isActive !== 'boolean') {
        throw new HttpError(400, 'isActive (true/false) is required.');
    }
    if (id === String(req.user.id) && req.body.isActive === false) {
        throw new HttpError(400, 'You cannot deactivate your own account.');
    }

    const { rows: [user] } = await query(
        'UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id::text, email, role, is_active',
        [id, req.body.isActive]
    );
    if (!user) {
        throw new HttpError(404, 'User not found.');
    }
    if (!user.is_active) {
        await query('DELETE FROM sessions WHERE user_id = $1', [id]);
    }
    res.json({ success: true, user });
});
