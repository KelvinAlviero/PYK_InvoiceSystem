function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

const ROLE_LABELS = {
    vendor: 'Vendor',
    verification: 'AP Verification',
    treasury: 'Treasury',
    admin: 'Admin'
};

// user: the logged-in user from the API ({ id, email, role, company }).
export function UserProfileView(user) {
    const company = user?.company;

    return `
        <section class="profile-page-box" aria-label="User profile">
            <header class="profile-page-header">
                <span>User profile</span>
                <button class="back-home-button" type="button">Back to home</button>
            </header>
            <div class="profile-page-content">
                <div class="profile-page-details">
                    <dl>
                        <div>
                            <dt>Email</dt>
                            <dd>${escapeHtml(user?.email)}</dd>
                        </div>
                        <div>
                            <dt>Role</dt>
                            <dd>${escapeHtml(ROLE_LABELS[user?.role] ?? user?.role)}</dd>
                        </div>
                        ${company ? `
                        <div>
                            <dt>Company</dt>
                            <dd>${escapeHtml(company.name)}</dd>
                        </div>
                        <div>
                            <dt>Vendor ID</dt>
                            <dd>${escapeHtml(company.vendorCode)}</dd>
                        </div>
                        ` : ''}
                    </dl>

                    <form class="password-form" hidden>
                        <h2>Change password</h2>
                        <div class="password-field">
                            <label for="current-password">Current password</label>
                            <input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required>
                        </div>
                        <div class="password-field">
                            <label for="new-password">New password</label>
                            <input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <div class="password-field">
                            <label for="confirm-password">Repeat new password</label>
                            <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
                        </div>
                        <p class="password-message" role="status" hidden></p>
                        <div class="password-form-actions">
                            <button class="password-cancel-button" type="button">Cancel</button>
                            <button type="submit">Save password</button>
                        </div>
                    </form>
                </div>
                <div class="profile-page-avatar" aria-label="User profile picture" role="img"></div>
            </div>
            <div class="profile-page-actions">
                <button class="change-password-button" type="button" aria-expanded="false">Change password</button>
                <button type="button">Payment</button>
                <button class="logout-button" type="button">Logout</button>
            </div>
        </section>
    `;
}
