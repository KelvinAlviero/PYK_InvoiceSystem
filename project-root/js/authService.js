const AUTH_API_URL = 'https://script.google.com/macros/s/AKfycbyLlFoPNlIhEs2lSrBL9wtSGf2_CqNkZxDfMb9vmCsltu4PYrev2JHw2Xe7_NT2yaY9/exec';
const AUTH_USER_STORAGE_KEY = 'auth-user';

async function requestAuth(payload) {
    const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: {
            // text/plain avoids the browser's JSON CORS preflight for Apps Script.
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
    });

    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error('The authentication service returned an invalid response.');
    }

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid email or password.');
    }

    if (!result.user?.role) {
        throw new Error('The authentication response is missing a user role.');
    }

    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(result.user));
    return result.user;
}

export function login(email, password) {
    return requestAuth({ action: 'login', email, password });
}

export function registerAccount(email, password, role) {
    return requestAuth({ action: 'register', email, password, role });
}

export function getCurrentUser() {
    const storedUser = sessionStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch {
        sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
        return null;
    }
}

export function logout() {
    sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
}