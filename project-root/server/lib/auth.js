import { findSessionUser, readSessionCookie } from './sessions.js';

export const ROLES = ['vendor', 'verification', 'treasury', 'admin'];
export const STAFF_ROLES = ['verification', 'treasury', 'admin'];

// An error with an HTTP status; the error handler in index.js sends it as JSON.
export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// The shape of "a user" the front end sees. Never includes the password hash.
export function publicUser(row) {
    return {
        id: String(row.id),
        email: row.email,
        role: row.role,
        company: row.company_id
            ? { id: String(row.company_id), vendorCode: row.vendor_code, name: row.vendor_name }
            : null
    };
}

// Why a (correct-password) user may not use the system, or null if they may.
export function loginBlockReason(row) {
    if (!row.is_active) {
        return 'This account has been deactivated. Contact an administrator.';
    }
    if (row.role === 'vendor' && row.company_status === 'pending') {
        return 'Your registration is still being reviewed. You can log in once it has been approved.';
    }
    if (row.role === 'vendor' && row.company_status === 'rejected') {
        return 'Your registration was rejected. Contact PYK for details.';
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
    next(req.user ? undefined : new HttpError(401, 'Please log in.'));
}

// requireRole('verification', 'admin') -> only those roles pass. Admin is never implied:
// list it explicitly where admins should be allowed.
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new HttpError(401, 'Please log in.'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new HttpError(403, 'You do not have access to this.'));
        }
        next();
    };
}
