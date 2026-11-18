export function LoginView(mode = 'login') {
    const isRegistering = mode === 'register';

    return `
        <section class="login-page" aria-label="${isRegistering ? 'Create account' : 'Login'}">
            <form class="login-card" data-auth-mode="${mode}">
                <h1>${isRegistering ? 'Make new account' : 'Login'}</h1>
                <label for="login-email">Email</label>
                <input id="login-email" name="email" type="email" autocomplete="username" required>

                <label for="login-password">Password</label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required>

                ${isRegistering ? `
                    <label for="login-role">Role</label>
                    <select id="login-role" name="role" required>
                        <option value="" selected disabled>Choose a role</option>
                        <option value="User">User</option>
                        <option value="Verification">Verification</option>
                        <option value="Treasury">Treasury</option>
                        <option value="Admin">Admin</option>
                    </select>
                ` : ''}

                <p class="login-error" role="alert" hidden></p>

                <div class="login-card-actions">
                    <a class="login-register-link" href="${isRegistering ? '#login' : '#create-account'}">
                        ${isRegistering ? 'Already have an account' : 'Make new account'}
                    </a>
                    <button type="submit">${isRegistering ? 'Create' : 'Confirm'}</button>
                </div>
            </form>
        </section>
    `;
}
