import express from 'express';
import { query, withTransaction } from '../db.js';
import { HttpError, requireLogin, requireRole } from '../lib/auth.js';
import { filePath, removeFolder, saveFile } from '../lib/storage.js';
import { pdfFile, pdfUpload } from '../lib/uploads.js';

// Invoice flow:  vendor submits -> AP Verification approves / rejects (with a note)
//                -> vendor fixes + resubmits a rejected one -> Treasury pays approved ones.
//
// Who may do what:
//   vendor        submit, resubmit, see their own company's invoices
//   verification  see every invoice, approve / reject submitted ones
//   treasury      see approved + paid invoices (with the vendor's bank accounts), pay approved ones
//   admin         see everything (monitoring only; decisions stay with AP and Treasury)
export const invoicesRouter = express.Router();
invoicesRouter.use(requireLogin);

export const STATUSES = ['submitted', 'rejected', 'approved', 'paid'];
export const PAYMENT_METHODS = ['RTGS/SKN', 'BI-FAST', 'Giro/Cek'];

// form field name -> invoice_documents.document_type
const SUBMIT_DOCUMENTS = {
    purchaseOrder: 'purchase_order',
    goodsReceipt: 'goods_receipt',
    supplierInvoice: 'supplier_invoice',
    deliveryNote: 'delivery_note',
    taxInvoice: 'tax_invoice',
    notesDocument: 'notes'
};
const REQUIRED_DOCUMENTS = ['purchaseOrder', 'goodsReceipt', 'supplierInvoice', 'deliveryNote', 'taxInvoice'];

const parseSubmitUpload = pdfUpload(Object.keys(SUBMIT_DOCUMENTS));
const parsePaymentUpload = pdfUpload(['paymentProof']);

function idParam(value) {
    if (!/^\d+$/.test(value)) {
        throw new HttpError(400, 'error.invalidId');
    }
    return value;
}

function text(body, field, { required = true, max = 200 } = {}) {
    const value = String(body?.[field] ?? '').trim();
    if (required && !value) {
        throw new HttpError(400, 'validation.missingField', { field });
    }
    if (value.length > max) {
        throw new HttpError(400, 'validation.fieldTooLong', { field });
    }
    return value || null;
}

// Rupiah amount: "48500000", "48.500.000" or "48500000.50".
function amount(body) {
    let value = String(body?.amount ?? '').trim();
    if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
        value = value.replaceAll('.', ''); // Indonesian thousands separators: 48.500.000
    }
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
        throw new HttpError(400, 'validation.invalidAmount');
    }
    return value;
}

function formatRupiah(value) {
    return `Rp ${Number(value).toLocaleString('id-ID')}`;
}

// The SQL condition limiting which invoices the current user may see.
function visibilityFilter(user, params) {
    if (user.role === 'vendor') {
        params.push(user.company_id);
        return `i.company_id = $${params.length}`;
    }
    if (user.role === 'treasury') {
        return `i.status IN ('approved', 'paid')`;
    }
    return 'TRUE'; // verification, admin
}

async function loadVisibleInvoice(user, id) {
    const params = [idParam(id)];
    const filter = visibilityFilter(user, params);
    const { rows: [invoice] } = await query(
        `SELECT i.*, i.id::text AS id, c.vendor_code, c.vendor_name, c.company_email
           FROM invoices i JOIN companies c ON c.id = i.company_id
          WHERE i.id = $1 AND ${filter}`,
        params
    );
    if (!invoice) {
        throw new HttpError(404, 'invoices.notFound');
    }
    return invoice;
}

async function addEvent(client, invoiceId, actorId, action, note = null) {
    await client.query(
        'INSERT INTO invoice_events (invoice_id, actor_id, action, note) VALUES ($1, $2, $3, $4)',
        [invoiceId, actorId, action, note]
    );
}

async function notify(client, invoice, kind, subject, body) {
    await client.query(
        'INSERT INTO notifications (company_id, invoice_id, kind, subject, body) VALUES ($1, $2, $3, $4, $5)',
        [invoice.company_id, invoice.id, kind, subject, body]
    );
}

