import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { addInvoice, attachInvoiceModalListeners, updateInvoice, UserView } from './Views/User/UserView.js?v=7';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';
import { TreasuryView } from './Views/Treasury/TreasuryView.js?v=1';
import { VerificationView } from './Views/AP_Verification/APVeriView.js';
import { getCurrentUser, login, logout } from './authService.js';
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

function renderApp(activeView = 'user') {
    if (!appContainer) {
        return;
    }

    const isLoginView = activeView === 'login';
    const currentUser = getCurrentUser();

    if (!isLoginView && !currentUser) {
        renderApp('login');
        return;
    }

    const userRole = currentUser?.role;
    const sidebar = isLoginView ? null : SidebarComponent(() => renderApp('profile'));
    let currentView = '';
    let treasuryView = null;
    let verificationView = null;

    if (isLoginView) {
        currentView = LoginView();
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
        document.querySelector(".login-card")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const loginForm = event.currentTarget;
            const errorMessage = document.querySelector(".login-error");

            if (!(loginForm instanceof HTMLFormElement) || !loginForm.reportValidity()) {
                return;
            }

            const formData = new FormData(loginForm);
            const email = String(formData.get('email') ?? '').trim();
            const password = String(formData.get('password') ?? '');

            login(email, password)
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