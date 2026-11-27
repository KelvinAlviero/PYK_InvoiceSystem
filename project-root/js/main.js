import { TopBarComponent } from './Views/components/TopBar.js';
import { SidebarComponent } from './Views/components/SideBar.js?v=2';
import { attachInvoiceModalListeners, UserView } from './Views/User/UserView.js?v=8';
import { UserProfileView } from './Views/User/UserProfileView.js?v=2';
import { LoginView } from './Views/Login/LoginView.js';
import { RegistrationView } from './Views/Registration/RegistrationView.js';
import { collectRegistrationData } from './Views/Registration/registrationState.js';
import { submitRegistration } from './Views/Registration/registrationService.js';
import { TreasuryView } from './Views/Treasury/TreasuryView.js?v=5';
import { VerificationView } from './Views/AP_Verification/APVeriView.js';
import { AdminView } from './Views/Admin/AdminView.js';
import { SettingsView } from './Views/Settings/SettingsView.js';
import { t } from './i18n.js';
import { apiRequest, changePassword, getCurrentUser, initAuth, login, logout } from './authService.js';
const appContainer = document.getElementById('app');
let registrationStep = 1;
let registrationData = {};
let loginNotice = '';
let settingsNotice = '';

// Which views each role may open, and where each lands after login. The API enforces
// the same rules server-side; this only keeps people off screens they cannot use.
const roleHomeViews = {
    vendor: 'user',
    verification: 'ap-verification',
    treasury: 'treasury',
    admin: 'admin'
};

const roleAllowedViews = {
    vendor: ['user', 'profile', 'settings'],
    verification: ['ap-verification', 'profile', 'settings'],
    treasury: ['treasury', 'profile', 'settings'],
    admin: ['admin', 'user', 'ap-verification', 'treasury', 'profile', 'settings']
};