async function saveInvoiceDocument(client, invoiceId, documentType, file, storageKey) {
    await saveFile(storageKey, file.buffer);
    await client.query(
        `INSERT INTO invoice_documents (invoice_id, document_type, original_name, storage_key, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (invoice_id, document_type) DO UPDATE
            SET original_name = EXCLUDED.original_name, storage_key = EXCLUDED.storage_key,
                size_bytes = EXCLUDED.size_bytes, uploaded_at = now()`,
        [invoiceId, documentType, file.originalname.slice(0, 255), storageKey, file.size]
    );
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

// GET /api/invoices?status=submitted   (status optional; newest first)
invoicesRouter.get('/', async (req, res) => {
    const params = [];
    const conditions = [visibilityFilter(req.user, params)];

    if (req.query.status) {
        const status = String(req.query.status);
        if (!STATUSES.includes(status)) {
            throw new HttpError(400, 'error.invalidStatus', { options: STATUSES.join(', ') });
        }
        params.push(status);
        conditions.push(`i.status = $${params.length}`);
    }

    const { rows } = await query(
        `SELECT i.id::text, i.invoice_code, i.branch_name, i.po_number, i.invoice_number,
                i.amount::text, i.status, i.revision, i.submitted_at, i.ap_reviewed_at, i.ap_note,
                i.paid_at, c.vendor_code, c.vendor_name,
                (SELECT count(*)::int FROM invoice_documents d
                  WHERE d.invoice_id = i.id AND d.document_type IN
                        ('purchase_order','goods_receipt','supplier_invoice','delivery_note','tax_invoice')
                ) AS required_documents
           FROM invoices i JOIN companies c ON c.id = i.company_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY i.submitted_at DESC
          LIMIT 500`,
        params
    );
    res.json(rows);
});

// GET /api/invoices/stats  (admin): counts and totals per status
invoicesRouter.get('/stats', requireRole('admin'), async (_req, res) => {
    const { rows } = await query(
        `SELECT status, count(*)::int AS count, coalesce(sum(amount), 0)::text AS total
           FROM invoices GROUP BY status`
    );
    const stats = Object.fromEntries(STATUSES.map((status) => [status, { count: 0, total: '0' }]));
    for (const row of rows) {
        stats[row.status] = { count: row.count, total: row.total };
    }
    res.json(stats);
});

// GET /api/invoices/:id  full detail: documents, history, bank accounts (staff only)
invoicesRouter.get('/:id', async (req, res) => {
    const invoice = await loadVisibleInvoice(req.user, req.params.id);

    const [documents, events, banks] = await Promise.all([
        query(
            `SELECT document_type, original_name, size_bytes, uploaded_at
               FROM invoice_documents WHERE invoice_id = $1 ORDER BY id`,
            [invoice.id]
        ),
        query(
            `SELECT e.action, e.note, e.created_at, u.email AS actor_email, u.role AS actor_role
               FROM invoice_events e JOIN users u ON u.id = e.actor_id
              WHERE e.invoice_id = $1 ORDER BY e.created_at, e.id`,
            [invoice.id]
        ),
        req.user.role === 'vendor'
            ? { rows: [] }
            : query(
                `SELECT account_index, bank_name, account_number, account_holder
                   FROM bank_accounts WHERE company_id = $1 ORDER BY account_index`,
                [invoice.company_id]
            )
    ]);

    res.json({
        id: invoice.id,
        invoice_code: invoice.invoice_code,
        vendor_code: invoice.vendor_code,
        vendor_name: invoice.vendor_name,
        branch_name: invoice.branch_name,
        po_number: invoice.po_number,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        vendor_note: invoice.vendor_note,
        status: invoice.status,
        revision: invoice.revision,
        submitted_at: invoice.submitted_at,
        ap_reviewed_at: invoice.ap_reviewed_at,
        ap_note: invoice.ap_note,
        paid_at: invoice.paid_at,
        payment_method: invoice.payment_method,
        payment_reference: invoice.payment_reference,
        paid_to_account: invoice.paid_to_account,
        documents: documents.rows.map((doc) => ({
            ...doc,
            url: `/api/invoices/${invoice.id}/documents/${doc.document_type}`
        })),
        events: events.rows,
        bankAccounts: banks.rows
    });
});

// GET /api/invoices/:id/documents/:type  streams the PDF
invoicesRouter.get('/:id/documents/:type', async (req, res) => {
    const invoice = await loadVisibleInvoice(req.user, req.params.id);
    const { rows: [doc] } = await query(
        'SELECT storage_key, original_name FROM invoice_documents WHERE invoice_id = $1 AND document_type = $2',
        [invoice.id, req.params.type]
    );
    if (!doc) {
        throw new HttpError(404, 'documents.notFound');
    }
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${doc.original_name.replace(/[^\w.\- ]/g, '_')}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath(doc.storage_key));
});

// ---------------------------------------------------------------------------
// Vendor: submit and resubmit (multipart/form-data)
// ---------------------------------------------------------------------------

