import { t } from './i18n.js';

// Talks to the Express API (same origin, so the session cookie is sent automatically).
// The server is the source of truth for who is logged in; currentUser is only a cache
// for rendering. Editing it in dev tools does not grant access to any API.
let currentUser = null;

export async function apiRequest(path, { method = 'GET', body } = {}) {
    const options = { method, credentials: 'same-origin', headers: {} };

    if (body instanceof FormData) {
        options.body = body; // browser sets the multipart boundary itself
    } else if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(`/api${path}`, options);
    } catch {
        throw new Error(t('common.networkError'));
    }

    let result = null;
    try {
        result = await response.json();
    } catch {
        // fall through to the status check below
    }

    if (!response.ok || result?.success === false) {
        const error = new Error(result?.message || t('common.requestFailed', { status: response.status }));
        error.status = response.status;
        throw error;
    }

    return result;
}

// Call once on page load: restores the session if the cookie is still valid.
export async function initAuth() {
    try {
        currentUser = (await apiRequest('/auth/me')).user;
    } catch {
        currentUser = null;
    }
    return currentUser;
}

export async function login(email, password) {
    const result = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    currentUser = result.user;
    return currentUser;
}

// formData: multipart FormData with the registration fields and PDF files.
// Does not log in: the vendor must wait for approval.
export function registerVendor(formData) {
    return apiRequest('/auth/register', { method: 'POST', body: formData });
}

export function getCurrentUser() {
    return currentUser;
}

export async function logout() {
    currentUser = null;
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
        // already logged out server-side; nothing else to do
    }
}

export function changePassword(currentPassword, newPassword) {
    return apiRequest('/users/me/password', { method: 'POST', body: { currentPassword, newPassword } });
}
