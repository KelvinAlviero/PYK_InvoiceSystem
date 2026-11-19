import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { addInvoice, attachInvoiceModalListeners, updateInvoice, UserView } from './Views/User/UserView.js?v=7';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';
import { RegistrationView } from './Views/Registration/RegistrationView.js';
import { collectRegistrationData } from './Views/Registration/registrationState.js';
import { TreasuryView } from './Views/Treasury/TreasuryView.js?v=1';
import { VerificationView } from './Views/AP_Verification/APVeriView.js';
import { getCurrentUser, login, logout, registerAccount } from './authService.js';
const appContainer = document.getElementById('app');
let registrationStep = 1;
let registrationData = {};

const roleHomeViews = {
    user: 'user',
    verification: 'ap-verification',
    treasury: 'treasury',
    admin: 'admin'
};

function getRoleHomeView(role) {
    return roleHomeViews[String(role).trim().toLowerCase()] ?? null;
}

function renderApp(activeView = 'user', authMode = 'login') {
    if (!appContainer) {
        return;
    }

    const isLoginView = activeView === 'login';
    const currentUser = getCurrentUser();

    if (!isLoginView && !currentUser) {
        renderApp('login', authMode);
        return;
    }

    const userRole = currentUser?.role;
    const sidebar = isLoginView ? null : SidebarComponent(() => renderApp('profile'));
    let currentView = '';
    let treasuryView = null;
    let verificationView = null;

    if (isLoginView) {
        currentView = authMode === 'register'
            ? RegistrationView(registrationStep, registrationData)
            : LoginView();
    } else if (userRole) {
        if (activeView === 'profile') {
            currentView = UserProfileView();
        } else if (activeView === 'treasury') {
            treasuryView = TreasuryView();
            currentView = treasuryView.html;
        } else if (activeView === 'ap-verification') {
            verificationView = VerificationView();
            currentView = verificationView.html;
        } else {
            currentView = UserView();
        }
    }

    appContainer.innerHTML = `
        ${TopBarComponent({ showSidebarButton: !isLoginView })}
        <main class="page-content">
            ${currentView}
        </main>
        ${sidebar?.html ?? ''}
    `;

    sidebar?.attachListeners();
    treasuryView?.attachListeners();
    verificationView?.attachListeners();
    if (activeView === 'user') {
        attachInvoiceModalListeners((invoice, isResubmission) => {
            if (isResubmission) {
                updateInvoice(invoice);
            } else {
                addInvoice(invoice);
            }
            renderApp('user');
        });
    }

    if (activeView === 'profile') {
        document.querySelector(".back-home-button")?.addEventListener("click", () => renderApp('user'));
        document.querySelector(".logout-button")?.addEventListener("click", () => {
            logout();
            renderApp('login');
        });
    }

    if (isLoginView) {
        const loginForm = document.querySelector(".login-card");
        const registerLink = document.querySelector(".login-register-link");
        const isRegistering = loginForm?.dataset.authMode === 'register';

        registerLink?.addEventListener("click", (event) => {
            event.preventDefault();
            if (isRegistering) {
                registrationStep = 1;
                registrationData = {};
                renderApp('login', 'login');
            } else {
                registrationStep = 1;
                registrationData = {};
                renderApp('login', 'register');
            }
        });

        document.querySelector(".login-back-button")?.addEventListener("click", () => {
            registrationStep -= 1;
            renderApp('login', 'register');
        });

        loginForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const submittedForm = event.currentTarget;
            const errorMessage = document.querySelector(".login-error");

            if (!(submittedForm instanceof HTMLFormElement) || !submittedForm.reportValidity()) {
                return;
            }

            const currentData = collectRegistrationData(submittedForm);

            if (isRegistering && registrationStep < 5) {
                registrationData = { ...registrationData, ...currentData };
                registrationStep += 1;
                renderApp('login', 'register');
                return;
            }

            const submittedData = isRegistering
                ? { ...registrationData, ...currentData }
                : currentData;
            const email = String(submittedData.email ?? '').trim();
            const password = String(submittedData.password ?? '');
            const role = String(submittedData.role ?? '');
            const request = isRegistering
                ? registerAccount(email, password, role, submittedData)
                : login(email, password);

            request
                .then((user) => {
                    const homeView = getRoleHomeView(user.role);

                    if (!homeView) {
                        throw new Error(`No dashboard is configured for the "${user.role}" role.`);
                    }

                    renderApp(homeView);
                })
                .catch((error) => {
                    if (errorMessage) {
                        errorMessage.textContent = error.message;
                        errorMessage.hidden = false;
                    }
                });
        });
    }
}
renderApp('login');