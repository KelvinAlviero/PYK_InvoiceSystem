-- PYK Invoice System - migration 002: invoices, their documents, history, notifications.
-- Flow: vendor submits -> AP Verification approves ("Sesuai") or rejects ("Tidak Sesuai")
--       -> rejected invoices can be fixed and resubmitted -> Treasury pays approved ones.

-- ---------------------------------------------------------------------------
-- INVOICES (tagihan). One row per invoice a vendor submits.
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_code       TEXT GENERATED ALWAYS AS ('DOC-' || lpad(id::text, 6, '0')) STORED UNIQUE,

  company_id         BIGINT NOT NULL REFERENCES companies(id),
  submitted_by       BIGINT NOT NULL REFERENCES users(id),

  branch_name        TEXT NOT NULL,              -- Nama Cabang (the PYK branch being billed)
  po_number          TEXT NOT NULL,              -- No. PO
  invoice_number     TEXT NOT NULL,              -- the vendor's own invoice number
  amount             NUMERIC(15, 2) NOT NULL CHECK (amount > 0),   -- Rupiah; NUMERIC, never float, for money
  vendor_note        TEXT,                       -- optional text note from the vendor

  status             TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'rejected', 'approved', 'paid')),
  revision           INTEGER NOT NULL DEFAULT 1, -- goes up each time a rejected invoice is resubmitted
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),   -- latest (re)submission

  -- AP Verification decision (latest one)
  ap_reviewed_by     BIGINT REFERENCES users(id),
  ap_reviewed_at     TIMESTAMPTZ,
  ap_note            TEXT,

  -- Treasury payment
  paid_by            BIGINT REFERENCES users(id),
  paid_at            TIMESTAMPTZ,
  payment_method     TEXT CHECK (payment_method IN ('RTGS/SKN', 'BI-FAST', 'Giro/Cek')),
  payment_reference  TEXT,                       -- bank reference / receipt number
  paid_to_account    SMALLINT CHECK (paid_to_account IN (1, 2)),   -- which of the vendor's 2 bank accounts

  -- The database refuses impossible states, whatever the app does.
  CHECK (status NOT IN ('approved', 'rejected', 'paid') OR (ap_reviewed_by IS NOT NULL AND ap_reviewed_at IS NOT NULL)),
  CHECK (status <> 'rejected' OR ap_note IS NOT NULL),
  CHECK (status <> 'paid' OR (paid_by IS NOT NULL AND paid_at IS NOT NULL
                              AND payment_method IS NOT NULL AND payment_reference IS NOT NULL
                              AND paid_to_account IS NOT NULL))
);

CREATE INDEX invoices_company_idx ON invoices (company_id, submitted_at DESC);
CREATE INDEX invoices_status_idx ON invoices (status, submitted_at);

-- ---------------------------------------------------------------------------
-- INVOICE DOCUMENTS. Five required PDFs, an optional notes PDF, and the
-- payment proof Treasury may attach. Files live in storage like vendor documents.
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_documents (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id     BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL CHECK (document_type IN (
                   'purchase_order',    -- PO
                   'goods_receipt',     -- GR
                   'supplier_invoice',  -- Invoice Supplier
                   'delivery_note',     -- Surat Jalan
                   'tax_invoice',       -- Faktur Pajak
                   'notes',             -- optional notes file
                   'payment_proof')),   -- Bukti Transfer, added by Treasury
  original_name  TEXT NOT NULL,
  storage_key    TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, document_type)
);

-- ---------------------------------------------------------------------------
-- INVOICE EVENTS. Append-only history: who did what, when. Powers the timeline.
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  actor_id    BIGINT NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL CHECK (action IN ('submitted', 'resubmitted', 'approved', 'rejected', 'paid')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoice_events_invoice_idx ON invoice_events (invoice_id, created_at);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS. In-app messages to a vendor company (stand-in for email).
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id  BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('invoice_approved', 'invoice_rejected', 'invoice_paid')),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);
CREATE INDEX notifications_company_idx ON notifications (company_id, created_at DESC);
