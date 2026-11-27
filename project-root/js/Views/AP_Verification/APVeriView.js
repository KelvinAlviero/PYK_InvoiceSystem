import { apiRequest } from '../../authService.js';
import { t } from '../../i18n.js';
import { dateTime, escapeHtml, renderDocumentLinks, renderInvoiceCard, rupiah } from '../components/invoiceShared.js';

// AP Verification: the queue of submitted invoices (oldest first). AP checks the
// documents, then marks the invoice SESUAI (goes to Treasury) or TIDAK SESUAI
// (goes back to the vendor with a note).

let queue = [];

//Invoice detail + decision form
function renderInvoiceDetails(invoice) {
    return `
        <div class="treasury-payment-content">
            <div class="treasury-invoice-summary">
                <div class="treasury-summary-main">
                    <p class="treasury-document-number">${escapeHtml(invoice.invoice_code)}${invoice.revision > 1 ? ` · ${t('common.revision', { n: invoice.revision })}` : ''}</p>
                    <div class="treasury-vendor-route">
                        <strong>${escapeHtml(invoice.vendor_name)}</strong>
                        <span aria-hidden="true">&#8594;</span>
                        <strong>${escapeHtml(invoice.branch_name)}</strong>
                    </div>
                    <p class="treasury-po-detail">${escapeHtml(t('ap.poInvoice', { po: invoice.po_number, invoice: invoice.invoice_number }))}</p>
                    <p class="treasury-po-detail">${escapeHtml(t('ap.submittedAt', { date: dateTime(invoice.submitted_at) }))}</p>
                    ${invoice.vendor_note ? `<p class="treasury-po-detail">${escapeHtml(t('ap.vendorNote', { note: invoice.vendor_note }))}</p>` : ''}
                </div>
                <div class="treasury-summary-amount">
                    <span>${t('ap.total')}</span>
                    <strong>${rupiah(invoice.amount)}</strong>
                </div>
            </div>

            <form class="transfer-form" id="verification-form" novalidate>
                <h2>${t('ap.verifyTitle')}</h2>
                ${renderDocumentLinks(invoice.documents)}

                <label class="transfer-field">
                    <span>${t('ap.noteLabel')}</span>
                    <textarea id="verification-note" name="note" maxlength="1000"
                        placeholder="${escapeHtml(t('ap.notePlaceholder'))}"></textarea>
                </label>

                <p class="transfer-feedback" id="verification-feedback" role="status" aria-live="polite"></p>

                <div class="transfer-form-actions">
                    <button class="transfer-reject-button" type="button" data-decision="reject">
                        ${t('ap.reject')}
                    </button>
                    <button class="transfer-submit-button" type="button" data-decision="approve">
                        ${t('ap.approve')}
                    </button>
                </div>
            </form>

            <!-- Confirmation pop-up before the decision is saved. -->
            <div class="payment-confirmation-backdrop" id="verification-confirmation-modal" hidden>
                <section class="payment-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="verification-confirmation-title" aria-describedby="verification-confirmation-message">
                    <div class="payment-confirmation-icon" aria-hidden="true">?</div>
                    <h2 id="verification-confirmation-title">${t('ap.confirmTitle')}</h2>
                    <p id="verification-confirmation-message"></p>
                    <div class="payment-confirmation-actions">
                        <button class="payment-confirmation-cancel" type="button">${t('common.cancel')}</button>
                        <button class="payment-confirmation-accept" type="button">${t('ap.yesSave')}</button>
                    </div>
                </section>
            </div>
        </div>
    `;
}

