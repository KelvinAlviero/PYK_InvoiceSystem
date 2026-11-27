import { t } from '../../i18n.js';

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
        <section class="login-page" aria-label="${t('login.title')}">
            <form class="login-card" data-auth-mode="login">
                <div class="login-card-fields">
                    <h1>${t('login.title')}</h1>

                    ${notice ? `<p class="login-notice" role="status">${escapeHtml(notice)}</p>` : ''}

                    <div class="login-field">
                        <label for="login-email">${t('login.email')}</label>
                        <input id="login-email" name="email" type="email" autocomplete="username" required>
                    </div>

                    <div class="login-field">
                        <label for="login-password">${t('login.password')}</label>
                        <input id="login-password" name="password" type="password" autocomplete="current-password" required>
                    </div>

                    <p class="login-error" role="alert" hidden></p>
                </div>

                <div class="login-card-actions">
                    <a class="login-register-link" href="#create-account">${t('login.register')}</a>
                    <button type="submit">${t('login.submit')}</button>
                </div>
            </form>
        </section>
    `;
}
