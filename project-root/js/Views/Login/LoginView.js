export function LoginView() {
    return `
        <section class="login-page" aria-label="Login">
            <form class="login-card">
                <h1>Login</h1>
                <label for="login-email">Email</label>
                <input id="login-email" name="email" type="email" autocomplete="username" required>

                <label for="login-password">Password</label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required>

                <div class="login-card-actions">
                    <a class="login-register-link" href="#create-account">Make new account</a>
                    <button type="submit">Confirm</button>
                </div>
            </form>
        </section>
    `;
}
