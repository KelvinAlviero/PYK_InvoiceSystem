import { t } from '../../i18n.js';

export function TopBarComponent({ showSidebarButton = true } = {}) {
    return  `
        <header class="top-bar" aria-label="Top navigation">
            <img class="top-bar-image" src="assets/payakumbuh-logo.png" alt="Payakumbuh">


            ${showSidebarButton ? `
                <button
                class="sidebar-toggle"
                type="button"
                aria-label="${t('nav.openSidebar')}"
                aria-controls="page-sidebar"
                aria-expanded="false">

                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
                    <path d="M4 7h16M4 12h16M4 17h16"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-width="2"></path>
                </svg>
            </button>
            ` : ""}
        </header>
    `;
}
