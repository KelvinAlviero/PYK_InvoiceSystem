import { apiRequest } from '../../authService.js';
import { t } from '../../i18n.js';

// Vendor dashboard: the vendor's own invoices, loaded from the API.
// "Add new invoice" submits a new one; a rejected ("Tidak Sesuai") invoice can be
// opened, fixed and resubmitted; everything else opens read-only.

function statusLabel(status) {
    return t(`status.${status}`);
}

// form field name -> API field name / document type
const TEXT_FIELDS = {
    'branch-name': 'branchName',
    'price': 'amount',
    'po-number': 'poNumber',
    'invoice-number': 'invoiceNumber',
    'vendor-note': 'vendorNote'
};
const FILE_FIELDS = [
    { name: 'purchase-order', apiField: 'purchaseOrder', type: 'purchase_order', required: true },
    { name: 'good-receipt', apiField: 'goodsReceipt', type: 'goods_receipt', required: true },
    { name: 'supplier-invoice', apiField: 'supplierInvoice', type: 'supplier_invoice', required: true },
    { name: 'travel-note', apiField: 'deliveryNote', type: 'delivery_note', required: true },
    { name: 'tax-invoice', apiField: 'taxInvoice', type: 'tax_invoice', required: true },
    { name: 'notes', apiField: 'notesDocument', type: 'notes', required: false }
];

let invoices = [];

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

function renderRows() {
    if (!invoices.length) {
        return `<tr><td colspan="7">${escapeHtml(t('vendor.empty'))}</td></tr>`;
    }
    return invoices.map((invoice, index) => `
        <tr>
            <td>${escapeHtml(invoice.invoice_code)}</td>
            <td>${escapeHtml(invoice.branch_name)}</td>
            <td>${escapeHtml(invoice.po_number)}<br><small>${escapeHtml(invoice.invoice_number)}</small></td>
            <td>${rupiah(invoice.amount)}</td>
            <td><span class="table-status">${escapeHtml(statusLabel(invoice.status))}</span></td>
            <td>${escapeHtml(invoice.status === 'rejected' ? invoice.ap_note : (invoice.revision > 1 ? t('common.revision', { n: invoice.revision }) : '-'))}</td>
            <td><button class="table-action" type="button" data-invoice-index="${index}">
                ${invoice.status === 'rejected' ? t('vendor.revise') : t('vendor.view')}
            </button></td>
        </tr>
    `).join('');
}

// Display for the vendor dashboard
export function UserView() {
    return `
        <section class="box top-box" >
            <button class="invoice-button" type="button" aria-controls="invoice-modal" aria-expanded="false">
                <span class="invoice-button-mark" aria-hidden="true">+</span>
                <span>${t('vendor.add')}</span>
            </button>
        </section>
        <section class="box center-box" aria-label="${t('vendor.tableCaption')}">
            <div class="invoice-table-wrapper">
                <table class="invoice-table">
                    <caption class="visually-hidden">${t('vendor.tableCaption')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">${t('vendor.col.id')}</th>
                            <th scope="col">${t('vendor.col.branch')}</th>
                            <th scope="col">${escapeHtml(t('vendor.col.po'))}</th>
                            <th scope="col">${t('vendor.col.total')}</th>
                            <th scope="col">${t('vendor.col.status')}</th>
                            <th scope="col">${t('vendor.col.notes')}</th>
                            <th scope="col">${t('vendor.col.action')}</th>
                        </tr>
                    </thead>
                    <tbody class="invoice-table-body">
                        <tr><td colspan="7">${t('common.loading')}</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
        <div class="invoice-modal-backdrop" aria-hidden="true"></div>
        <section class="invoice-modal" id="invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title" aria-hidden="true" inert>
            <header class="invoice-modal-header">
                <h2 id="invoice-modal-title">${t('vendor.modal.add')}</h2>
                <button class="invoice-modal-close" type="button" aria-label="${t('vendor.modal.close')}">X</button>
            </header>
            <form class="invoice-form">
                <p class="invoice-form-review" hidden></p>
                <div class="invoice-form-body">
                    <fieldset class="invoice-details">
                        <legend>${t('vendor.details')}</legend>
                        <label>
                            ${t('vendor.branch')}
                            <input type="text" name="branch-name" maxlength="200" required>
                        </label>
                        <label>
                            ${t('vendor.price')}
                            <input type="number" name="price" min="1" step="0.01" required>
                        </label>
                        <label>
                            ${t('vendor.po')}
                            <input type="text" name="po-number" maxlength="200" required>
                        </label>
                        <label>
                            ${t('vendor.invoiceNumber')}
                            <input type="text" name="invoice-number" maxlength="200" required>
                        </label>
                        <label>
                            ${t('vendor.note')}
                            <input type="text" name="vendor-note" maxlength="1000">
                        </label>
                    </fieldset>
                    <fieldset class="invoice-documents">
                        <legend>${t('vendor.documents')}</legend>
                        ${FILE_FIELDS.map((file) => `
                            <label class="file-field">
                                ${escapeHtml(t(`vendor.file.${file.name}`))}
                                <input type="file" name="${file.name}" accept=".pdf,application/pdf" ${file.required ? 'required' : ''}>
                            </label>
                        `).join('')}
                    </fieldset>
                </div>
                <p class="invoice-form-message" role="alert" hidden></p>
                <div class="invoice-form-actions">
                    <button class="invoice-cancel" type="button">${t('common.cancel')}</button>
                    <button class="invoice-submit" type="submit">${t('vendor.submit')}</button>
                </div>
            </form>
        </section>
    `;
}

