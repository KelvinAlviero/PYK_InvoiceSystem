function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// notice: optional message shown above the form (e.g. "registration submitted").
export function LoginView(notice = '') {
    return `
        <section class="login-page" aria-label="Login">
            <form class="login-card" data-auth-mode="login">
                <div class="login-card-fields">
                    <h1>Login</h1>

                    ${notice ? `<p class="login-notice" role="status">${escapeHtml(notice)}</p>` : ''}

                    <div class="login-field">
                        <label for="login-email">Email</label>
                        <input id="login-email" name="email" type="email" autocomplete="username" required>
                    </div>

                    <div class="login-field">
                        <label for="login-password">Password</label>
                        <input id="login-password" name="password" type="password" autocomplete="current-password" required>
                    </div>

                    <p class="login-error" role="alert" hidden></p>
                </div>

                <div class="login-card-actions">
                    <a class="login-register-link" href="#create-account">Register as a vendor</a>
                    <button type="submit">Confirm</button>
                </div>
            </form>
        </section>
    `;
}
