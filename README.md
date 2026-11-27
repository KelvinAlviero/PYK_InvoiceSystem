# PYK_InvoiceSystem

Invoice system for PYK. The front end is plain HTML/JS modules. The backend is a Node/Express API on PostgreSQL, and it serves the front end too. Everything lives in `project-root/`.

## Roles

| Role (in the DB) | Who | How the account is created | Lands on |
|---|---|---|---|
| `vendor` | Suppliers ("user" in the UI) | Self-registration (5-step form). **Can only log in after Verification approves the company.** | User dashboard |
| `verification` | AP Verification staff | By an admin | AP Verification |
| `treasury` | Treasury staff | By an admin | Treasury |
| `admin` | Admins | `npm run create-staff` (first one), then from the Admin dashboard | Admin dashboard (can open every page) |

## Run it locally

You need Node 20+ and a Postgres database. The easiest way to get Postgres is Docker:

```bash
docker run -d --name pyk-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pyk -p 5432:5432 postgres:16
```

Then, inside `project-root/`:

```bash
cp .env.example .env        # defaults match the docker command above
npm install
npm run db:init             # applies any new migrations in server/migrations (safe to re-run)
npm run db:seed-regions     # sample provinces/cities/villages for the registration form
npm run create-staff -- admin@pyk.test admin   # asks for a password
npm run dev                 # http://localhost:3000 (restarts when files change)
```

Open http://localhost:3000. Don't open `index.html` as a file, because the page needs the API.

## Deploy on Railway

1. **New Project → Deploy from GitHub repo**, and pick this repo.
2. On the **app service**, under **Settings**, set **Root Directory** to `project-root`. Railway detects Node and runs `npm start`.
3. **+ New → Database → PostgreSQL** in the same project.
4. Under the **app service's** Variables (not the Postgres service's):
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference variable, uses Railway's private network)
   - `NODE_ENV` = `production` (makes the login cookie `Secure`)
   - `UPLOAD_DIR` = `/data/uploads`
5. **Add a Volume to the app service** mounted at `/data`. Without it, uploaded PDFs are wiped on every redeploy.
6. **Settings → Networking → Generate Domain** on the app service to get a public URL.
7. Deploy. Before the server starts, `npm start` runs `prestart`, which applies any new database migrations and loads the sample regions. There's nothing to run by hand, and the database never needs a public URL.
8. Create the first admin from inside the running app, from your laptop in `project-root/`:
   ```bash
   railway link              # once per folder
   railway ssh --service PYK_InvoiceSystem
   export PATH=/mise/shims:$PATH                   # inside the ssh session: Node lives here on Railway
   npm run create-staff -- you@example.com admin   # asks for a password
   ```

## Changing the database

Database changes are numbered SQL files in `project-root/server/migrations/` (`001_initial.sql`, `002_invoices.sql`, ...). Each file runs exactly once, in order, and the database records which ones have run in `schema_migrations`. To change the database, **add a new file** (e.g. `003_something.sql`). Never edit a file that has already run on Railway. The next deploy applies the new file automatically.

## Invoice flow

```
Vendor submits invoice + 5 PDFs  ->  AP Verification: Sesuai / Tidak Sesuai (note required)
       ^                                   |                      |
       +---- vendor fixes & resubmits <----+ (rejected)           v (approved)
                                                     Treasury pays (method, bank ref, proof PDF)  ->  Lunas
```

Required PDFs: Purchase Order, Goods Receipt, Invoice Supplier, Surat Jalan, Faktur Pajak. A Notes PDF is optional. Every step is recorded in `invoice_events`. Vendors get an in-app notification (`notifications` table) when AP decides and when Treasury pays. The Admin dashboard shows the whole pipeline but leaves the decisions to AP and Treasury.

## API overview

All endpoints are under `/api`. Login uses an httpOnly session cookie, so the browser sends it automatically.

| Method & path | Who | What |
|---|---|---|
| `POST /auth/login` `{email, password}` | anyone | Logs in. 403 with a reason if pending/rejected/deactivated. |
| `POST /auth/logout` | anyone | Ends the session. |
| `GET /auth/me` | logged in | The current user `{id, email, role, company}`. |
| `POST /auth/register` (multipart) | anyone | Vendor registration with PDFs. Creates a **pending** company. |
| `GET /regions/provinces`, `/regions/provinces/:id/cities`, `/regions/cities/:id/villages` | anyone | Dropdown data. |
| `GET /vendors?status=pending\|approved\|rejected` | verification, admin | Vendor applications, oldest first. |
| `GET /vendors/:id` | verification, admin | Full application: company, banks, documents. |
| `GET /vendors/:id/documents/:type` | verification, admin | Opens the PDF. |
| `POST /vendors/:id/approve` / `reject` `{note}` | verification, admin | Decide a pending application (reject needs a note). |
| `POST /users/me/password` `{currentPassword, newPassword}` | logged in | Change own password. |
| `GET /users`, `POST /users` `{email, password, role}`, `PATCH /users/:id` `{isActive}` | admin | Manage logins and create staff accounts. |
| `GET /invoices?status=submitted\|rejected\|approved\|paid` | all roles | Vendor: their own. Verification/admin: all. Treasury: approved + paid. |
| `GET /invoices/:id` | same as above | Detail with documents, history and (staff only) the vendor's bank accounts. |
| `GET /invoices/:id/documents/:type` | same as above | Opens the PDF. |
| `GET /invoices/stats` | admin | Count and total amount per status. |
| `POST /invoices` (multipart) | vendor | Fields: `branchName, poNumber, invoiceNumber, amount, vendorNote?`. Files: `purchaseOrder, goodsReceipt, supplierInvoice, deliveryNote, taxInvoice, notesDocument?`. |
| `POST /invoices/:id/resubmit` (multipart) | vendor | Rejected invoices only. Send just the fields/files that changed. |
| `POST /invoices/:id/verify` `{decision: 'approve'\|'reject', note}` | verification | Submitted invoices only. A note is required to reject. |
| `POST /invoices/:id/pay` (multipart) | treasury | `paymentMethod` (`RTGS/SKN`, `BI-FAST`, `Giro/Cek`), `paymentReference`, `paidToAccount` (1 or 2), `paymentProof?` PDF. |
| `GET /notifications` | vendor, admin | Vendor: own messages + unread count. Admin: full log. |
| `POST /notifications/:id/read` | vendor | Mark one as read. |

From front-end code, use `apiRequest` from `js/authService.js`:

```js
import { apiRequest } from '../../authService.js';
const pending = await apiRequest('/vendors?status=pending');
await apiRequest(`/vendors/${id}/approve`, { method: 'POST' });
```

## Security notes

- Passwords are stored as scrypt hashes, never as plain text.
- Sessions are random tokens in an httpOnly cookie. Only a SHA-256 of each token is stored. Deactivating a user logs them out immediately.
- Roles are checked on the server for every request. The front-end role checks only decide which screen is shown.
- Login is rate-limited (10 failed tries per 15 min per IP) and registration too (10 per hour per IP).
- Only `index.html`, `css/`, `js/` and `assets/` are served publicly.