// POST /api/invoices  fields: branchName, poNumber, invoiceNumber, amount, vendorNote?
//                     files:  purchaseOrder, goodsReceipt, supplierInvoice, deliveryNote, taxInvoice, notesDocument?
invoicesRouter.post('/', requireRole('vendor'), async (req, res) => {
    await parseSubmitUpload(req, res);
    const body = req.body ?? {};
    const fields = {
        branchName: text(body, 'branchName'),
        poNumber: text(body, 'poNumber'),
        invoiceNumber: text(body, 'invoiceNumber'),
        amount: amount(body),
        vendorNote: text(body, 'vendorNote', { required: false, max: 1000 })
    };

    const documents = [];
    for (const [field, documentType] of Object.entries(SUBMIT_DOCUMENTS)) {
        const file = pdfFile(req.files, field);
        if (!file && REQUIRED_DOCUMENTS.includes(field)) {
            throw new HttpError(400, 'validation.missingDocument', { field });
        }
        if (file) {
            documents.push({ documentType, file });
        }
    }

    let folder = null;
    try {
        const invoice = await withTransaction(async (client) => {
            const { rows: [invoice] } = await client.query(
                `INSERT INTO invoices (company_id, submitted_by, branch_name, po_number, invoice_number, amount, vendor_note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id::text, invoice_code, status`,
                [req.user.company_id, req.user.id, fields.branchName, fields.poNumber,
                    fields.invoiceNumber, fields.amount, fields.vendorNote]
            );
            folder = `invoices/${invoice.id}`;
            for (const { documentType, file } of documents) {
                await saveInvoiceDocument(client, invoice.id, documentType, file, `${folder}/r1-${documentType}.pdf`);
            }
            await addEvent(client, invoice.id, req.user.id, 'submitted', fields.vendorNote);
            return invoice;
        });
        res.status(201).json({ success: true, invoice });
    } catch (error) {
        if (folder) {
            await removeFolder(folder).catch(() => {});
        }
        throw error;
    }
});

// POST /api/invoices/:id/resubmit  (only a rejected invoice of your own company)
// Any of the submit fields/files may be sent; only those are changed.
invoicesRouter.post('/:id/resubmit', requireRole('vendor'), async (req, res) => {
    await parseSubmitUpload(req, res);
    const body = req.body ?? {};
    const current = await loadVisibleInvoice(req.user, req.params.id);
    if (current.status !== 'rejected') {
        throw new HttpError(409, 'invoices.onlyRejectedResubmit');
    }

    const updates = {
        branch_name: body.branchName !== undefined ? text(body, 'branchName') : current.branch_name,
        po_number: body.poNumber !== undefined ? text(body, 'poNumber') : current.po_number,
        invoice_number: body.invoiceNumber !== undefined ? text(body, 'invoiceNumber') : current.invoice_number,
        amount: body.amount !== undefined ? amount(body) : current.amount,
        vendor_note: body.vendorNote !== undefined
            ? text(body, 'vendorNote', { required: false, max: 1000 })
            : current.vendor_note
    };
    const replacements = Object.entries(SUBMIT_DOCUMENTS)
        .map(([field, documentType]) => ({ documentType, file: pdfFile(req.files, field) }))
        .filter(({ file }) => file);

    const revision = current.revision + 1;
    const invoice = await withTransaction(async (client) => {
        const { rows: [invoice] } = await client.query(
            `UPDATE invoices
                SET branch_name = $2, po_number = $3, invoice_number = $4, amount = $5, vendor_note = $6,
                    status = 'submitted', revision = $7, submitted_at = now(),
                    ap_reviewed_by = NULL, ap_reviewed_at = NULL, ap_note = NULL
              WHERE id = $1 AND status = 'rejected'
          RETURNING id::text, invoice_code, status, revision`,
            [current.id, updates.branch_name, updates.po_number, updates.invoice_number,
                updates.amount, updates.vendor_note, revision]
        );
        if (!invoice) {
            throw new HttpError(409, 'invoices.changedConcurrently');
        }
        // New file names per revision, so earlier versions stay on disk for the record.
        for (const { documentType, file } of replacements) {
            await saveInvoiceDocument(client, current.id, documentType, file,
                `invoices/${current.id}/r${revision}-${documentType}.pdf`);
        }
        await addEvent(client, current.id, req.user.id, 'resubmitted', updates.vendor_note);
        return invoice;
    });

    res.json({ success: true, invoice, replacedDocuments: replacements.map((r) => r.documentType) });
});

// ---------------------------------------------------------------------------
// AP Verification: approve ("Sesuai") or reject ("Tidak Sesuai")
// ---------------------------------------------------------------------------