//Verification
export function VerificationView() {
    const html = `
        <section class="invoice-layout" aria-label="${t('ap.ariaLabel')}">
            <section class="invoice-list-panel" aria-labelledby="verification-invoices-title">
                <header class="invoice-list-header">
                    <h1 id="verification-invoices-title">${t('ap.title')}</h1>
                    <span class="invoice-count">${t('common.invoiceCount', { count: '...' })}</span>
                </header>

                <div class="invoice-list" aria-label="${t('ap.listLabel')}">
                    <p class="invoice-list-empty">${t('common.loading')}</p>
                </div>
            </section>

            <section class="invoice-detail-panel" aria-label="${t('ap.detailLabel')}">
                <div class="invoice-detail-header" aria-hidden="true"></div>
                <div class="invoice-detail-body" aria-live="polite">
                    <p class="empty-detail-message">${t('ap.choose')}</p>
                </div>
            </section>
        </section>
    `;

    function attachDecisionListeners(detailBody, invoice, onDone) {
        const form = detailBody.querySelector('#verification-form');
        const note = form.querySelector('#verification-note');
        const feedback = form.querySelector('#verification-feedback');
        const decisionButtons = form.querySelectorAll('[data-decision]');
        const modal = detailBody.querySelector('#verification-confirmation-modal');
        const modalMessage = modal.querySelector('#verification-confirmation-message');
        const acceptButton = modal.querySelector('.payment-confirmation-accept');
        const cancelButton = modal.querySelector('.payment-confirmation-cancel');
        let pendingDecision = null;

        const showFeedback = (message, type = 'is-info') => {
            feedback.textContent = message;
            feedback.className = `transfer-feedback ${type}`;
        };
        const closeConfirmation = () => {
            modal.hidden = true;
            pendingDecision = null;
        };

        decisionButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const decision = button.dataset.decision;
                if (decision === 'reject' && !note.value.trim()) {
                    showFeedback(t('ap.noteRequired'), 'is-danger');
                    note.focus();
                    return;
                }
                pendingDecision = decision;
                modalMessage.textContent = decision === 'approve'
                    ? t('ap.confirmApprove', { code: invoice.invoice_code })
                    : t('ap.confirmReject', { code: invoice.invoice_code });
                modal.hidden = false;
                cancelButton.focus();
            });
        });

        acceptButton.addEventListener('click', async () => {
            const decision = pendingDecision;
            modal.hidden = true;
            decisionButtons.forEach((button) => { button.disabled = true; });
            try {
                await apiRequest(`/invoices/${encodeURIComponent(invoice.id)}/verify`, {
                    method: 'POST',
                    body: { decision, note: note.value.trim() }
                });
                onDone(decision === 'approve'
                    ? t('ap.approved', { code: invoice.invoice_code })
                    : t('ap.rejected', { code: invoice.invoice_code }));
            } catch (error) {
                showFeedback(error.message, 'is-danger');
                decisionButtons.forEach((button) => { button.disabled = false; });
            }
        });

        cancelButton.addEventListener('click', closeConfirmation);
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

    async function loadQueue(message = '') {
        const list = document.querySelector('.invoice-list');
        const count = document.querySelector('.invoice-count');
        const detailBody = document.querySelector('.invoice-detail-body');
        if (!list || !count || !detailBody) return;

        detailBody.classList.remove('has-payment-form');
        detailBody.innerHTML = `<p class="empty-detail-message">${escapeHtml(message || t('ap.choose'))}</p>`;

        try {
            queue = (await apiRequest('/invoices?status=submitted'))
                .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)); // oldest first
        } catch (error) {
            list.innerHTML = `<p class="invoice-list-empty">${escapeHtml(t('common.loadFailed', { error: error.message }))}</p>`;
            return;
        }

        count.textContent = t('common.invoiceCount', { count: queue.length });
        list.innerHTML = queue.length
            ? queue.map((invoice, index) => renderInvoiceCard(
                invoice, index, invoice.revision > 1 ? t('common.revision', { n: invoice.revision }) : t('ap.new')
            )).join('')
            : `<p class="invoice-list-empty">${t('ap.empty')}</p>`;

        list.querySelectorAll('.invoice-card').forEach((invoiceCard) => {
            invoiceCard.addEventListener('click', async () => {
                const selected = queue[Number(invoiceCard.dataset.invoiceIndex)];
                if (!selected) return;

                list.querySelectorAll('.invoice-card').forEach((card) => {
                    card.classList.remove('is-selected');
                    card.setAttribute('aria-pressed', 'false');
                });
                invoiceCard.classList.add('is-selected');
                invoiceCard.setAttribute('aria-pressed', 'true');

                try {
                    const invoice = await apiRequest(`/invoices/${encodeURIComponent(selected.id)}`);
                    detailBody.classList.add('has-payment-form');
                    detailBody.innerHTML = renderInvoiceDetails(invoice);
                    attachDecisionListeners(detailBody, invoice, loadQueue);
                } catch (error) {
                    detailBody.innerHTML = `<p class="empty-detail-message">${escapeHtml(error.message)}</p>`;
                }
            });
        });
    }

    function attachListeners() {
        loadQueue();
    }

    return { html, attachListeners };
}
