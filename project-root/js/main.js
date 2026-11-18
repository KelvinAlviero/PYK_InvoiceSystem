import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { addInvoice, attachInvoiceModalListeners, updateInvoice, UserView } from './Views/User/UserView.js?v=7';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';
import { TreasuryView } from './Views/Treasury/TreasuryView.js?v=1';
import { VerificationView } from './Views/AP_Verification/APVeriView.js';
import { getCurrentUser, login, logout, registerAccount } from './authService.js';
const appContainer = document.getElementById('app');

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
        currentView = LoginView(authMode);
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

        registerLink?.addEventListener("click", (event) => {
            event.preventDefault();
            renderApp('login', loginForm?.dataset.authMode === 'register' ? 'login' : 'register');
        });

        loginForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const submittedForm = event.currentTarget;
            const errorMessage = document.querySelector(".login-error");

            if (!(submittedForm instanceof HTMLFormElement) || !submittedForm.reportValidity()) {
                return;
            }

            const formData = new FormData(submittedForm);
            const email = String(formData.get('email') ?? '').trim();
            const password = String(formData.get('password') ?? '');
            const role = String(formData.get('role') ?? '');
            const request = submittedForm.dataset.authMode === 'register'
                ? registerAccount(email, password, role)
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