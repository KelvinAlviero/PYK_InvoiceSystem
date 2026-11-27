import { apiRequest, getCurrentUser } from '../../authService.js';
import { getLocale, t } from '../../i18n.js';

// Admin dashboard: monitor the invoice pipeline, approve vendor registrations,
// manage logins, and read the notification log. AP and Treasury decisions on
// invoices stay on their own pages; here they are read-only.

const TABS = ['pipeline', 'vendors', 'users', 'notifications'];
const INVOICE_STAGES = ['submitted', 'rejected', 'approved', 'paid'];
const INVOICE_DOCUMENTS = [
    'purchase_order', 'goods_receipt', 'supplier_invoice', 'delivery_note',
    'tax_invoice', 'notes', 'payment_proof'
];

// Labels are looked up at render time so they follow the chosen language.
const invoiceStatusLabel = (status) => t(`admin.status.${status}`);
const roleLabel = (role) => t(`role.${role}`);
const bankLine = (bank) => t('common.bankAccount', { bank: bank.bank_name, number: bank.account_number, holder: bank.account_holder });
// business_type values are stored in Indonesian; show them in the chosen language.
const businessTypeLabel = (value) => ({
    'Usaha Berbadan Hukum': t('register.bt.legal'),
    'Usaha Perseorangan': t('register.bt.sole')
}[value] ?? value);

// Survives re-renders while the admin stays on this page.
const state = {
    tab: 'pipeline',
    invoiceStatus: null,
    selectedInvoiceId: null,
    vendorStatus: 'pending',
    selectedVendorId: null,
    usersFlash: ''          // confirmation shown once after creating an account
};
let renderToken = 0;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function rupiah(value) {
    return `Rp ${Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
}

function dateTime(value) {
    return value
        ? new Date(value).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })
        : '-';
}

function statusPill(status, label = status) {
    return `<span class="admin-status" data-status="${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function field(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '-')}</dd></div>`;
}

function emptyState(text) {
    return `<p class="admin-empty">${escapeHtml(text)}</p>`;
}

