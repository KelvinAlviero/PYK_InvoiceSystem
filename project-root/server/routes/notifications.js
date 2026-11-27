import express from 'express';
import { query } from '../db.js';
import { HttpError, requireRole } from '../lib/auth.js';

// In-app notifications to vendors (stand-in for email). Vendors see their own
// company's; admins see the full log of everything that was "sent".
export const notificationsRouter = express.Router();

// GET /api/notifications  vendor: own messages + unread count; admin: full log
notificationsRouter.get('/', requireRole('vendor', 'admin'), async (req, res) => {
    const isVendor = req.user.role === 'vendor';
    const { rows } = await query(
        `SELECT n.id::text, n.kind, n.subject, n.body, n.created_at, n.read_at,
                n.invoice_id::text, i.invoice_code, c.vendor_code, c.vendor_name, c.company_email
           FROM notifications n
           JOIN companies c ON c.id = n.company_id
           LEFT JOIN invoices i ON i.id = n.invoice_id
          WHERE ${isVendor ? 'n.company_id = $1' : 'TRUE'}
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT 300`,
        isVendor ? [req.user.company_id] : []
    );
    res.json({
        unread: rows.filter((row) => !row.read_at).length,
        notifications: rows
    });
});

// POST /api/notifications/:id/read  (vendor, own company)
notificationsRouter.post('/:id/read', requireRole('vendor'), async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) {
        throw new HttpError(400, 'Invalid id.');
    }
    const { rowCount } = await query(
        'UPDATE notifications SET read_at = coalesce(read_at, now()) WHERE id = $1 AND company_id = $2',
        [req.params.id, req.user.company_id]
    );
    if (!rowCount) {
        throw new HttpError(404, 'Notification not found.');
    }
    res.json({ success: true });
});
