// Small helpers shared by the AP Verification and Treasury pages.
import { getLocale, t } from '../../i18n.js';

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function rupiah(value) {
    return `Rp ${Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
}

export function dateTime(value) {
    return value
        ? new Date(value).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' })
        : '-';
}

const DOCUMENT_TYPES = [
    'purchase_order', 'goods_receipt', 'supplier_invoice', 'delivery_note',
    'tax_invoice', 'notes', 'payment_proof'
];

// One link per uploaded PDF (opens in a new tab). Missing optional files are skipped.
export function renderDocumentLinks(documents) {
    const byType = new Map(documents.map((doc) => [doc.document_type, doc]));
    const links = DOCUMENT_TYPES
        .filter((type) => byType.has(type))
        .map((type) => {
            const label = t(`doc.${type}`);
            const doc = byType.get(type);
            return `
                <a class="invoice-doc-link" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                    <span><strong>${escapeHtml(label)}</strong>${escapeHtml(doc.original_name)}</span>
                    <span aria-hidden="true">${t('common.open')} ↗</span>
                </a>
            `;
        });
    return `<div class="invoice-doc-links">${links.join('')}</div>`;
}

// The left-hand card used by both lists.
export function renderInvoiceCard(invoice, index, statusText) {
    return `
        <button class="invoice-card" type="button" data-invoice-index="${index}" aria-pressed="false">
            <span class="invoice-card-topline">
                <span class="invoice-document-number">${escapeHtml(invoice.invoice_code)}</span>
                <span class="invoice-card-status">${escapeHtml(statusText)}</span>
            </span>
            <span class="invoice-card-vendor">${escapeHtml(invoice.vendor_name)}</span>
            <span class="invoice-card-bottomline">
                <span>PO: ${escapeHtml(invoice.po_number)}</span>
                <strong>${rupiah(invoice.amount)}</strong>
            </span>
        </button>
    `;
}
