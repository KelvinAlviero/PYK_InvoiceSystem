import { findSessionUser, readSessionCookie } from './sessions.js';

export const ROLES = ['vendor', 'verification', 'treasury', 'admin'];
export const STAFF_ROLES = ['verification', 'treasury', 'admin'];

// An error with an HTTP status. `key` is a message key from lib/messages.js (params fill
// its placeholders); the error handler in index.js translates it and sends it as JSON.
export class HttpError extends Error {
    constructor(status, key, params = {}) {
        super(key);
        this.status = status;
        this.key = key;
        this.params = params;
    }
}

// The shape of "a user" the front end sees. Never includes the password hash.
export function publicUser(row) {
    return {
        id: String(row.id),
        email: row.email,
        role: row.role,
        company: row.company_id
            ? { id: String(row.company_id), vendorCode: row.vendor_code, shortCode: row.short_code, name: row.vendor_name }
            : null
    };
}

// Why a (correct-password) user may not use the system (a message key), or null if they may.
export function loginBlockReason(row) {
    if (!row.is_active) {
        return 'auth.deactivated';
    }
    if (row.role === 'vendor' && row.company_status === 'pending') {
        return 'auth.pendingReview';
    }
    if (row.role === 'vendor' && row.company_status === 'rejected') {
        return 'auth.registrationRejected';
    }
    return null;
}

// Sets req.user when the request carries a valid session for a usable account.
export async function loadUser(req, _res, next) {
    try {
        const token = readSessionCookie(req);
        const row = token ? await findSessionUser(token) : null;
        req.user = row && !loginBlockReason(row) ? row : null;
        next();
    } catch (error) {
        next(error);
    }
}

export function requireLogin(req, _res, next) {
    next(req.user ? undefined : new HttpError(401, 'auth.loginRequired'));
}

// requireRole('verification', 'admin') -> only those roles pass. Admin is never implied:
// list it explicitly where admins should be allowed.
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new HttpError(401, 'auth.loginRequired'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new HttpError(403, 'auth.forbidden'));
        }
        next();
    };
}
