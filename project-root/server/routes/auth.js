import express from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { HttpError, loginBlockReason, publicUser, requireLogin } from '../lib/auth.js';
import { burnPasswordCheck, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from '../lib/passwords.js';
import { createSession, destroySession } from '../lib/sessions.js';
import { removeFolder, saveFile } from '../lib/storage.js';

export const authRouter = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many registrations from this network. Try again later.' }
});

// ---------------------------------------------------------------------------
// Login / logout / who am I
// ---------------------------------------------------------------------------

authRouter.post('/login', loginLimiter, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
        throw new HttpError(400, 'Email and password are required.');
    }

    const { rows } = await query(
        `SELECT u.id, u.email, u.role, u.company_id, u.is_active, u.password_hash,
                c.vendor_code, c.vendor_name, c.status AS company_status
           FROM users u
           LEFT JOIN companies c ON c.id = u.company_id
          WHERE lower(u.email) = lower($1)`,
        [email]
    );
    const user = rows[0];

    if (!user) {
        await burnPasswordCheck(password);
        throw new HttpError(401, 'Invalid email or password.');
    }
    if (!(await verifyPassword(password, user.password_hash))) {
        throw new HttpError(401, 'Invalid email or password.');
    }

    // Only tell someone their account is pending/rejected/disabled once they have
    // proven they own it with the right password.
    const blockReason = loginBlockReason(user);
    if (blockReason) {
        throw new HttpError(403, blockReason);
    }

    await createSession(res, user.id);
    res.json({ success: true, user: publicUser(user) });
});

authRouter.post('/logout', async (req, res) => {
    await destroySession(req, res);
    res.json({ success: true });
});

authRouter.get('/me', requireLogin, (req, res) => {
    res.json({ success: true, user: publicUser(req.user) });
});

// ---------------------------------------------------------------------------
// Vendor registration (multipart/form-data: text fields + PDF files)
// Creates a company in 'pending' status; the vendor cannot log in until
// Verification approves it.
// ---------------------------------------------------------------------------

// form field name -> documents.document_type
const DOCUMENT_FIELDS = {
    termsDocument: 'terms_of_payment',
    companyDocument: 'company_information',
    bankDocument: 'bank_information',
    extrasDocument: 'extras',
    businessLicenseDocument: 'business_license',
    taxDocument: 'tax_document',
    identityDocument: 'identity_document',
    establishmentDeedDocument: 'establishment_deed',
    ministryApprovalDocument: 'ministry_approval'
};

const ALWAYS_REQUIRED_DOCUMENTS = [
    'termsDocument', 'companyDocument', 'bankDocument', 'extrasDocument',
    'businessLicenseDocument', 'taxDocument', 'identityDocument'
];
const LEGAL_ENTITY_DOCUMENTS = ['establishmentDeedDocument', 'ministryApprovalDocument'];

const BUSINESS_TYPES = ['Usaha Berbadan Hukum', 'Usaha Perseorangan'];
const BANKS = ['BCA', 'BRI', 'BNI', 'Mandiri'];

const TEXT_FIELDS = [
    'email', 'password', 'entity', 'vendorName', 'street', 'block',
    'province', 'cityRegency', 'village', 'phone', 'companyNpwp', 'companyEmail',
    'ownerName', 'ownerContact', 'salesPerson', 'salesContact', 'businessType',
    'bankOneName', 'bankOneNumber', 'bankOneOwner',
    'bankTwoName', 'bankTwoNumber', 'bankTwoOwner'
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.maxFileBytes,
        files: Object.keys(DOCUMENT_FIELDS).length,
        fields: 60,
        fieldSize: 10 * 1024
    }
}).fields(Object.keys(DOCUMENT_FIELDS).map((name) => ({ name, maxCount: 1 })));

function parseUpload(req, res) {
    return new Promise((resolve, reject) => {
        upload(req, res, (error) => {
            if (!error) {
                return resolve();
            }
            if (error instanceof multer.MulterError) {
                const message = error.code === 'LIMIT_FILE_SIZE'
                    ? 'Each PDF must be 5 MB or smaller.'
                    : `Upload rejected: ${error.message}`;
                return reject(new HttpError(400, message));
            }
            reject(error);
        });
    });
}

