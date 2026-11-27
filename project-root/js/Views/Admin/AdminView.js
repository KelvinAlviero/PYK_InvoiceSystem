import { apiRequest, getCurrentUser } from '../../authService.js';

// Admin dashboard: monitor the invoice pipeline, approve vendor registrations,
// manage logins, and read the notification log. AP and Treasury decisions on
// invoices stay on their own pages; here they are read-only.

const TABS = [
    { id: 'pipeline', label: 'Invoice pipeline' },
    { id: 'vendors', label: 'Vendor registrations' },
    { id: 'users', label: 'Users' },
    { id: 'notifications', label: 'Notification log' }
];

const INVOICE_STAGES = [
    { status: 'submitted', label: '1. Menunggu Verifikasi AP' },
    { status: 'rejected', label: 'Tidak Sesuai (Revisi Vendor)' },
    { status: 'approved', label: '2. Sesuai · Siap Dibayar' },
    { status: 'paid', label: '3. Lunas / Dibayar' }
];

const INVOICE_STATUS_LABELS = {
    submitted: 'Menunggu Verifikasi AP',
    rejected: 'Tidak Sesuai',
    approved: 'Sesuai · Proses Treasury',
    paid: 'Lunas'
};

const INVOICE_DOCUMENTS = [
    ['purchase_order', 'Purchase Order (PO)'],
    ['goods_receipt', 'Goods Receipt (GR)'],
    ['supplier_invoice', 'Invoice Supplier'],
    ['delivery_note', 'Surat Jalan'],
    ['tax_invoice', 'Faktur Pajak'],
    ['notes', 'Notes (opsional)'],
    ['payment_proof', 'Bukti Transfer']
];

const VENDOR_DOCUMENT_LABELS = {
    terms_of_payment: 'Terms of Payment',
    company_information: 'Informasi Perusahaan',
    bank_information: 'Data Bank',
    extras: 'Dokumen Tambahan',
    business_license: 'NIB',
    tax_document: 'NPWP',
    identity_document: 'KTP',
    establishment_deed: 'Akta Pendirian',
    ministry_approval: 'SK Kemenkumham'
};

const EVENT_LABELS = {
    submitted: 'Disubmit vendor',
    resubmitted: 'Disubmit ulang (revisi)',
    approved: 'AP: Sesuai',
    rejected: 'AP: Tidak Sesuai',
    paid: 'Treasury: Dibayar'
};