// Loads the vendor's invoices and wires the table + modal. Call after UserView() is in the page.
export function attachInvoiceModalListeners() {
    const tableBody = document.querySelector('.invoice-table-body');
    const invoiceButton = document.querySelector('.invoice-button');
    const modalBackdrop = document.querySelector('.invoice-modal-backdrop');
    const modal = document.querySelector('.invoice-modal');
    const closeButton = document.querySelector('.invoice-modal-close');
    const cancelButton = document.querySelector('.invoice-cancel');
    const invoiceForm = document.querySelector('.invoice-form');
    const submitButton = document.querySelector('.invoice-submit');
    const modalTitle = document.querySelector('#invoice-modal-title');
    const reviewNote = document.querySelector('.invoice-form-review');
    const formMessage = document.querySelector('.invoice-form-message');

    if (!tableBody || !invoiceButton || !modalBackdrop || !modal || !closeButton || !cancelButton
        || !invoiceForm || !submitButton || !modalTitle || !reviewNote || !formMessage) {
        return;
    }

    let activeInvoice = null;

    function showMessage(text) {
        formMessage.textContent = text;
        formMessage.hidden = !text;
    }

    async function loadInvoices() {
        try {
            invoices = await apiRequest('/invoices');
            tableBody.innerHTML = renderRows();
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(t('common.loadFailed', { error: error.message }))}</td></tr>`;
        }
    }

    // Shows the current file (with a link to open it) next to each document input.
    function showExistingFiles(invoiceDetail) {
        const documents = new Map((invoiceDetail?.documents ?? []).map((doc) => [doc.document_type, doc]));
        FILE_FIELDS.forEach((file) => {
            const field = invoiceForm.elements[file.name].closest('.file-field');
            const doc = documents.get(file.type);
            field.querySelector('.file-name')?.remove();
            field.classList.toggle('file-selected', Boolean(doc));
            if (invoiceDetail) {
                const fileName = document.createElement(doc ? 'a' : 'span');
                fileName.className = 'file-name';
                fileName.textContent = doc ? doc.original_name : t('vendor.noFile');
                if (doc) {
                    fileName.href = doc.url;
                    fileName.target = '_blank';
                    fileName.rel = 'noopener';
                }
                field.append(fileName);
            }
        });
    }

    function setModalMode(mode) {
        const isAddMode = mode === 'add';
        const isRevisionMode = mode === 'revision';
        const isReadOnly = !isAddMode && !isRevisionMode;

        modalTitle.textContent = isAddMode
            ? t('vendor.modal.add')
            : isRevisionMode ? t('vendor.modal.revise') : t('vendor.modal.view');
        submitButton.hidden = isReadOnly;
        submitButton.textContent = isRevisionMode ? t('vendor.resubmit') : t('vendor.submit');
        cancelButton.textContent = isReadOnly ? t('common.close') : t('common.cancel');

        invoiceForm.querySelectorAll('input').forEach((input) => {
            input.disabled = isReadOnly;
            if (input.type === 'file') {
                // New invoices need the 5 required PDFs; a revision only uploads what changed.
                const file = FILE_FIELDS.find((f) => f.name === input.name);
                input.required = isAddMode && file.required;
            }
        });
    }

    function setModalOpen(isOpen, mode = 'add') {
        document.body.classList.toggle('invoice-modal-open', isOpen);
        invoiceButton.setAttribute('aria-expanded', String(isOpen));
        modal.setAttribute('aria-hidden', String(!isOpen));
        modal.inert = !isOpen;
        showMessage('');

        if (isOpen) {
            setModalMode(mode);
            invoiceForm.querySelector('input:not([disabled])')?.focus();
        } else {
            activeInvoice = null;
            invoiceButton.focus();
        }
    }

    invoiceButton.addEventListener('click', () => {
        invoiceForm.reset();
        reviewNote.hidden = true;
        showExistingFiles(null);
        setModalOpen(true, 'add');
    });
    closeButton.addEventListener('click', () => setModalOpen(false));
    cancelButton.addEventListener('click', () => setModalOpen(false));
    modalBackdrop.addEventListener('click', () => setModalOpen(false));

    tableBody.addEventListener('click', async (event) => {
        const viewButton = event.target.closest('.table-action');
        const invoice = invoices[Number(viewButton?.dataset.invoiceIndex)];
        if (!invoice) {
            return;
        }

        let detail;
        try {
            detail = await apiRequest(`/invoices/${encodeURIComponent(invoice.id)}`);
        } catch (error) {
            window.alert(error.message);
            return;
        }

        invoiceForm.reset();
        activeInvoice = detail;
        invoiceForm.elements['branch-name'].value = detail.branch_name;
        invoiceForm.elements.price.value = Number(detail.amount);
        invoiceForm.elements['po-number'].value = detail.po_number;
        invoiceForm.elements['invoice-number'].value = detail.invoice_number;
        invoiceForm.elements['vendor-note'].value = detail.vendor_note ?? '';
        showExistingFiles(detail);

        const reviewLines = [t('vendor.statusLine', { status: statusLabel(detail.status) })];
        if (detail.ap_note) {
            reviewLines.push(t('vendor.apNote', { note: detail.ap_note }));
        }
        if (detail.status === 'paid') {
            reviewLines.push(t('vendor.paidVia', { method: detail.payment_method, reference: detail.payment_reference }));
        }
        reviewNote.textContent = reviewLines.join(' · ');
        reviewNote.hidden = false;

        setModalOpen(true, detail.status === 'rejected' ? 'revision' : 'view');
    });

    invoiceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const isRevision = activeInvoice?.status === 'rejected';
        if (activeInvoice && !isRevision) {
            return;
        }
        if (!invoiceForm.reportValidity()) {
            return;
        }

        const body = new FormData();
        for (const [formName, apiName] of Object.entries(TEXT_FIELDS)) {
            body.append(apiName, invoiceForm.elements[formName].value.trim());
        }
        for (const file of FILE_FIELDS) {
            const chosen = invoiceForm.elements[file.name].files[0];
            if (!chosen) {
                continue;
            }
            if (!chosen.type.includes('pdf') && !chosen.name.toLowerCase().endsWith('.pdf')) {
                showMessage(t('common.notPdf', { name: chosen.name }));
                return;
            }
            if (chosen.size > 5 * 1024 * 1024) {
                showMessage(t('common.fileTooLarge', { name: chosen.name }));
                return;
            }
            body.append(file.apiField, chosen, chosen.name);
        }

        submitButton.disabled = true;
        try {
            await apiRequest(
                isRevision ? `/invoices/${encodeURIComponent(activeInvoice.id)}/resubmit` : '/invoices',
                { method: 'POST', body }
            );
            setModalOpen(false);
            await loadInvoices();
        } catch (error) {
            showMessage(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    invoiceForm.querySelectorAll('input[type="file"]').forEach((fileInput) => {
        fileInput.addEventListener('change', () => {
            fileInput.closest('.file-field')?.classList.toggle('file-selected', fileInput.files.length > 0);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('invoice-modal-open')) {
            setModalOpen(false);
        }
    });

    loadInvoices();
}
