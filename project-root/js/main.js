import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { addInvoice, attachInvoiceModalListeners, updateInvoice, UserView } from './Views/User/UserView.js?v=7';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';
import { TreasuryView } from './Views/Treasury/TreasuryView.js?v=1';

const appContainer = document.getElementById('app');

function renderApp(activeView = 'user') {
    if (!appContainer) {
        return;
    }

    const userRole = 'User';
    const isLoginView = activeView === 'login';
    const sidebar = isLoginView ? null : SidebarComponent(() => renderApp('profile'));
    let currentView = '';
    let treasuryView = null;

    if (isLoginView) {
        currentView = LoginView();
    } else if (userRole === 'User') {
        if (activeView === 'profile') {
            currentView = UserProfileView();
        } else if (activeView === 'treasury') {
            treasuryView = TreasuryView();
            currentView = treasuryView.html;
        } else {
            currentView = UserView();
        }
    }

    appContainer.innerHTML = `
        ${isLoginView ? '' : TopBarComponent()}
        <main class="page-content">
            ${currentView}
        </main>
        ${sidebar?.html ?? ''}
    `;

    sidebar?.attachListeners();
    treasuryView?.attachListeners();
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
        document.querySelector(".logout-button")?.addEventListener("click", () => renderApp('login'));
    }

    if (isLoginView) {
        document.querySelector(".login-card")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const selectedView = document.querySelector("#view-selector")?.value;
            if (selectedView === "ap-verification") {
                window.location.href = "stuff.html";
                return;
            }

            renderApp(selectedView === "treasury" ? "treasury" : "user");
        });
    }
}

renderApp('login');