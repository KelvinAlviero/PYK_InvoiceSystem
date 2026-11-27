import { apiRequest } from '../../authService.js';
import { t } from '../../i18n.js';
import { dateTime, escapeHtml, renderDocumentLinks, renderInvoiceCard, rupiah } from '../components/invoiceShared.js';

// Treasury: invoices AP marked SESUAI ("Siap Dibayar"), oldest first. Treasury fills
// in the transfer details, attaches the proof, confirms, and the invoice becomes Lunas.

// Values must match the API (PAYMENT_METHODS in server/routes/invoices.js).
const PAYMENT_METHODS = ['RTGS/SKN', 'BI-FAST', 'Giro/Cek'];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

let treasuryInvoices = [];

function renderInvoiceDetails(invoice) {
    return `
        <div class="treasury-payment-content">
            <div class="treasury-invoice-summary">
                <div class="treasury-summary-main">
                    <p class="treasury-document-number">${escapeHtml(invoice.invoice_code)}</p>
                    <div class="treasury-vendor-route">
                        <strong>${escapeHtml(invoice.branch_name)}</strong>
                        <span aria-hidden="true">&#8594;</span>
                        <strong>${escapeHtml(invoice.vendor_name)}</strong>
                    </div>
                    <p class="treasury-po-detail">${escapeHtml(t('ap.poInvoice', { po: invoice.po_number, invoice: invoice.invoice_number }))}</p>
                    <p class="treasury-po-detail">${escapeHtml(t('tr.approvedAt', { date: dateTime(invoice.ap_reviewed_at) }))}${invoice.ap_note ? ` · ${escapeHtml(invoice.ap_note)}` : ''}</p>
                </div>
                <div class="treasury-summary-amount">
                    <span>${t('tr.amount')}</span>
                    <strong>${rupiah(invoice.amount)}</strong>
                </div>
            </div>

            <form class="transfer-form" id="transfer-form" novalidate>
                <h2>${t('tr.formTitle')}</h2>
                ${renderDocumentLinks(invoice.documents)}

                <div class="transfer-form-grid">
                    <label class="transfer-field">
                        <span>${t('tr.account')}</span>
                        <select id="paid-to-account" name="paidToAccount" required>
                            ${invoice.bankAccounts.map((bank) => `
                                <option value="${bank.account_index}">
                                    ${escapeHtml(t('common.bankAccount', { bank: bank.bank_name, number: bank.account_number, holder: bank.account_holder }))}
                                </option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="transfer-field">
                        <span>${t('tr.method')}</span>
                        <select id="payment-method" name="paymentMethod" required>
                            ${PAYMENT_METHODS.map((value, index) => `
                                <option value="${value}" ${index === 0 ? 'selected' : ''}>${t(`tr.method.${value}`)}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="transfer-field">
                        <span>${t('tr.reference')}</span>
                        <input
                            id="bank-reference"
                            name="bankReference"
                            type="text"
                            placeholder="${t('tr.referencePlaceholder')}"
                            autocomplete="off"
                            maxlength="100"
                            required
                        >
                    </label>

                    <div class="transfer-proof-field">
                        <label class="transfer-field-label" for="proof-file">
                            ${t('tr.proof')}
                        </label>
                        <div class="proof-file-card">
                            <span class="proof-file-type" id="proof-file-type" aria-hidden="true">PDF</span>
                            <span class="proof-file-name" id="proof-file-name">${t('tr.noFile')}</span>
                            <span class="proof-file-status" id="proof-file-status">${t('tr.required')}</span>
                            <label class="proof-choose-button" for="proof-file">${t('tr.chooseFile')}</label>
                            <input
                                class="visually-hidden"
                                id="proof-file"
                                name="paymentProof"
                                type="file"
                                accept="application/pdf,.pdf"
                                required
                            >
                        </div>
                        <div class="proof-preview" id="proof-preview" hidden></div>
                        <p class="proof-help">${t('tr.proofHelp')}</p>
                    </div>
                </div>

                <p class="transfer-feedback" id="transfer-feedback" role="status" aria-live="polite"></p>

                <div class="transfer-form-actions">
                    <button class="transfer-submit-button" type="submit">
                        ${t('tr.pay')}
                    </button>
                </div>
            </form>

            <!-- Confirmation pop-up shown after the payment form passes validation. -->
            <div class="payment-confirmation-backdrop" id="payment-confirmation-modal" hidden>
                <section class="payment-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title" aria-describedby="payment-confirmation-message">
                    <div class="payment-confirmation-icon" aria-hidden="true">?</div>
                    <h2 id="payment-confirmation-title">${t('tr.confirmTitle')}</h2>
                    <p id="payment-confirmation-message">${t('tr.confirmMessage')}</p>
                    <div class="payment-confirmation-actions">
                        <button class="payment-confirmation-cancel" type="button">${t('common.cancel')}</button>
                        <button class="payment-confirmation-accept" type="button">${t('tr.yesSend')}</button>
                    </div>
                </section>
            </div>
        </div>
    `;
}

export function TreasuryView() {
    const html = `
        <section class="invoice-layout" aria-label="${t('tr.ariaLabel')}">
            <section class="invoice-list-panel" aria-labelledby="ready-invoices-title">
                <header class="invoice-list-header">
                    <h1 id="ready-invoices-title">${t('tr.title')}</h1>
                    <span class="invoice-count">${t('common.invoiceCount', { count: '...' })}</span>
                </header>

                <div class="invoice-list" aria-label="${t('tr.listLabel')}">
                    <p class="invoice-list-empty">${t('common.loading')}</p>
                </div>
            </section>

            <section class="invoice-detail-panel" aria-label="${t('tr.detailLabel')}">
                <div class="invoice-detail-header" aria-hidden="true"></div>
                <div class="invoice-detail-body" aria-live="polite">
                    <p class="empty-detail-message">${t('tr.choose')}</p>
                </div>
            </section>
        </section>
    `;

    function attachPaymentFormListeners(detailBody, invoice, onPaid) {
        const form = detailBody.querySelector('#transfer-form');
        if (!form) return;

        const fileInput = form.querySelector('#proof-file');
        const fileName = form.querySelector('#proof-file-name');
        const fileStatus = form.querySelector('#proof-file-status');
        const preview = form.querySelector('#proof-preview');
        const feedback = form.querySelector('#transfer-feedback');
        const submitButton = form.querySelector('.transfer-submit-button');
        const modal = detailBody.querySelector('#payment-confirmation-modal');
        const acceptButton = modal.querySelector('.payment-confirmation-accept');
        const modalCancelButton = modal.querySelector('.payment-confirmation-cancel');

        const closeConfirmation = () => {
            modal.hidden = true;
            submitButton.focus();
        };

        const showFeedback = (message, type = 'is-info') => {
            feedback.textContent = message;
            feedback.className = `transfer-feedback ${type}`;
        };

        const clearFeedback = () => {
            feedback.textContent = '';
            feedback.className = 'transfer-feedback';
        };

        if (!invoice.bankAccounts.length) {
            submitButton.disabled = true;
            showFeedback(t('tr.noBank'), 'is-danger');
            return;
        }

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            clearFeedback();
            preview.replaceChildren();
            preview.hidden = true;

            if (!file) {
                fileName.textContent = t('tr.noFile');
                fileStatus.textContent = t('tr.required');
                fileStatus.classList.remove('is-ready');
                fileInput.setCustomValidity(t('tr.proofMissing'));
                return;
            }

            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                fileInput.value = '';
                fileInput.setCustomValidity(t('tr.pdfOnly'));
                fileInput.reportValidity();
                fileName.textContent = t('tr.unsupported');
                fileStatus.textContent = t('tr.invalid');
                fileStatus.classList.remove('is-ready');
                return;
            }

            if (file.size > MAX_PROOF_BYTES) {
                fileInput.value = '';
                fileInput.setCustomValidity(t('tr.max5'));
                fileInput.reportValidity();
                fileName.textContent = t('tr.over5');
                fileStatus.textContent = t('tr.tooLarge');
                fileStatus.classList.remove('is-ready');
                return;
            }

            fileInput.setCustomValidity('');
            fileName.textContent = file.name;
            fileStatus.textContent = t('tr.ready');
            fileStatus.classList.add('is-ready');

            const pdfMessage = document.createElement('span');
            pdfMessage.textContent = t('tr.pdfReady', { name: file.name });
            preview.append(pdfMessage);
            preview.hidden = false;
        });

        form.querySelectorAll('input, select').forEach((field) => {
            field.addEventListener('input', clearFeedback);
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!fileInput.files?.length) {
                fileInput.setCustomValidity(t('tr.proofMissing'));
            }
            if (!form.reportValidity()) return;

            modal.hidden = false;
            modalCancelButton.focus();
        });

        acceptButton.addEventListener('click', async () => {
            modal.hidden = true;
            submitButton.disabled = true;
            submitButton.textContent = t('tr.processing');

            const body = new FormData();
            body.append('paymentMethod', form.elements.paymentMethod.value);
            body.append('paymentReference', form.elements.bankReference.value.trim());
            body.append('paidToAccount', form.elements.paidToAccount.value);
            body.append('paymentProof', fileInput.files[0], fileInput.files[0].name);

            try {
                await apiRequest(`/invoices/${encodeURIComponent(invoice.id)}/pay`, { method: 'POST', body });
                onPaid(t('tr.paid', { code: invoice.invoice_code }));
            } catch (error) {
                showFeedback(error.message, 'is-danger');
                submitButton.disabled = false;
                submitButton.textContent = t('tr.pay');
            }
        });

        modalCancelButton.addEventListener('click', closeConfirmation);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeConfirmation();
        });

        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeConfirmation();
            }
        });
    }

    async function loadInvoices(message = '') {
        const list = document.querySelector('.invoice-list');
        const count = document.querySelector('.invoice-count');
        const detailBody = document.querySelector('.invoice-detail-body');
        if (!list || !count || !detailBody) return;

        detailBody.classList.remove('has-payment-form');
        detailBody.innerHTML = `<p class="empty-detail-message">${escapeHtml(message || t('tr.choose'))}</p>`;

        try {
            treasuryInvoices = (await apiRequest('/invoices?status=approved'))
                .sort((a, b) => new Date(a.ap_reviewed_at) - new Date(b.ap_reviewed_at)); // oldest approval first
        } catch (error) {
            list.innerHTML = `<p class="invoice-list-empty">${escapeHtml(t('common.loadFailed', { error: error.message }))}</p>`;
            return;
        }

        count.textContent = t('common.invoiceCount', { count: treasuryInvoices.length });
        list.innerHTML = treasuryInvoices.length
            ? treasuryInvoices.map((invoice, index) => renderInvoiceCard(invoice, index, t('tr.apVerified'))).join('')
            : `<p class="invoice-list-empty">${t('tr.empty')}</p>`;

        const invoiceCards = list.querySelectorAll('.invoice-card[data-invoice-index]');
        invoiceCards.forEach((invoiceCard) => {
            invoiceCard.addEventListener('click', async () => {
                const selected = treasuryInvoices[Number(invoiceCard.dataset.invoiceIndex)];
                if (!selected) return;

                invoiceCards.forEach((card) => {
                    card.classList.remove('is-selected');
                    card.setAttribute('aria-pressed', 'false');
                });
                invoiceCard.classList.add('is-selected');
                invoiceCard.setAttribute('aria-pressed', 'true');

                try {
                    const invoice = await apiRequest(`/invoices/${encodeURIComponent(selected.id)}`);
                    detailBody.classList.add('has-payment-form');
                    detailBody.innerHTML = renderInvoiceDetails(invoice);
                    attachPaymentFormListeners(detailBody, invoice, loadInvoices);
                } catch (error) {
                    detailBody.innerHTML = `<p class="empty-detail-message">${escapeHtml(error.message)}</p>`;
                }
            });
        });
    }

    function attachListeners() {
        loadInvoices();
    }

    return { html, attachListeners };
}
