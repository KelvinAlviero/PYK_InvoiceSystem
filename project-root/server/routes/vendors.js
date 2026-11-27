import express from 'express';
import { query } from '../db.js';
import { HttpError, requireRole } from '../lib/auth.js';
import { filePath } from '../lib/storage.js';

// Vendor applications, for the AP Verification team (and admins).
// The AP Verification page can call these; this file does not touch that page.
export const vendorsRouter = express.Router();

vendorsRouter.use(requireRole('verification', 'admin'));

const STATUSES = ['pending', 'approved', 'rejected'];

function idParam(value) {
    if (!/^\d+$/.test(value)) {
        throw new HttpError(400, 'error.invalidId');
    }
    return value;
}

// GET /api/vendors?status=pending  (default: pending, oldest first)
vendorsRouter.get('/', async (req, res) => {
    const status = String(req.query.status ?? 'pending');
    if (!STATUSES.includes(status)) {
        throw new HttpError(400, 'error.invalidStatus', { options: STATUSES.join(', ') });
    }

    const { rows } = await query(
        `SELECT c.id::text, c.vendor_code, c.short_code, c.vendor_name, c.entity, c.business_type,
                c.status, c.submitted_at, c.reviewed_at, c.review_note,
                (SELECT email FROM users WHERE company_id = c.id ORDER BY id LIMIT 1) AS login_email
           FROM companies c
          WHERE c.status = $1
          ORDER BY c.submitted_at
          LIMIT 500`,
        [status]
    );
    res.json(rows);
});

// GET /api/vendors/:id  full application: company, bank accounts, document list
vendorsRouter.get('/:id', async (req, res) => {
    const id = idParam(req.params.id);
    const { rows: [company] } = await query(
        `SELECT c.*, c.id::text AS id, p.name AS province, ci.name AS city, v.name AS village,
                r.email AS reviewed_by_email,
                CASE WHEN c.status = 'pending' THEN suggest_vendor_code(c.vendor_name) END AS suggested_code
           FROM companies c
           JOIN provinces p ON p.id = c.province_id
           JOIN cities ci ON ci.id = c.city_id
           JOIN villages v ON v.id = c.village_id
           LEFT JOIN users r ON r.id = c.reviewed_by
          WHERE c.id = $1`,
        [id]
    );
    if (!company) {
        throw new HttpError(404, 'vendors.notFound');
    }

    const [banks, documents, users] = await Promise.all([
        query(
            `SELECT account_index, bank_name, account_number, account_holder
               FROM bank_accounts WHERE company_id = $1 ORDER BY account_index`,
            [id]
        ),
        query(
            `SELECT document_type, original_name, size_bytes, uploaded_at
               FROM documents WHERE company_id = $1 ORDER BY id`,
            [id]
        ),
        query('SELECT id::text, email, is_active FROM users WHERE company_id = $1 ORDER BY id', [id])
    ]);

    res.json({
        ...company,
        bankAccounts: banks.rows,
        documents: documents.rows.map((doc) => ({
            ...doc,
            url: `/api/vendors/${id}/documents/${doc.document_type}`
        })),
        users: users.rows
    });
});

// GET /api/vendors/:id/documents/:type  streams the PDF (opens in the browser)
vendorsRouter.get('/:id/documents/:type', async (req, res) => {
    const { rows: [doc] } = await query(
        'SELECT storage_key, original_name FROM documents WHERE company_id = $1 AND document_type = $2',
        [idParam(req.params.id), req.params.type]
    );
    if (!doc) {
        throw new HttpError(404, 'documents.notFound');
    }

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${doc.original_name.replace(/[^\w.\- ]/g, '_')}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath(doc.storage_key));
});

const VENDOR_CODE = /^[A-Z]{3}$/;

async function decide(req, res, status) {
    const id = idParam(req.params.id);
    const note = String(req.body?.note ?? '').trim() || null;
    if (status === 'rejected' && !note) {
        throw new HttpError(400, 'vendors.rejectNoteRequired');
    }

    // Approving gives the vendor its permanent 3-letter code: the one the admin typed,
    // or (left empty) one suggested from the vendor name.
    const typedCode = String(req.body?.shortCode ?? '').trim().toUpperCase();
    if (status === 'approved' && typedCode && !VENDOR_CODE.test(typedCode)) {
        throw new HttpError(400, 'vendors.codeInvalid');
    }

    // An automatic code can lose a race with another approval; try a fresh one then.
    for (let attempt = 1; ; attempt += 1) {
        try {
            // Only pending applications can be decided, so two reviewers clicking at
            // the same time cannot overwrite each other.
            const { rows: [company] } = await query(
                `UPDATE companies
                    SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4,
                        short_code = CASE WHEN $2 = 'approved'
                                          THEN coalesce($5, suggest_vendor_code(vendor_name))
                                          ELSE short_code END
                  WHERE id = $1 AND status = 'pending'
              RETURNING id::text, vendor_code, short_code, status, reviewed_at, review_note`,
                [id, status, req.user.id, note, typedCode || null]
            );
            if (!company) {
                throw new HttpError(409, 'vendors.notPending');
            }
            return res.json({ success: true, company });
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'companies_short_code_key') {
                if (typedCode) {
                    throw new HttpError(409, 'vendors.codeTaken', { code: typedCode });
                }
                if (attempt < 3) {
                    continue;
                }
            }
            throw error;
        }
    }
}

vendorsRouter.post('/:id/approve', (req, res) => decide(req, res, 'approved'));
vendorsRouter.post('/:id/reject', (req, res) => decide(req, res, 'rejected'));