// POST /api/invoices/:id/verify  { decision: 'approve' | 'reject', note }
invoicesRouter.post('/:id/verify', requireRole('verification'), async (req, res) => {
    const decision = String(req.body?.decision ?? '');
    const note = String(req.body?.note ?? '').trim().slice(0, 1000) || null;

    if (!['approve', 'reject'].includes(decision)) {
        throw new HttpError(400, 'invoices.invalidDecision');
    }
    if (decision === 'reject' && !note) {
        throw new HttpError(400, 'invoices.rejectNoteRequired');
    }
    const status = decision === 'approve' ? 'approved' : 'rejected';

    const invoice = await withTransaction(async (client) => {
        // Only a submitted invoice can be decided, so two reviewers cannot overwrite each other.
        const { rows: [invoice] } = await client.query(
            `UPDATE invoices
                SET status = $2, ap_reviewed_by = $3, ap_reviewed_at = now(), ap_note = $4
              WHERE id = $1 AND status = 'submitted'
          RETURNING id, id::text AS id_text, invoice_code, company_id, po_number, amount, status, ap_note`,
            [idParam(req.params.id), status, req.user.id, note]
        );
        if (!invoice) {
            throw new HttpError(409, 'invoices.notAwaitingVerification');
        }

        await addEvent(client, invoice.id, req.user.id, status, note);
        if (status === 'approved') {
            await notify(client, invoice, 'invoice_approved',
                `[SESUAI] Tagihan ${invoice.invoice_code} / PO ${invoice.po_number} terverifikasi`,
                `Tagihan ${invoice.invoice_code} (PO ${invoice.po_number}) sebesar ${formatRupiah(invoice.amount)} `
                + 'telah dinyatakan SESUAI oleh tim Accounts Payable dan diteruskan ke Treasury untuk pembayaran.'
                + (note ? `\n\nCatatan AP: ${note}` : ''));
        } else {
            await notify(client, invoice, 'invoice_rejected',
                `[TIDAK SESUAI] Tagihan ${invoice.invoice_code} / PO ${invoice.po_number} perlu revisi`,
                `Tagihan ${invoice.invoice_code} (PO ${invoice.po_number}) dinyatakan TIDAK SESUAI.\n\n`
                + `Catatan revisi dari AP: ${note}\n\nSilakan perbaiki dokumen dan submit ulang melalui portal.`);
        }
        return invoice;
    });

    res.json({ success: true, invoice: { id: invoice.id_text, invoice_code: invoice.invoice_code, status: invoice.status } });
});

// ---------------------------------------------------------------------------
// Treasury: pay an approved invoice
// ---------------------------------------------------------------------------

// POST /api/invoices/:id/pay  (multipart) paymentMethod, paymentReference, paidToAccount (1|2), paymentProof? (PDF)
invoicesRouter.post('/:id/pay', requireRole('treasury'), async (req, res) => {
    await parsePaymentUpload(req, res);
    const body = req.body ?? {};
    const paymentMethod = String(body.paymentMethod ?? '');
    const paymentReference = text(body, 'paymentReference', { max: 100 });
    const paidToAccount = Number(body.paidToAccount);
    const proof = pdfFile(req.files, 'paymentProof');

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw new HttpError(400, 'invoices.invalidPaymentMethod', { options: PAYMENT_METHODS.join(', ') });
    }
    if (![1, 2].includes(paidToAccount)) {
        throw new HttpError(400, 'invoices.invalidAccount');
    }

    const invoice = await withTransaction(async (client) => {
        const { rows: [invoice] } = await client.query(
            `UPDATE invoices
                SET status = 'paid', paid_by = $2, paid_at = now(),
                    payment_method = $3, payment_reference = $4, paid_to_account = $5
              WHERE id = $1 AND status = 'approved'
          RETURNING id, id::text AS id_text, invoice_code, company_id, po_number, amount, status`,
            [idParam(req.params.id), req.user.id, paymentMethod, paymentReference, paidToAccount]
        );
        if (!invoice) {
            throw new HttpError(409, 'invoices.notReadyForPayment');
        }

        const { rows: [bank] } = await client.query(
            'SELECT bank_name, account_number, account_holder FROM bank_accounts WHERE company_id = $1 AND account_index = $2',
            [invoice.company_id, paidToAccount]
        );
        if (proof) {
            await saveInvoiceDocument(client, invoice.id, 'payment_proof', proof, `invoices/${invoice.id}/payment_proof.pdf`);
        }
        await addEvent(client, invoice.id, req.user.id, 'paid', `${paymentMethod} - ref ${paymentReference}`);
        await notify(client, invoice, 'invoice_paid',
            `[LUNAS] Pembayaran tagihan ${invoice.invoice_code} / PO ${invoice.po_number}`,
            `Pembayaran tagihan ${invoice.invoice_code} (PO ${invoice.po_number}) sebesar ${formatRupiah(invoice.amount)} `
            + `telah BERHASIL DITRANSFER.\n\nMetode: ${paymentMethod}\nNo. Referensi Bank: ${paymentReference}\n`
            + (bank ? `Rekening tujuan: ${bank.bank_name} ${bank.account_number} a.n. ${bank.account_holder}\n` : '')
            + (proof ? '\nBukti transfer terlampir di detail tagihan.' : ''));
        return invoice;
    });

    res.json({ success: true, invoice: { id: invoice.id_text, invoice_code: invoice.invoice_code, status: invoice.status } });
});

