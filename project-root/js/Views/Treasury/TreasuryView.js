import { apiRequest } from '../../authService.js';
import { dateTime, escapeHtml, renderDocumentLinks, renderInvoiceCard, rupiah } from '../components/invoiceShared.js';

// Treasury: invoices AP marked SESUAI ("Siap Dibayar"), oldest first. Treasury fills
// in the transfer details, attaches the proof, confirms, and the invoice becomes Lunas.

// Values must match the API (PAYMENT_METHODS in server/routes/invoices.js).
const PAYMENT_METHODS = [
    ['RTGS/SKN', 'Bank Transfer (RTGS / SKN)'],
    ['BI-FAST', 'Bank Transfer (BI-FAST)'],
    ['Giro/Cek', 'Giro / Cek Perusahaan']
];
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
                    <p class="treasury-po-detail">PO: ${escapeHtml(invoice.po_number)} · Invoice: ${escapeHtml(invoice.invoice_number)}</p>
                    <p class="treasury-po-detail">Disetujui AP: ${dateTime(invoice.ap_reviewed_at)}${invoice.ap_note ? ` · ${escapeHtml(invoice.ap_note)}` : ''}</p>
                </div>
                <div class="treasury-summary-amount">
                    <span>Jumlah Pembayaran</span>
                    <strong>${rupiah(invoice.amount)}</strong>
                </div>
            </div>

            <form class="transfer-form" id="transfer-form" novalidate>
                <h2>FORM TRANSFER</h2>
                ${renderDocumentLinks(invoice.documents)}

                <div class="transfer-form-grid">
                    <label class="transfer-field">
                        <span>Rekening Tujuan</span>
                        <select id="paid-to-account" name="paidToAccount" required>
                            ${invoice.bankAccounts.map((bank) => `
                                <option value="${bank.account_index}">
                                    ${escapeHtml(bank.bank_name)} ${escapeHtml(bank.account_number)} AN ${escapeHtml(bank.account_holder)}
                                </option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="transfer-field">
                        <span>Metode Pembayaran</span>
                        <select id="payment-method" name="paymentMethod" required>
                            ${PAYMENT_METHODS.map(([value, label], index) => `
                                <option value="${value}" ${index === 0 ? 'selected' : ''}>${label}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="transfer-field">
                        <span>Nomor Referensi Bank / No. Resi</span>
                        <input
                            id="bank-reference"
                            name="bankReference"
                            type="text"
                            placeholder="Masukkan nomor referensi"
                            autocomplete="off"
                            maxlength="100"
                            required
                        >
                    </label>

                    <div class="transfer-proof-field">
                        <label class="transfer-field-label" for="proof-file">
                            Lampiran Bukti Pembayaran (PDF)
                        </label>
                        <div class="proof-file-card">
                            <span class="proof-file-type" id="proof-file-type" aria-hidden="true">PDF</span>
                            <span class="proof-file-name" id="proof-file-name">Belum ada file dipilih</span>
                            <span class="proof-file-status" id="proof-file-status">Required</span>
                            <label class="proof-choose-button" for="proof-file">Pilih File</label>
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
                        <p class="proof-help">Format yang didukung: PDF. Maksimal 5 MB.</p>
                    </div>
                </div>

                <p class="transfer-feedback" id="transfer-feedback" role="status" aria-live="polite"></p>

                <div class="transfer-form-actions">
                    <button class="transfer-submit-button" type="submit">
                        Bayar dan Kirim
                    </button>
                </div>
            </form>

            <!-- Confirmation pop-up shown after the payment form passes validation. -->
            <div class="payment-confirmation-backdrop" id="payment-confirmation-modal" hidden>
                <section class="payment-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title" aria-describedby="payment-confirmation-message">
                    <div class="payment-confirmation-icon" aria-hidden="true">?</div>
                    <h2 id="payment-confirmation-title">Konfirmasi Pembayaran</h2>
                    <p id="payment-confirmation-message">Apakah Anda yakin? Pastikan semua informasi sudah benar sebelum mengirimkannya.</p>
                    <div class="payment-confirmation-actions">
                        <button class="payment-confirmation-cancel" type="button">Batal</button>
                        <button class="payment-confirmation-accept" type="button">Ya, Kirim</button>
                    </div>
                </section>
            </div>
        </div>
    `;
}

export function TreasuryView() {
    const html = `
        <section class="invoice-layout" aria-label="Treasury dashboard">
            <section class="invoice-list-panel" aria-labelledby="ready-invoices-title">
                <header class="invoice-list-header">
                    <h1 id="ready-invoices-title">Siap Dibayar</h1>
                    <span class="invoice-count">... Tagihan</span>
                </header>

                <div class="invoice-list" aria-label="Daftar tagihan siap dibayar">
                    <p class="invoice-list-empty">Loading...</p>
                </div>
            </section>

            <section class="invoice-detail-panel" aria-label="Detail tagihan">
                <div class="invoice-detail-header" aria-hidden="true"></div>
                <div class="invoice-detail-body" aria-live="polite">
                    <p class="empty-detail-message">Pilih tagihan di treasury</p>
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
            showFeedback('Vendor ini belum memiliki data rekening. Pembayaran tidak bisa diproses.', 'is-danger');
            return;
        }

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            clearFeedback();
            preview.replaceChildren();
            preview.hidden = true;

            if (!file) {
                fileName.textContent = 'Belum ada file dipilih';
                fileStatus.textContent = 'Required';
                fileStatus.classList.remove('is-ready');
                fileInput.setCustomValidity('Lampirkan bukti pembayaran terlebih dahulu.');
                return;
            }

            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                fileInput.value = '';
                fileInput.setCustomValidity('Gunakan file PDF.');
                fileInput.reportValidity();
                fileName.textContent = 'Format file tidak didukung';
                fileStatus.textContent = 'Invalid';
                fileStatus.classList.remove('is-ready');
                return;
            }

            if (file.size > MAX_PROOF_BYTES) {
                fileInput.value = '';
                fileInput.setCustomValidity('Ukuran file maksimal 5 MB.');
                fileInput.reportValidity();
                fileName.textContent = 'File melebihi 5 MB';
                fileStatus.textContent = 'Too large';
                fileStatus.classList.remove('is-ready');
                return;
            }

            fileInput.setCustomValidity('');
            fileName.textContent = file.name;
            fileStatus.textContent = 'Ready';
            fileStatus.classList.add('is-ready');

            const pdfMessage = document.createElement('span');
            pdfMessage.textContent = `PDF siap dilampirkan: ${file.name}`;
            preview.append(pdfMessage);
            preview.hidden = false;
        });

        form.querySelectorAll('input, select').forEach((field) => {
            field.addEventListener('input', clearFeedback);
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!fileInput.files?.length) {
                fileInput.setCustomValidity('Lampirkan bukti pembayaran terlebih dahulu.');
            }
            if (!form.reportValidity()) return;

            modal.hidden = false;
            modalCancelButton.focus();
        });

        acceptButton.addEventListener('click', async () => {
            modal.hidden = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Memproses...';

            const body = new FormData();
            body.append('paymentMethod', form.elements.paymentMethod.value);
            body.append('paymentReference', form.elements.bankReference.value.trim());
            body.append('paidToAccount', form.elements.paidToAccount.value);
            body.append('paymentProof', fileInput.files[0], fileInput.files[0].name);

            try {
                await apiRequest(`/invoices/${encodeURIComponent(invoice.id)}/pay`, { method: 'POST', body });
                onPaid(`${invoice.invoice_code} sudah dibayar. Vendor menerima notifikasi pembayaran dan bukti transfer.`);
            } catch (error) {
                showFeedback(error.message, 'is-danger');
                submitButton.disabled = false;
                submitButton.textContent = 'Bayar dan Kirim';
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
        detailBody.innerHTML = `<p class="empty-detail-message">${escapeHtml(message || 'Pilih tagihan di treasury')}</p>`;

        try {
            treasuryInvoices = (await apiRequest('/invoices?status=approved'))
                .sort((a, b) => new Date(a.ap_reviewed_at) - new Date(b.ap_reviewed_at)); // oldest approval first
        } catch (error) {
            list.innerHTML = `<p class="invoice-list-empty">Gagal memuat: ${escapeHtml(error.message)}</p>`;
            return;
        }

        count.textContent = `${treasuryInvoices.length} Tagihan`;
        list.innerHTML = treasuryInvoices.length
            ? treasuryInvoices.map((invoice, index) => renderInvoiceCard(invoice, index, 'AP Verified')).join('')
            : '<p class="invoice-list-empty">Tidak ada tagihan yang siap dibayar.</p>';

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
