import { t } from '../../i18n.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// user: the logged-in user from the API, shown on the profile card.
// pages: the views this user may open (e.g. ['admin', 'user', ...]); listed under PAGES.
// activeView: the page currently shown, highlighted in the list.
// onNavigate(view): called with a page name, 'settings' or 'profile'.
export function SidebarComponent({ user = null, pages = [], activeView = '', onNavigate = () => {} } = {}) {
    const displayName = user?.email ?? '';
    const displayCompany = user?.company?.name ?? (user ? t('nav.pykStaff') : '');
    const html = `
        <div class="sidebar-backdrop" aria-hidden="true"></div>
        <aside class="sidebar" id="page-sidebar" aria-label="${t('nav.sidebar')}" aria-hidden="true" inert>
            <div class="sidebar-top-cover" aria-hidden="true"></div>

            <div class="sidebar-panel">
                <button class="sidebar-item profile-card" type="button" aria-label="${t('nav.openProfile')}">
                    <div class="profile-avatar" aria-hidden="true"></div>
                    <div class="profile-meta">
                        <span class="profile-name">${escapeHtml(displayName)}</span>
                        <span class="profile-company">${escapeHtml(displayCompany)}</span>
                    </div>
                </button>

                <div class="sidebar-section-label">${t('nav.pages')}</div>
                ${pages.map((page) => `
                    <button class="sidebar-item nav-item" type="button" data-view="${page}"
                        ${page === activeView ? 'aria-current="page"' : ''}>
                        <span class="nav-icon" aria-hidden="true"></span>
                        <span>${t(`nav.${page}`)}</span>
                    </button>
                `).join('')}

                <div class="sidebar-section-label">${t('nav.other')}</div>
                <button class="sidebar-item nav-item" type="button" data-view="settings"
                    ${activeView === 'settings' ? 'aria-current="page"' : ''}>
                    <span class="nav-icon" aria-hidden="true"></span>
                    <span>${t('nav.settings')}</span>
                </button>

                <button class="sidebar-item nav-item" type="button" aria-label="${t('nav.notReady', { name: t('nav.inbox') })}" disabled>
                    <span class="nav-icon" aria-hidden="true"></span>
                    <span>${t('nav.inbox')}</span>
                </button>
            </div>
        </aside>
    `;

    function attachListeners() {
        const sidebarToggle = document.querySelector(".sidebar-toggle");
        const sidebarBackdrop = document.querySelector(".sidebar-backdrop");
        const sidebar = document.querySelector(".sidebar");
        const profileCard = document.querySelector(".profile-card");

        if (!sidebarToggle || !sidebarBackdrop || !sidebar || !profileCard) {
            return;
        }

        function setSidebarOpen(isOpen) {
            document.body.classList.toggle("sidebar-open", isOpen);
            sidebarToggle.setAttribute("aria-expanded", String(isOpen));
            sidebarToggle.setAttribute("aria-label", isOpen ? t('nav.closeSidebar') : t('nav.openSidebar'));
            sidebar.setAttribute("aria-hidden", String(!isOpen));
            sidebar.inert = !isOpen;
        }

        // A fresh render always starts closed (the body class survives re-renders).
        setSidebarOpen(false);

        sidebarToggle.addEventListener("click", () => {
            setSidebarOpen(sidebarToggle.getAttribute("aria-expanded") !== "true");
        });

        sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));
        profileCard.addEventListener("click", () => {
            setSidebarOpen(false);
            onNavigate('profile');
        });

        sidebar.querySelectorAll(".nav-item[data-view]").forEach((button) => {
            button.addEventListener("click", () => {
                setSidebarOpen(false);
                onNavigate(button.dataset.view);
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        });
    }

    return { html, attachListeners };
}