function getRoleHomeView(role) {
    return roleHomeViews[role] ?? null;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// options: [{ id, name }] from the regions API. Values are ids; labels are names.
function setSelectOptions(select, options, placeholder) {
    select.innerHTML = `
        <option value="" selected disabled>${escapeHtml(placeholder)}</option>
        ${options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name)}</option>`).join('')}
    `;
    select.disabled = options.length === 0;
}

function resetSelect(select, placeholder) {
    select.innerHTML = `<option value="" selected disabled>${escapeHtml(placeholder)}</option>`;
    select.disabled = true;
}

async function loadRegionOptions(select, path, placeholder) {
    try {
        const options = await apiRequest(path);
        setSelectOptions(select, options, options.length ? placeholder : t('region.none'));
    } catch {
        resetSelect(select, t('region.failed'));
    }
}

// Cascading Provinsi -> Kota/Kabupaten -> Kelurahan/Desa, restoring earlier choices
// when the user comes back to this step.
async function attachLocationListeners() {
    const provinceSelect = document.querySelector('#company-province');
    const citySelect = document.querySelector('#company-city');
    const villageSelect = document.querySelector('#company-village');

    if (!provinceSelect || !citySelect || !villageSelect) {
        return;
    }

    async function loadCities(provinceId) {
        resetSelect(citySelect, t('common.loading'));
        resetSelect(villageSelect, t('region.chooseVillage'));
        await loadRegionOptions(citySelect, `/regions/provinces/${encodeURIComponent(provinceId)}/cities`, t('region.chooseCity'));
    }

    async function loadVillages(cityId) {
        resetSelect(villageSelect, t('common.loading'));
        await loadRegionOptions(villageSelect, `/regions/cities/${encodeURIComponent(cityId)}/villages`, t('region.chooseVillage'));
    }

    provinceSelect.addEventListener('change', () => loadCities(provinceSelect.value));
    citySelect.addEventListener('change', () => loadVillages(citySelect.value));

    await loadRegionOptions(provinceSelect, '/regions/provinces', t('region.chooseProvince'));

    const { province, cityRegency, village } = registrationData;
    if (province) {
        provinceSelect.value = province;
        await loadCities(province);
        if (cityRegency) {
            citySelect.value = cityRegency;
            await loadVillages(cityRegency);
            villageSelect.value = village ?? '';
        }
    }
}

function restoreRegistrationFields() {
    Object.entries(registrationData).forEach(([name, value]) => {
        const field = document.querySelector(`[name="${name}"]`);

        if (!field || field.tagName === 'SELECT' && field.disabled) {
            return; // region selects are restored by attachLocationListeners
        }

        if (field.type === 'file') {
            // Browsers cannot pre-fill file inputs; keep the earlier file unless replaced.
            if (value instanceof File) {
                field.required = false;
                field.insertAdjacentHTML(
                    'afterend',
                    `<p class="login-file-kept">${escapeHtml(t('register.fileKept', { name: value.name }))}</p>`
                );
            }
        } else if (field.type === 'checkbox') {
            field.checked = value === 'on' || value === true;
        } else {
            field.value = value;
        }
    });
}

// Profile page: show/hide the change-password form and submit it to the API.
function attachPasswordFormListeners() {
    const toggleButton = document.querySelector('.change-password-button');
    const form = document.querySelector('.password-form');
    const message = form?.querySelector('.password-message');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!toggleButton || !form || !message || !submitButton) {
        return;
    }

    function showMessage(text, kind) {
        message.textContent = text;
        message.dataset.kind = kind;
        message.hidden = false;
    }

    function setOpen(isOpen) {
        form.hidden = !isOpen;
        toggleButton.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) {
            form.reset();
            message.hidden = true;
            form.querySelector('input')?.focus();
        }
    }

    toggleButton.addEventListener('click', () => setOpen(form.hidden));
    form.querySelector('.password-cancel-button')?.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = form.elements.currentPassword.value;
        const newPassword = form.elements.newPassword.value;

        if (newPassword !== form.elements.confirmPassword.value) {
            showMessage(t('profile.mismatch'), 'error');
            return;
        }
        if (newPassword === currentPassword) {
            showMessage(t('profile.sameAsOld'), 'error');
            return;
        }

        submitButton.disabled = true;
        try {
            await changePassword(currentPassword, newPassword);
            form.reset();
            showMessage(t('profile.changed'), 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}

function goToLogin(notice = '') {
    registrationStep = 1;
    registrationData = {};
    loginNotice = notice;
    renderApp('login', 'login');
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

    if (!isLoginView && !roleAllowedViews[userRole]?.includes(activeView)) {
        const homeView = getRoleHomeView(userRole);
        if (!homeView) {
            renderApp('login');
            return;
        }
        renderApp(homeView);
        return;
    }

    const sidebar = isLoginView ? null : SidebarComponent({
        user: currentUser,
        pages: (roleAllowedViews[userRole] ?? []).filter((view) => !['profile', 'settings'].includes(view)),
        activeView,
        onNavigate: (view) => renderApp(view)
    });
    let currentView = '';
    let treasuryView = null;
    let verificationView = null;
    let adminView = null;
    let settingsView = null;

    if (isLoginView) {
        currentView = authMode === 'register'
            ? RegistrationView(registrationStep, registrationData)
            : LoginView(loginNotice);
        loginNotice = '';
    } else if (userRole) {
        if (activeView === 'profile') {
            currentView = UserProfileView(currentUser);
        } else if (activeView === 'settings') {
            settingsView = SettingsView(settingsNotice);
            settingsNotice = '';
            currentView = settingsView.html;
        } else if (activeView === 'treasury') {
            treasuryView = TreasuryView();
            currentView = treasuryView.html;
        } else if (activeView === 'admin') {
            adminView = AdminView();
            currentView = adminView.html;
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
    adminView?.attachListeners();
    settingsView?.attachListeners(() => {
        settingsNotice = t('settings.saved');
        renderApp('settings');
    });
    if (isLoginView && authMode === 'register') {
        restoreRegistrationFields();
    }
    if (isLoginView && authMode === 'register' && registrationStep === 2) {
        attachLocationListeners();
    }
    if (activeView === 'user') {
        attachInvoiceModalListeners();
    }

    if (activeView === 'settings') {
        document.querySelector(".back-home-button")?.addEventListener("click", () => renderApp(getRoleHomeView(userRole)));
    }

    if (activeView === 'profile') {
        document.querySelector(".back-home-button")?.addEventListener("click", () => renderApp(getRoleHomeView(userRole)));
        document.querySelector(".logout-button")?.addEventListener("click", async () => {
            await logout();
            goToLogin();
        });
        attachPasswordFormListeners();
    }

    if (isLoginView) {
        const loginForm = document.querySelector(".login-card");
        const registerLink = document.querySelector(".login-register-link");
        const isRegistering = loginForm?.dataset.authMode === 'register';

        registerLink?.addEventListener("click", (event) => {
            event.preventDefault();
            registrationStep = 1;
            registrationData = {};
            renderApp('login', isRegistering ? 'login' : 'register');
        });

        document.querySelector(".login-back-button")?.addEventListener("click", () => {
            // Keep what was typed on this step (without validating it) before going back.
            collectRegistrationData(loginForm).then((currentData) => {
                registrationData = { ...registrationData, ...currentData };
            }).catch(() => {}).finally(() => {
                registrationStep -= 1;
                renderApp('login', 'register');
            });
        });
        loginForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submittedForm = event.currentTarget;
            const errorMessage = document.querySelector(".login-error");

            if (!(submittedForm instanceof HTMLFormElement) || !submittedForm.reportValidity()) {
                return;
            }

            const submitButton = submittedForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }

            try {
                const currentData = await collectRegistrationData(submittedForm);

                if (isRegistering && registrationStep < 5) {
                    registrationData = { ...registrationData, ...currentData };
                    registrationStep += 1;
                    renderApp('login', 'register');
                    return;
                }

                if (isRegistering) {
                    await submitRegistration({ ...registrationData, ...currentData });
                    goToLogin(t('login.registered'));
                    return;
                }

                const user = await login(
                    String(currentData.email ?? '').trim(),
                    String(currentData.password ?? '')
                );
                const homeView = getRoleHomeView(user.role);

                if (!homeView) {
                    throw new Error(t('login.noDashboard', { role: user.role }));
                }

                renderApp(homeView);
            } catch (error) {
                if (errorMessage) {
                    errorMessage.textContent = error.message;
                    errorMessage.hidden = false;
                }
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }
}
initAuth().then((user) => {
    if (user) {
        renderApp(getRoleHomeView(user.role) ?? 'login');
    } else {
        renderApp('login');
    }
});
