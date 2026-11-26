import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';

export const SESSION_COOKIE = 'pyk_session';

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
    return {
        httpOnly: true, // page JavaScript cannot read it, so XSS cannot steal it
        sameSite: 'lax', // not sent on cross-site POSTs (basic CSRF protection)
        secure: config.isProduction,
        path: '/'
    };
}

export async function createSession(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000);

    await query(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [hashToken(token), userId, expiresAt]
    );

    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

export async function destroySession(req, res) {
    const token = readSessionCookie(req);
    if (token) {
        await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function readSessionCookie(req) {
    const header = req.headers.cookie ?? '';
    for (const part of header.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === SESSION_COOKIE) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return null;
}

// Looks the session up and re-checks the user every request, so deactivating a
// user (or un-approving their company) takes effect immediately.
export async function findSessionUser(token) {
    const { rows } = await query(
        `SELECT u.id, u.email, u.role, u.company_id, u.is_active,
                c.vendor_code, c.vendor_name, c.status AS company_status
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN companies c ON c.id = u.company_id
          WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hashToken(token)]
    );
    return rows[0] ?? null;
}

export async function deleteExpiredSessions() {
    await query('DELETE FROM sessions WHERE expires_at <= now()');
}