const ROLE_LABELS = { vendor: 'Vendor', verification: 'AP Verification', treasury: 'Treasury', admin: 'Admin' };

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
        ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
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
    return `<p class="admin-empty">Could not load: ${escapeHtml(error.message)}</p>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function AdminView() {
    const html = `
        <section class="admin-page" aria-label="Admin dashboard">
            <header class="admin-header">
                <div>
                    <h1>Admin dashboard</h1>
                    <p>Pantau alur tagihan, setujui vendor baru, dan kelola akun.</p>
                </div>
                <nav class="admin-tabs" role="tablist" aria-label="Admin sections">
                    ${TABS.map((tab) => `
                        <button class="admin-tab" type="button" role="tab" data-tab="${tab.id}"
                            aria-selected="${tab.id === state.tab}">${escapeHtml(tab.label)}</button>
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
    container.innerHTML = emptyState('Loading...');
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

    const filterLabel = state.invoiceStatus ? INVOICE_STATUS_LABELS[state.invoiceStatus] : 'Semua tagihan';

    container.innerHTML = `
        <div class="admin-stages">
            ${INVOICE_STAGES.map(({ status, label }) => `
                <button class="admin-stage" type="button" data-status="${status}"
                    aria-pressed="${state.invoiceStatus === status}">
                    <span class="admin-stage-label">${escapeHtml(label)}</span>
                    <span class="admin-stage-count">${stats[status].count}</span>
                    <span class="admin-stage-total">${rupiah(stats[status].total)}</span>
                </button>
            `).join('')}
        </div>
        <div class="admin-split">
            <section class="admin-panel" aria-label="Invoice list">
                <header class="admin-panel-header">
                    <h2>${escapeHtml(filterLabel)}</h2>
                    <span class="admin-status">${invoices.length} tagihan</span>
                </header>
                <div class="admin-list">
                    ${invoices.length ? invoices.map((invoice) => `
                        <button class="admin-row" type="button" data-invoice-id="${escapeHtml(invoice.id)}"
                            aria-current="${invoice.id === state.selectedInvoiceId}">
                            <span class="admin-row-top">
                                <span class="admin-row-title">${escapeHtml(invoice.invoice_code)} · ${escapeHtml(invoice.vendor_name)}</span>
                                ${statusPill(invoice.status, INVOICE_STATUS_LABELS[invoice.status])}
                            </span>
                            <span class="admin-row-bottom">
                                <span class="admin-muted">${escapeHtml(invoice.branch_name)} · PO ${escapeHtml(invoice.po_number)}</span>
                                <strong>${rupiah(invoice.amount)}</strong>
                            </span>
                            <span class="admin-muted">Disubmit ${dateTime(invoice.submitted_at)}${invoice.revision > 1 ? ` · revisi ke-${invoice.revision}` : ''}</span>
                        </button>
                    `).join('') : emptyState('Belum ada tagihan di tahap ini.')}
                </div>
            </section>
            <section class="admin-panel" aria-label="Invoice detail">
                <header class="admin-panel-header"><h2>Detail tagihan</h2></header>
                <div class="admin-panel-body admin-invoice-detail">
                    ${emptyState('Pilih tagihan di sebelah kiri untuk melihat dokumen dan riwayatnya.')}
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
    target.innerHTML = emptyState('Loading...');
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
                ${statusPill(invoice.status, INVOICE_STATUS_LABELS[invoice.status])}
            </div>
            <div>
                <p class="admin-eyebrow">TOTAL TAGIHAN</p>
                <div class="admin-amount">${rupiah(invoice.amount)}</div>
            </div>
        </div>

        <dl class="admin-fields">
            ${field('Nama Cabang', invoice.branch_name)}
            ${field('No. PO', invoice.po_number)}
            ${field('No. Invoice Vendor', invoice.invoice_number)}
            ${field('Revisi', String(invoice.revision))}
            ${field('Disubmit', dateTime(invoice.submitted_at))}
            ${field('Catatan Vendor', invoice.vendor_note)}
            ${invoice.ap_note ? field('Catatan AP', invoice.ap_note) : ''}
            ${invoice.status === 'paid' ? `
                ${field('Dibayar', dateTime(invoice.paid_at))}
                ${field('Metode', invoice.payment_method)}
                ${field('No. Referensi Bank', invoice.payment_reference)}
                ${field('Rekening Tujuan', paidAccount
                    ? `${paidAccount.bank_name} ${paidAccount.account_number} a.n. ${paidAccount.account_holder}`
                    : `Rekening ${invoice.paid_to_account}`)}
            ` : ''}
        </dl>

        <h4 class="admin-section-title">Dokumen</h4>
        <div class="admin-docs">
            ${INVOICE_DOCUMENTS.map(([type, label]) => {
                const doc = documents.get(type);
                return doc
                    ? `<a class="admin-doc" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                            <span><strong>${escapeHtml(label)}</strong>${escapeHtml(doc.original_name)}</span><span>Buka ↗</span>
                       </a>`
                    : `<span class="admin-doc" aria-disabled="true">
                            <span><strong>${escapeHtml(label)}</strong>Tidak ada</span>
                       </span>`;
            }).join('')}
        </div>

        <h4 class="admin-section-title">Rekening Vendor</h4>
        <dl class="admin-fields">
            ${invoice.bankAccounts.map((bank) => field(
                `Rekening ${bank.account_index}`,
                `${bank.bank_name} ${bank.account_number} a.n. ${bank.account_holder}`
            )).join('') || field('Rekening', 'Tidak ada data')}
        </dl>

        <h4 class="admin-section-title">Riwayat</h4>
        <ol class="admin-timeline">
            ${invoice.events.map((event) => `
                <li data-action="${escapeHtml(event.action)}">
                    <strong>${escapeHtml(EVENT_LABELS[event.action] ?? event.action)}</strong>
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

    const filters = [['pending', 'Menunggu review'], ['approved', 'Disetujui'], ['rejected', 'Ditolak']];

    container.innerHTML = `
        <div class="admin-split">
            <section class="admin-panel" aria-label="Vendor list">
                <header class="admin-panel-header">
                    <div class="admin-tabs">
                        ${filters.map(([status, label]) => `
                            <button class="admin-chip" type="button" data-vendor-status="${status}"
                                aria-pressed="${state.vendorStatus === status}">${label}</button>
                        `).join('')}
                    </div>
                    <span class="admin-status">${vendors.length} vendor</span>
                </header>
                <div class="admin-list">
                    ${vendors.length ? vendors.map((vendor) => `
                        <button class="admin-row" type="button" data-vendor-id="${escapeHtml(vendor.id)}"
                            aria-current="${vendor.id === state.selectedVendorId}">
                            <span class="admin-row-top">
                                <span class="admin-row-title">${escapeHtml(vendor.vendor_name)}</span>
                                <span class="admin-muted">${escapeHtml(vendor.vendor_code)}</span>
                            </span>
                            <span class="admin-row-bottom">
                                <span class="admin-muted">${escapeHtml(vendor.business_type)}</span>
                                <span class="admin-muted">${escapeHtml(vendor.login_email ?? '')}</span>
                            </span>
                            <span class="admin-muted">Diajukan ${dateTime(vendor.submitted_at)}</span>
                        </button>
                    `).join('') : emptyState('Tidak ada vendor di daftar ini.')}
                </div>
            </section>
            <section class="admin-panel" aria-label="Vendor detail">
                <header class="admin-panel-header"><h2>Detail vendor</h2></header>
                <div class="admin-panel-body admin-vendor-detail">
                    ${emptyState('Pilih vendor untuk melihat data dan dokumennya.')}
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
    target.innerHTML = emptyState('Loading...');
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

    const statusLabels = { pending: 'Menunggu review', approved: 'Disetujui', rejected: 'Ditolak' };

    target.innerHTML = `
        <div class="admin-detail-heading">
            <div>
                <p class="admin-eyebrow">${escapeHtml(vendor.vendor_code)} · ${escapeHtml(vendor.entity)}</p>
                <h3>${escapeHtml(vendor.vendor_name)}</h3>
                ${statusPill(vendor.status === 'approved' ? 'approved-vendor' : vendor.status, statusLabels[vendor.status])}
            </div>
        </div>

        <dl class="admin-fields">
            ${field('Tipe Bisnis', vendor.business_type)}
            ${field('NPWP Perusahaan', vendor.company_npwp)}
            ${field('Alamat', `${vendor.street} ${vendor.block}, ${vendor.village}, ${vendor.city}, ${vendor.province}`)}
            ${field('Telepon', vendor.phone)}
            ${field('Email Perusahaan', vendor.company_email)}
            ${field('Login', vendor.users.map((user) => user.email).join(', '))}
            ${field('Pemilik', `${vendor.owner_name} (${vendor.owner_contact})`)}
            ${field('Sales', `${vendor.sales_person} (${vendor.sales_contact})`)}
            ${field('Diajukan', dateTime(vendor.submitted_at))}
            ${vendor.reviewed_at ? field('Direview', `${dateTime(vendor.reviewed_at)} oleh ${vendor.reviewed_by_email ?? '-'}`) : ''}
            ${vendor.review_note ? field('Catatan Review', vendor.review_note) : ''}
        </dl>

        <h4 class="admin-section-title">Rekening Bank</h4>
        <dl class="admin-fields">
            ${vendor.bankAccounts.map((bank) => field(
                `Rekening ${bank.account_index}`,
                `${bank.bank_name} ${bank.account_number} a.n. ${bank.account_holder}`
            )).join('')}
        </dl>

        <h4 class="admin-section-title">Dokumen</h4>
        <div class="admin-docs">
            ${vendor.documents.map((doc) => `
                <a class="admin-doc" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                    <span><strong>${escapeHtml(VENDOR_DOCUMENT_LABELS[doc.document_type] ?? doc.document_type)}</strong>${escapeHtml(doc.original_name)}</span>
                    <span>Buka ↗</span>
                </a>
            `).join('')}
        </div>

        ${vendor.status === 'pending' ? `
            <h4 class="admin-section-title">Keputusan</h4>
            <label class="admin-field">
                Catatan (wajib jika ditolak)
                <textarea class="admin-vendor-note" maxlength="1000"></textarea>
            </label>
            <p class="admin-message" role="status" hidden></p>
            <div class="admin-actions">
                <button class="admin-button admin-button-danger" type="button" data-decision="reject">Tolak</button>
                <button class="admin-button admin-button-success" type="button" data-decision="approve">Setujui vendor</button>
            </div>
        ` : ''}
    `;

    target.querySelectorAll('[data-decision]').forEach((button) => {
        button.addEventListener('click', async () => {
            const decision = button.dataset.decision;
            const note = target.querySelector('.admin-vendor-note').value.trim();
            const message = target.querySelector('.admin-message');
            const buttons = target.querySelectorAll('[data-decision]');

            if (decision === 'reject' && !note) {
                message.textContent = 'Tulis catatan alasan penolakan untuk vendor.';
                message.dataset.kind = 'error';
                message.hidden = false;
                return;
            }

            buttons.forEach((b) => { b.disabled = true; });
            try {
                await apiRequest(`/vendors/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: { note } });
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
        <section class="admin-panel" aria-label="Create staff account">
            <header class="admin-panel-header"><h2>Buat akun staff</h2></header>
            <div class="admin-panel-body">
                <form class="admin-form admin-staff-form">
                    <label class="admin-field">
                        Email
                        <input name="email" type="email" autocomplete="off" required>
                    </label>
                    <label class="admin-field">
                        Password awal (min. 8)
                        <input name="password" type="password" autocomplete="new-password" minlength="8" required>
                    </label>
                    <label class="admin-field">
                        Role
                        <select name="role" required>
                            <option value="verification">AP Verification</option>
                            <option value="treasury">Treasury</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>
                    <button class="admin-button" type="submit">Buat akun</button>
                </form>
                <p class="admin-message" role="status" data-kind="success" ${flash ? '' : 'hidden'}>${escapeHtml(flash)}</p>
            </div>
        </section>

        <section class="admin-panel" aria-label="All accounts">
            <header class="admin-panel-header">
                <h2>Semua akun</h2>
                <span class="admin-status">${users.length} akun</span>
            </header>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>Email</th><th>Role</th><th>Perusahaan</th><th>Status</th><th>Dibuat</th><th></th></tr>
                    </thead>
                    <tbody>
                        ${users.map((user) => `
                            <tr>
                                <td>${escapeHtml(user.email)}</td>
                                <td>${escapeHtml(ROLE_LABELS[user.role] ?? user.role)}</td>
                                <td>${user.vendor_name
                                    ? `${escapeHtml(user.vendor_name)} <span class="admin-muted">(${escapeHtml(user.company_status)})</span>`
                                    : '<span class="admin-muted">PYK staff</span>'}</td>
                                <td>${user.is_active ? statusPill('active', 'Aktif') : statusPill('inactive', 'Nonaktif')}</td>
                                <td>${dateTime(user.created_at)}</td>
                                <td>${user.id === me?.id ? '<span class="admin-muted">Anda</span>' : `
                                    <button class="admin-button" type="button" data-user-id="${escapeHtml(user.id)}"
                                        data-active="${user.is_active}">${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>`}
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
            state.usersFlash = `Akun ${user.email} (${ROLE_LABELS[user.role]}) dibuat.`;
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

    const kindLabels = { invoice_approved: 'Sesuai', invoice_rejected: 'Tidak Sesuai', invoice_paid: 'Lunas' };
    const kindStatus = { invoice_approved: 'approved', invoice_rejected: 'rejected', invoice_paid: 'paid' };

    container.innerHTML = `
        <section class="admin-panel" aria-label="Notification log">
            <header class="admin-panel-header">
                <h2>Notifikasi terkirim ke vendor</h2>
                <span class="admin-status">${result.notifications.length} pesan</span>
            </header>
            <div class="admin-list">
                ${result.notifications.length ? result.notifications.map((note) => `
                    <details class="admin-mail">
                        <summary>
                            <span>${statusPill(kindStatus[note.kind], kindLabels[note.kind])} <strong>${escapeHtml(note.subject)}</strong></span>
                            <span class="admin-muted">${escapeHtml(note.vendor_name)} &lt;${escapeHtml(note.company_email)}&gt; · ${dateTime(note.created_at)}${note.read_at ? ' · dibaca' : ''}</span>
                        </summary>
                        <p>${escapeHtml(note.body)}</p>
                    </details>
                `).join('') : emptyState('Belum ada notifikasi.')}
            </div>
        </section>
    `;
}
