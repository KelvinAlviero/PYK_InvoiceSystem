const verificationInvoice = {
    documentNumber: 'DOC-2026-002',
    vendor: 'RM Payakumbuh Ciater',
    purchaseOrder: 'PO-2026-7715',
    amount: 'Rp 48.500.000',
    status: 'Menunggu Verifikasi'
};

//Invoice format (little boxes)
function renderInvoiceDetails(invoice) {
    return `
        <div class="invoice-detail-content">
            <div class="invoice-detail-heading">
                <div>
                    <p class="detail-eyebrow">INFORMASI TAGIHAN</p>
                    <h2>${invoice.documentNumber}</h2>
                </div>
                <span class="invoice-status">${invoice.status}</span>
            </div>

            <div class="invoice-detail-grid">
                <div class="detail-field">
                    <span>Vendor</span>
                    <strong>${invoice.vendor}</strong>
                </div>
                <div class="detail-field">
                    <span>Purchase Order</span>
                    <strong>${invoice.purchaseOrder}</strong>
                </div>
                <div class="detail-field detail-field-amount">
                    <span>Total Tagihan</span>
                    <strong>${invoice.amount}</strong>
                </div>
            </div>
        </div>
    `;
}

//Verification
export function VerificationView() {
    const html = `
        <section class="invoice-layout" aria-label="AP verification dashboard">
            <section class="invoice-list-panel" aria-labelledby="verification-invoices-title">
                <header class="invoice-list-header">
                    <h1 id="verification-invoices-title">Menunggu Verifikasi</h1>
                    <span class="invoice-count">1 Tagihan</span>
                </header>

                <div class="invoice-list" aria-label="Daftar tagihan menunggu verifikasi">
                    <button class="invoice-card" type="button" aria-pressed="false">
                        <span class="invoice-card-topline">
                            <span class="invoice-document-number">${verificationInvoice.documentNumber}</span>
                            <span class="invoice-card-status">${verificationInvoice.status}</span>
                        </span>
                        <span class="invoice-card-vendor">${verificationInvoice.vendor}</span>
                        <span class="invoice-card-bottomline">
                            <span>PO: ${verificationInvoice.purchaseOrder}</span>
                            <strong>${verificationInvoice.amount}</strong>
                        </span>
                    </button>

                    <div class="invoice-skeleton" aria-hidden="true"></div>
                    <div class="invoice-skeleton" aria-hidden="true"></div>
                </div>
            </section>

            <section class="invoice-detail-panel" aria-label="Detail tagihan untuk verifikasi">
                <div class="invoice-detail-header" aria-hidden="true"></div>
                <div class="invoice-detail-body" aria-live="polite">
                    <p class="empty-detail-message">Pilih tagihan untuk diverifikasi</p>
                </div>
            </section>
        </section>
    `;

    function attachListeners() {
        const invoiceCard = document.querySelector('.invoice-card');
        const detailBody = document.querySelector('.invoice-detail-body');

        if (!invoiceCard || !detailBody) return;

        invoiceCard.addEventListener('click', () => {
            invoiceCard.classList.add('is-selected');
            invoiceCard.setAttribute('aria-pressed', 'true');
            detailBody.innerHTML = renderInvoiceDetails(verificationInvoice);
        });
    }

    return { html, attachListeners };
}
