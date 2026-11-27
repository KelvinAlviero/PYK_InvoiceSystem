import { t } from '../../i18n.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


// user: the logged-in user from the API ({ id, email, role, company }).
export function UserProfileView(user) {
    const company = user?.company;

    return `
        <section class="profile-page-box" aria-label="${t('profile.title')}">
            <header class="profile-page-header">
                <span>${t('profile.title')}</span>
                <button class="back-home-button" type="button">${t('common.backHome')}</button>
            </header>
            <div class="profile-page-content">
                <div class="profile-page-details">
                    <dl>
                        <div>
                            <dt>${t('profile.email')}</dt>
                            <dd>${escapeHtml(user?.email)}</dd>
                        </div>
                        <div>
                            <dt>${t('profile.role')}</dt>
                            <dd>${escapeHtml(user?.role ? t(`role.${user.role}`) : '')}</dd>
                        </div>
                        ${company ? `
                        <div>
                            <dt>${t('profile.company')}</dt>
                            <dd>${escapeHtml(company.name)}</dd>
                        </div>
                        <div>
                            <dt>${t('profile.vendorId')}</dt>
                            <dd>${escapeHtml(company.shortCode ?? company.vendorCode)}</dd>
                        </div>
                        ` : ''}
                    </dl>

                    <form class="password-form" hidden>
                        <h2>${t('profile.changePassword')}</h2>
                        <div class="password-field">
                            <label for="current-password">${t('profile.currentPassword')}</label>
                            <input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required>
                        </div>
                        <div class="password-field">
                            <label for="new-password">${t('profile.newPassword')}</label>
                            <input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <div class="password-field">
                            <label for="confirm-password">${t('profile.repeatPassword')}</label>
                            <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <p class="password-message" role="status" hidden></p>
                        <div class="password-form-actions">
                            <button class="password-cancel-button" type="button">${t('common.cancel')}</button>
                            <button type="submit">${t('profile.savePassword')}</button>
                        </div>
                    </form>
                </div>
                <div class="profile-page-avatar" aria-label="${t('profile.picture')}" role="img"></div>
            </div>
            <div class="profile-page-actions">
                <button class="change-password-button" type="button" aria-expanded="false">${t('profile.changePassword')}</button>
                <button type="button">${t('profile.payment')}</button>
                <button class="logout-button" type="button">${t('profile.logout')}</button>
            </div>
        </section>
    `;
}