function validateRegistration(body, files) {
    const data = {};
    for (const field of TEXT_FIELDS) {
        const value = String(body[field] ?? '').trim();
        if (!value) {
            throw new HttpError(400, `Missing required field: ${field}.`);
        }
        if (value.length > 300) {
            throw new HttpError(400, `Field is too long: ${field}.`);
        }
        data[field] = value;
    }
    data.password = String(body.password); // do not trim passwords

    if (body.termsAccepted !== 'on' && body.termsAccepted !== 'true') {
        throw new HttpError(400, 'You must accept the Terms of Payment.');
    }
    if (!EMAIL_PATTERN.test(data.email) || !EMAIL_PATTERN.test(data.companyEmail)) {
        throw new HttpError(400, 'Please enter valid email addresses.');
    }
    if (data.password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (!BUSINESS_TYPES.includes(data.businessType)) {
        throw new HttpError(400, 'Invalid business type.');
    }
    if (!BANKS.includes(data.bankOneName) || !BANKS.includes(data.bankTwoName)) {
        throw new HttpError(400, 'Invalid bank name.');
    }
    for (const field of ['province', 'cityRegency', 'village']) {
        if (!/^\d+$/.test(data[field])) {
            throw new HttpError(400, 'Please choose a province, city and village from the lists.');
        }
    }

    const requiredDocuments = data.businessType === 'Usaha Berbadan Hukum'
        ? [...ALWAYS_REQUIRED_DOCUMENTS, ...LEGAL_ENTITY_DOCUMENTS]
        : ALWAYS_REQUIRED_DOCUMENTS;

    const documents = requiredDocuments.map((field) => {
        const file = files?.[field]?.[0];
        if (!file) {
            throw new HttpError(400, `Missing required document: ${field}.`);
        }
        // Check the bytes, not just the name/type the browser claims.
        if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
            throw new HttpError(400, `${file.originalname} is not a PDF file.`);
        }
        return { documentType: DOCUMENT_FIELDS[field], file };
    });

    return { data, documents };
}

authRouter.post('/register', registerLimiter, async (req, res) => {
    await parseUpload(req, res);
    const { data, documents } = validateRegistration(req.body ?? {}, req.files);

    const regionCheck = await query(
        `SELECT 1 FROM villages v JOIN cities c ON c.id = v.city_id
          WHERE v.id = $1 AND c.id = $2 AND c.province_id = $3`,
        [data.village, data.cityRegency, data.province]
    );
    if (regionCheck.rowCount === 0) {
        throw new HttpError(400, 'The chosen province, city and village do not match.');
    }

    const passwordHash = await hashPassword(data.password);
    let companyFolder = null;

    try {
        const company = await withTransaction(async (client) => {
            const { rows: [company] } = await client.query(
                `INSERT INTO companies (
                    entity, vendor_name, street, block, province_id, city_id, village_id,
                    phone, company_npwp, company_email, owner_name, owner_contact,
                    sales_person, sales_contact, business_type
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                 RETURNING id, vendor_code`,
                [
                    data.entity, data.vendorName, data.street, data.block,
                    data.province, data.cityRegency, data.village,
                    data.phone, data.companyNpwp, data.companyEmail,
                    data.ownerName, data.ownerContact, data.salesPerson, data.salesContact,
                    data.businessType
                ]
            );

            await client.query(
                `INSERT INTO users (email, password_hash, role, company_id)
                 VALUES ($1, $2, 'vendor', $3)`,
                [data.email, passwordHash, company.id]
            );

            await client.query(
                `INSERT INTO bank_accounts (company_id, account_index, bank_name, account_number, account_holder)
                 VALUES ($1, 1, $2, $3, $4), ($1, 2, $5, $6, $7)`,
                [
                    company.id,
                    data.bankOneName, data.bankOneNumber, data.bankOneOwner,
                    data.bankTwoName, data.bankTwoNumber, data.bankTwoOwner
                ]
            );

            companyFolder = `companies/${company.id}`;
            for (const { documentType, file } of documents) {
                const storageKey = `${companyFolder}/${documentType}.pdf`;
                await saveFile(storageKey, file.buffer);
                await client.query(
                    `INSERT INTO documents (company_id, document_type, original_name, storage_key, mime_type, size_bytes)
                     VALUES ($1, $2, $3, $4, 'application/pdf', $5)`,
                    [company.id, documentType, file.originalname.slice(0, 255), storageKey, file.size]
                );
            }

            return company;
        });

        res.status(201).json({
            success: true,
            vendorCode: company.vendor_code,
            message: 'Registration submitted. You can log in once PYK has approved your company.'
        });
    } catch (error) {
        if (companyFolder) {
            await removeFolder(companyFolder).catch(() => {});
        }
        if (error.code === '23505' && error.constraint === 'users_email_unique') {
            throw new HttpError(409, 'An account with this email already exists.');
        }
        throw error;
    }
});
