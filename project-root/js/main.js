import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { addInvoice, attachInvoiceModalListeners, updateInvoice, UserView } from './Views/User/UserView.js?v=7';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';

const appContainer = document.getElementById('app');
// Main.js compiles stuff
function renderApp(activeView = 'user') {
    if (!appContainer) {
        return;
    }

    const userRole = 'User';
    const isLoginView = activeView === 'login';
    const showSidebar = !isLoginView
    const sidebar = showSidebar 
    ? SidebarComponent(() => renderApp('profile'))
    : null;
    let currentView = '';

    if (isLoginView) {
        currentView = LoginView();
    } else if (userRole === 'User') {
        currentView = activeView === 'profile' ? UserProfileView() : UserView();
    }

    appContainer.innerHTML = `
        ${TopBarComponent({ showSidebarButton: showSidebar})}
        <main class="page-content">
            ${currentView}
        </main>
        ${sidebar?.html ?? ''}
    `;

    sidebar?.attachListeners();
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
            renderApp(document.querySelector("#view-selector")?.value === "user" ? "user" : "user");
        });
    }
}

renderApp('login');