function errorState(error) {
    return `<p class="admin-empty">${escapeHtml(t('common.loadFailed', { error: error.message }))}</p>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function AdminView() {
    const html = `
        <section class="admin-page" aria-label="${t('admin.ariaLabel')}">
            <header class="admin-header">
                <div>
                    <h1>${t('admin.title')}</h1>
                    <p>${t('admin.subtitle')}</p>
                </div>
                <nav class="admin-tabs" role="tablist" aria-label="${t('admin.sections')}">
                    ${TABS.map((tab) => `
                        <button class="admin-tab" type="button" role="tab" data-tab="${tab}"
                            aria-selected="${tab === state.tab}">${escapeHtml(t(`admin.tab.${tab}`))}</button>
                    `).join('')}
                </nav>
            </header>
            <div class="admin-body" role="tabpanel"></div>
        </section>
    `;

    function attachListeners() {
        document.querySelectorAll('.admin-tab').forEach((button) => {
            button.addEventListener('click', () => {
                state.tab = button.dataset.tab;
                document.querySelectorAll('.admin-tab').forEach((other) => {
                    other.setAttribute('aria-selected', String(other === button));
                });
                renderTab();
            });
        });
        renderTab();
    }

    return { html, attachListeners };
}

function body() {
    return document.querySelector('.admin-body');
}

function renderTab() {
    const renderers = {
        pipeline: renderPipeline,
        vendors: renderVendors,
        users: renderUsers,
        notifications: renderNotifications
    };
    const token = ++renderToken;
    const container = body();
    if (!container) {
        return;
    }
    container.innerHTML = emptyState(t('common.loading'));
    renderers[state.tab]?.(container, () => token === renderToken);
}

// ---------------------------------------------------------------------------
// Invoice pipeline
// ---------------------------------------------------------------------------

async function renderPipeline(container, isCurrent) {
    let stats;
    let invoices;
    try {
        const statusQuery = state.invoiceStatus ? `?status=${state.invoiceStatus}` : '';
        [stats, invoices] = await Promise.all([
            apiRequest('/invoices/stats'),
            apiRequest(`/invoices${statusQuery}`)
        ]);
    } catch (error) {
        if (isCurrent()) {
            container.innerHTML = errorState(error);
        }
        return;
    }
    if (!isCurrent()) {
        return;
    }

    const filterLabel = state.invoiceStatus ? invoiceStatusLabel(state.invoiceStatus) : t('admin.allInvoices');

    container.innerHTML = `
        <div class="admin-stages">
            ${INVOICE_STAGES.map((status) => `
                <button class="admin-stage" type="button" data-status="${status}"
                    aria-pressed="${state.invoiceStatus === status}">
                    <span class="admin-stage-label">${escapeHtml(t(`admin.stage.${status}`))}</span>
                    <span class="admin-stage-count">${stats[status].count}</span>
                    <span class="admin-stage-total">${rupiah(stats[status].total)}</span>
                </button>
            `).join('')}
        </div>
        <div class="admin-split">
            <section class="admin-panel" aria-label="${t('admin.invoiceList')}">
                <header class="admin-panel-header">
                    <h2>${escapeHtml(filterLabel)}</h2>
                    <span class="admin-status">${t('common.invoiceCount', { count: invoices.length })}</span>
                </header>
                <div class="admin-list">
                    ${invoices.length ? invoices.map((invoice) => `
                        <button class="admin-row" type="button" data-invoice-id="${escapeHtml(invoice.id)}"
                            aria-current="${invoice.id === state.selectedInvoiceId}">
                            <span class="admin-row-top">
                                <span class="admin-row-title">${escapeHtml(invoice.invoice_code)} · ${escapeHtml(invoice.vendor_name)}</span>
                                ${statusPill(invoice.status, invoiceStatusLabel(invoice.status))}
                            </span>
                            <span class="admin-row-bottom">
                                <span class="admin-muted">${escapeHtml(invoice.branch_name)} · PO ${escapeHtml(invoice.po_number)}</span>
                                <strong>${rupiah(invoice.amount)}</strong>
                            </span>
                            <span class="admin-muted">${escapeHtml(t('admin.submittedOn', { date: dateTime(invoice.submitted_at) }))}${invoice.revision > 1 ? escapeHtml(t('admin.revisionSuffix', { n: invoice.revision })) : ''}</span>
                        </button>
                    `).join('') : emptyState(t('admin.noInvoicesInStage'))}
                </div>
            </section>
            <section class="admin-panel" aria-label="${t('admin.invoiceDetail')}">
                <header class="admin-panel-header"><h2>${t('admin.invoiceDetail')}</h2></header>
                <div class="admin-panel-body admin-invoice-detail">
                    ${emptyState(t('admin.pickInvoice'))}
                </div>
            </section>
        </div>
    `;

    container.querySelectorAll('.admin-stage').forEach((button) => {
        button.addEventListener('click', () => {
            state.invoiceStatus = state.invoiceStatus === button.dataset.status ? null : button.dataset.status;
            state.selectedInvoiceId = null;
            renderTab();
        });
    });
    container.querySelectorAll('[data-invoice-id]').forEach((button) => {
        button.addEventListener('click', () => {
            state.selectedInvoiceId = button.dataset.invoiceId;
            container.querySelectorAll('[data-invoice-id]').forEach((other) => {
                other.setAttribute('aria-current', String(other === button));
            });
            renderInvoiceDetail(container.querySelector('.admin-invoice-detail'), isCurrent);
        });
    });

    if (state.selectedInvoiceId && invoices.some((invoice) => invoice.id === state.selectedInvoiceId)) {
        renderInvoiceDetail(container.querySelector('.admin-invoice-detail'), isCurrent);
    }
}

async function renderInvoiceDetail(target, isCurrent) {
    const id = state.selectedInvoiceId;
    target.innerHTML = emptyState(t('common.loading'));
    let invoice;
    try {
        invoice = await apiRequest(`/invoices/${encodeURIComponent(id)}`);
    } catch (error) {
        target.innerHTML = errorState(error);
        return;
    }
    if (!isCurrent() || state.selectedInvoiceId !== id) {
        return;
    }

    const documents = new Map(invoice.documents.map((doc) => [doc.document_type, doc]));
    const paidAccount = invoice.bankAccounts.find((bank) => bank.account_index === invoice.paid_to_account);

    target.innerHTML = `
        <div class="admin-detail-heading">
            <div>
                <p class="admin-eyebrow">${escapeHtml(invoice.invoice_code)} · ${escapeHtml(invoice.vendor_code)}</p>
                <h3>${escapeHtml(invoice.vendor_name)}</h3>
                ${statusPill(invoice.status, invoiceStatusLabel(invoice.status))}
            </div>
            <div>
                <p class="admin-eyebrow">${t('admin.totalInvoice')}</p>
                <div class="admin-amount">${rupiah(invoice.amount)}</div>
            </div>
        </div>

        <dl class="admin-fields">
            ${field(t('admin.branch'), invoice.branch_name)}
            ${field(t('admin.po'), invoice.po_number)}
            ${field(t('admin.vendorInvoice'), invoice.invoice_number)}
            ${field(t('admin.revision'), String(invoice.revision))}
            ${field(t('admin.submitted'), dateTime(invoice.submitted_at))}
            ${field(t('admin.vendorNote'), invoice.vendor_note)}
            ${invoice.ap_note ? field(t('admin.apNote'), invoice.ap_note) : ''}
            ${invoice.status === 'paid' ? `
                ${field(t('admin.paidAt'), dateTime(invoice.paid_at))}
                ${field(t('admin.method'), invoice.payment_method)}
                ${field(t('admin.reference'), invoice.payment_reference)}
                ${field(t('admin.paidTo'), paidAccount
                    ? bankLine(paidAccount)
                    : t('admin.accountN', { n: invoice.paid_to_account }))}
            ` : ''}
        </dl>

        <h4 class="admin-section-title">${t('admin.documents')}</h4>
        <div class="admin-docs">
            ${INVOICE_DOCUMENTS.map((type) => {
                const label = type === 'notes' ? t('admin.notesOptional') : t(`doc.${type}`);
                const doc = documents.get(type);
                return doc
                    ? `<a class="admin-doc" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                            <span><strong>${escapeHtml(label)}</strong>${escapeHtml(doc.original_name)}</span><span>${t('common.open')} ↗</span>
                       </a>`
                    : `<span class="admin-doc" aria-disabled="true">
                            <span><strong>${escapeHtml(label)}</strong>${t('admin.notProvided')}</span>
                       </span>`;
            }).join('')}
        </div>

        <h4 class="admin-section-title">${t('admin.vendorAccounts')}</h4>
        <dl class="admin-fields">
            ${invoice.bankAccounts.map((bank) => field(
                t('admin.accountN', { n: bank.account_index }),
                bankLine(bank)
            )).join('') || field(t('admin.vendorAccounts'), t('admin.noBankData'))}
        </dl>

        <h4 class="admin-section-title">${t('admin.history')}</h4>
        <ol class="admin-timeline">
            ${invoice.events.map((event) => `
                <li data-action="${escapeHtml(event.action)}">
                    <strong>${escapeHtml(t(`admin.event.${event.action}`))}</strong>
                    <span class="admin-muted"> · ${dateTime(event.created_at)} · ${escapeHtml(event.actor_email)}</span>
                    ${event.note ? `<p class="admin-note">${escapeHtml(event.note)}</p>` : ''}
                </li>
            `).join('')}
        </ol>
    `;
}

// ---------------------------------------------------------------------------
// Vendor registrations
// ---------------------------------------------------------------------------

async function renderVendors(container, isCurrent) {
    let vendors;
    try {
        vendors = await apiRequest(`/vendors?status=${state.vendorStatus}`);
    } catch (error) {
        if (isCurrent()) {
            container.innerHTML = errorState(error);
        }
        return;
    }
    if (!isCurrent()) {
        return;
    }

    const filters = ['pending', 'approved', 'rejected'].map((status) => [status, t(`admin.vendorStatus.${status}`)]);

    container.innerHTML = `
        <div class="admin-split">
            <section class="admin-panel" aria-label="${t('admin.vendorList')}">
                <header class="admin-panel-header">
                    <div class="admin-tabs">
                        ${filters.map(([status, label]) => `
                            <button class="admin-chip" type="button" data-vendor-status="${status}"
                                aria-pressed="${state.vendorStatus === status}">${label}</button>
                        `).join('')}
                    </div>
                    <span class="admin-status">${t('admin.vendorCount', { count: vendors.length })}</span>
                </header>
                <div class="admin-list">
                    ${vendors.length ? vendors.map((vendor) => `
                        <button class="admin-row" type="button" data-vendor-id="${escapeHtml(vendor.id)}"
                            aria-current="${vendor.id === state.selectedVendorId}">
                            <span class="admin-row-top">
                                <span class="admin-row-title">${escapeHtml(vendor.vendor_name)}</span>
                                <span class="admin-muted">${escapeHtml(vendor.short_code ?? vendor.vendor_code)}</span>
                            </span>
                            <span class="admin-row-bottom">
                                <span class="admin-muted">${escapeHtml(businessTypeLabel(vendor.business_type))}</span>
                                <span class="admin-muted">${escapeHtml(vendor.login_email ?? '')}</span>
                            </span>
                            <span class="admin-muted">${escapeHtml(t('admin.appliedOn', { date: dateTime(vendor.submitted_at) }))}</span>
                        </button>
                    `).join('') : emptyState(t('admin.noVendors'))}
                </div>
            </section>
            <section class="admin-panel" aria-label="${t('admin.vendorDetail')}">
                <header class="admin-panel-header"><h2>${t('admin.vendorDetail')}</h2></header>
                <div class="admin-panel-body admin-vendor-detail">
                    ${emptyState(t('admin.pickVendor'))}
                </div>
            </section>
        </div>
    `;

    container.querySelectorAll('[data-vendor-status]').forEach((button) => {
        button.addEventListener('click', () => {
            state.vendorStatus = button.dataset.vendorStatus;
            state.selectedVendorId = null;
            renderTab();
        });
    });
    container.querySelectorAll('[data-vendor-id]').forEach((button) => {
        button.addEventListener('click', () => {
            state.selectedVendorId = button.dataset.vendorId;
            container.querySelectorAll('[data-vendor-id]').forEach((other) => {
                other.setAttribute('aria-current', String(other === button));
            });
            renderVendorDetail(container.querySelector('.admin-vendor-detail'), isCurrent);
        });
    });

    if (state.selectedVendorId && vendors.some((vendor) => vendor.id === state.selectedVendorId)) {
        renderVendorDetail(container.querySelector('.admin-vendor-detail'), isCurrent);
    }
}

async function renderVendorDetail(target, isCurrent) {
    const id = state.selectedVendorId;
    target.innerHTML = emptyState(t('common.loading'));
    let vendor;
    try {
        vendor = await apiRequest(`/vendors/${encodeURIComponent(id)}`);
    } catch (error) {
        target.innerHTML = errorState(error);
        return;
    }
    if (!isCurrent() || state.selectedVendorId !== id) {
        return;
    }

    const statusLabels = { pending: t('admin.vendorStatus.pending'), approved: t('admin.vendorStatus.approved'), rejected: t('admin.vendorStatus.rejected') };

    target.innerHTML = `
        <div class="admin-detail-heading">
            <div>
                <p class="admin-eyebrow">${escapeHtml(vendor.vendor_code)} · ${escapeHtml(vendor.entity)}</p>
                <h3>${escapeHtml(vendor.vendor_name)}</h3>
                ${statusPill(vendor.status === 'approved' ? 'approved-vendor' : vendor.status, statusLabels[vendor.status])}
            </div>
        </div>

        <dl class="admin-fields">
            ${vendor.short_code ? field(t('admin.vendorCode'), vendor.short_code) : ''}
            ${field(t('admin.businessType'), businessTypeLabel(vendor.business_type))}
            ${field(t('admin.npwp'), vendor.company_npwp)}
            ${field(t('admin.address'), `${vendor.street} ${vendor.block}, ${vendor.village}, ${vendor.city}, ${vendor.province}`)}
            ${field(t('admin.phone'), vendor.phone)}
            ${field(t('admin.companyEmail'), vendor.company_email)}
            ${field(t('admin.login'), vendor.users.map((user) => user.email).join(', '))}
            ${field(t('admin.owner'), `${vendor.owner_name} (${vendor.owner_contact})`)}
            ${field(t('admin.sales'), `${vendor.sales_person} (${vendor.sales_contact})`)}
            ${field(t('admin.applied'), dateTime(vendor.submitted_at))}
            ${vendor.reviewed_at ? field(t('admin.reviewed'), t('admin.reviewedBy', { date: dateTime(vendor.reviewed_at), email: vendor.reviewed_by_email ?? '-' })) : ''}
            ${vendor.review_note ? field(t('admin.reviewNote'), vendor.review_note) : ''}
        </dl>

        <h4 class="admin-section-title">${t('admin.bankAccounts')}</h4>
        <dl class="admin-fields">
            ${vendor.bankAccounts.map((bank) => field(
                t('admin.accountN', { n: bank.account_index }),
                bankLine(bank)
            )).join('')}
        </dl>

        <h4 class="admin-section-title">${t('admin.documents')}</h4>
        <div class="admin-docs">
            ${vendor.documents.map((doc) => `
                <a class="admin-doc" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                    <span><strong>${escapeHtml(t(`vdoc.${doc.document_type}`))}</strong>${escapeHtml(doc.original_name)}</span>
                    <span>${t('common.open')} ↗</span>
                </a>
            `).join('')}
        </div>

        ${vendor.status === 'pending' ? `
            <h4 class="admin-section-title">${t('admin.decision')}</h4>
            <label class="admin-field">
                ${t('admin.vendorCodeLabel')}
                <input class="admin-vendor-code" type="text" maxlength="3" autocomplete="off"
                    placeholder="${escapeHtml(vendor.suggested_code ?? '')}">
            </label>
            <p class="admin-hint">${escapeHtml(t('admin.vendorCodeHelp', { code: vendor.suggested_code ?? '' }))}</p>
            <label class="admin-field">
                ${t('admin.decisionNote')}
                <textarea class="admin-vendor-note" maxlength="1000"></textarea>
            </label>
            <p class="admin-message" role="status" hidden></p>
            <div class="admin-actions">
                <button class="admin-button admin-button-danger" type="button" data-decision="reject">${t('admin.rejectVendor')}</button>
                <button class="admin-button admin-button-success" type="button" data-decision="approve">${t('admin.approveVendor')}</button>
            </div>
        ` : ''}
    `;

    target.querySelectorAll('[data-decision]').forEach((button) => {
        button.addEventListener('click', async () => {
            const decision = button.dataset.decision;
            const note = target.querySelector('.admin-vendor-note').value.trim();
            const shortCode = target.querySelector('.admin-vendor-code').value.trim().toUpperCase();
            const message = target.querySelector('.admin-message');
            const buttons = target.querySelectorAll('[data-decision]');

            if (decision === 'reject' && !note) {
                message.textContent = t('admin.rejectNoteRequired');
                message.dataset.kind = 'error';
                message.hidden = false;
                return;
            }
            if (decision === 'approve' && shortCode && !/^[A-Z]{3}$/.test(shortCode)) {
                message.textContent = t('admin.vendorCodeInvalid');
                message.dataset.kind = 'error';
                message.hidden = false;
                return;
            }

            buttons.forEach((b) => { b.disabled = true; });
            try {
                await apiRequest(`/vendors/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: { note, shortCode } });
                state.selectedVendorId = null;
                renderTab();
            } catch (error) {
                message.textContent = error.message;
                message.dataset.kind = 'error';
                message.hidden = false;
                buttons.forEach((b) => { b.disabled = false; });
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function renderUsers(container, isCurrent) {
    let users;
    try {
        users = await apiRequest('/users');
    } catch (error) {
        if (isCurrent()) {
            container.innerHTML = errorState(error);
        }
        return;
    }
    if (!isCurrent()) {
        return;
    }
    const me = getCurrentUser();
    const flash = state.usersFlash;
    state.usersFlash = '';

    container.innerHTML = `
        <section class="admin-panel" aria-label="${t('admin.createStaff')}">
            <header class="admin-panel-header"><h2>${t('admin.createStaff')}</h2></header>
            <div class="admin-panel-body">
                <form class="admin-form admin-staff-form">
                    <label class="admin-field">
                        ${t('admin.email')}
                        <input name="email" type="email" autocomplete="off" required>
                    </label>
                    <label class="admin-field">
                        ${t('admin.initialPassword')}
                        <input name="password" type="password" autocomplete="new-password" minlength="8" required>
                    </label>
                    <label class="admin-field">
                        ${t('admin.role')}
                        <select name="role" required>
                            <option value="verification">${roleLabel('verification')}</option>
                            <option value="treasury">${roleLabel('treasury')}</option>
                            <option value="admin">${roleLabel('admin')}</option>
                        </select>
                    </label>
                    <button class="admin-button" type="submit">${t('admin.createAccount')}</button>
                </form>
                <p class="admin-message" role="status" data-kind="success" ${flash ? '' : 'hidden'}>${escapeHtml(flash)}</p>
            </div>
        </section>

        <section class="admin-panel" aria-label="${t('admin.allAccounts')}">
            <header class="admin-panel-header">
                <h2>${t('admin.allAccounts')}</h2>
                <span class="admin-status">${t('admin.accountCount', { count: users.length })}</span>
            </header>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>${t('admin.col.email')}</th><th>${t('admin.col.role')}</th><th>${t('admin.col.company')}</th><th>${t('admin.col.status')}</th><th>${t('admin.col.created')}</th><th></th></tr>
                    </thead>
                    <tbody>
                        ${users.map((user) => `
                            <tr>
                                <td>${escapeHtml(user.email)}</td>
                                <td>${escapeHtml(roleLabel(user.role))}</td>
                                <td>${user.vendor_name
                                    ? `${escapeHtml(user.vendor_name)} <span class="admin-muted">(${escapeHtml(user.company_status)})</span>`
                                    : `<span class="admin-muted">${t('nav.pykStaff')}</span>`}</td>
                                <td>${user.is_active ? statusPill('active', t('admin.active')) : statusPill('inactive', t('admin.inactive'))}</td>
                                <td>${dateTime(user.created_at)}</td>
                                <td>${user.id === me?.id ? `<span class="admin-muted">${t('admin.you')}</span>` : `
                                    <button class="admin-button" type="button" data-user-id="${escapeHtml(user.id)}"
                                        data-active="${user.is_active}">${user.is_active ? t('admin.deactivate') : t('admin.activate')}</button>`}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const form = container.querySelector('.admin-staff-form');
    const message = form.nextElementSibling;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            const { user } = await apiRequest('/users', {
                method: 'POST',
                body: {
                    email: form.elements.email.value.trim(),
                    password: form.elements.password.value,
                    role: form.elements.role.value
                }
            });
            state.usersFlash = t('admin.accountCreated', { email: user.email, role: roleLabel(user.role) });
            renderTab();
        } catch (error) {
            message.textContent = error.message;
            message.dataset.kind = 'error';
            message.hidden = false;
            submit.disabled = false;
        }
    });

    container.querySelectorAll('[data-user-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await apiRequest(`/users/${encodeURIComponent(button.dataset.userId)}`, {
                    method: 'PATCH',
                    body: { isActive: button.dataset.active !== 'true' }
                });
                renderTab();
            } catch (error) {
                button.disabled = false;
                window.alert(error.message);
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Notification log (what vendors were "emailed")
// ---------------------------------------------------------------------------

async function renderNotifications(container, isCurrent) {
    let result;
    try {
        result = await apiRequest('/notifications');
    } catch (error) {
        if (isCurrent()) {
            container.innerHTML = errorState(error);
        }
        return;
    }
    if (!isCurrent()) {
        return;
    }

    const kindLabel = (kind) => t(`admin.kind.${kind}`);
    const kindStatus = { invoice_approved: 'approved', invoice_rejected: 'rejected', invoice_paid: 'paid' };

    container.innerHTML = `
        <section class="admin-panel" aria-label="${t('admin.tab.notifications')}">
            <header class="admin-panel-header">
                <h2>${t('admin.notificationsSent')}</h2>
                <span class="admin-status">${t('admin.messageCount', { count: result.notifications.length })}</span>
            </header>
            <div class="admin-list">
                ${result.notifications.length ? result.notifications.map((note) => `
                    <details class="admin-mail">
                        <summary>
                            <span>${statusPill(kindStatus[note.kind], kindLabel(note.kind))} <strong>${escapeHtml(note.subject)}</strong></span>
                            <span class="admin-muted">${escapeHtml(note.vendor_name)} &lt;${escapeHtml(note.company_email)}&gt; · ${dateTime(note.created_at)}${note.read_at ? t('admin.read') : ''}</span>
                        </summary>
                        <p>${escapeHtml(note.body)}</p>
                    </details>
                `).join('') : emptyState(t('admin.noNotifications'))}
            </div>
        </section>
    `;
}
