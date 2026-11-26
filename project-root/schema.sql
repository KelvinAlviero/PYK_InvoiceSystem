-- PYK Invoice System - PostgreSQL schema (version 1: users, vendors, approval, sessions)
-- Replaces the Google Sheets tabs: users, companies, bank_accounts, documents.
-- Run once on an empty database. Every statement here is safe to read top to bottom.

-- ---------------------------------------------------------------------------
-- COMPANIES (the vendors). One row per vendor application.
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Human-friendly code like VEN-000042, built from the id. No random numbers,
  -- so it can never collide (the old sheet used random 3-digit IDs).
  vendor_code     TEXT GENERATED ALWAYS AS ('VEN-' || lpad(id::text, 6, '0')) STORED UNIQUE,

  entity          TEXT NOT NULL,                -- Entitas
  vendor_name     TEXT NOT NULL,                -- Nama Vendor
  street          TEXT NOT NULL,                -- Jalan
  block           TEXT NOT NULL,                -- Blok
  province_id     INTEGER NOT NULL,             -- filled in below, see regions
  city_id         INTEGER NOT NULL,
  village_id      BIGINT NOT NULL,              -- official village codes are 10 digits
  phone           TEXT NOT NULL,
  company_npwp    TEXT NOT NULL,
  company_email   TEXT NOT NULL,
  owner_name      TEXT NOT NULL,                -- Pemilik
  owner_contact   TEXT NOT NULL,
  sales_person    TEXT NOT NULL,                -- Penanggung Jawab Sales
  sales_contact   TEXT NOT NULL,
  business_type   TEXT NOT NULL
                  CHECK (business_type IN ('Usaha Berbadan Hukum', 'Usaha Perseorangan')),

  -- Approval workflow: staff review each application before the vendor can invoice.
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),   -- Tanggal Pengajuan, set by the SERVER
  reviewed_by     BIGINT,                               -- staff user who decided (FK added below)
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,

  -- A decision must record who made it and when.
  CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- USERS (logins). A company can have several users; staff have no company.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,                 -- a bcrypt/argon2 hash, NEVER the password
  role           TEXT NOT NULL
                 CHECK (role IN ('vendor', 'verification', 'treasury', 'admin')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  company_id     BIGINT REFERENCES companies(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vendors belong to a company; staff do not. The database enforces this, so a
  -- bug in the app cannot create a vendor with no company or an admin with one.
  CHECK ((role = 'vendor') = (company_id IS NOT NULL))
);

-- Emails are unique regardless of upper/lower case (Kelvin@x.com = kelvin@x.com).
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_company_idx ON users (company_id);

ALTER TABLE companies
  ADD CONSTRAINT companies_reviewed_by_fk FOREIGN KEY (reviewed_by) REFERENCES users(id);

-- Pending-approvals screen: "show me pending vendors, oldest first" stays fast at 100k rows.
CREATE INDEX companies_status_idx ON companies (status, submitted_at);

-- ---------------------------------------------------------------------------
-- BANK ACCOUNTS (each vendor gives two)
-- ---------------------------------------------------------------------------
CREATE TABLE bank_accounts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_index   SMALLINT NOT NULL CHECK (account_index IN (1, 2)),
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,                -- text, not a number: keeps leading zeros
  account_holder  TEXT NOT NULL,
  UNIQUE (company_id, account_index)
);

-- ---------------------------------------------------------------------------
-- DOCUMENTS (uploaded PDFs). The file itself lives in file storage; this table
-- only remembers where (storage_key), so the database stays small and fast.
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id     BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL CHECK (document_type IN (
                   'terms_of_payment', 'company_information', 'bank_information', 'extras',
                   'business_license', 'tax_document', 'identity_document',
                   'establishment_deed', 'ministry_approval')),
  original_name  TEXT NOT NULL,
  storage_key    TEXT NOT NULL,                 -- e.g. companies/42/tax_document.pdf
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, document_type)            -- one file per document type
);

-- ---------------------------------------------------------------------------
-- REGIONS (the cascading Provinsi -> Kota/Kabupaten -> Kelurahan/Desa dropdowns).
-- Loaded once from an official dataset, then served to the form by the API.
-- ---------------------------------------------------------------------------
CREATE TABLE provinces (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE cities (
  id           INTEGER PRIMARY KEY,
  province_id  INTEGER NOT NULL REFERENCES provinces(id),
  name         TEXT NOT NULL
);
CREATE INDEX cities_province_idx ON cities (province_id);

CREATE TABLE villages (
  id        BIGINT PRIMARY KEY,                -- 10-digit Kemendagri codes overflow INTEGER
  city_id   INTEGER NOT NULL REFERENCES cities(id),
  name      TEXT NOT NULL
);
CREATE INDEX villages_city_idx ON villages (city_id);

ALTER TABLE companies
  ADD CONSTRAINT companies_province_fk FOREIGN KEY (province_id) REFERENCES provinces(id),
  ADD CONSTRAINT companies_city_fk     FOREIGN KEY (city_id)     REFERENCES cities(id),
  ADD CONSTRAINT companies_village_fk  FOREIGN KEY (village_id)  REFERENCES villages(id);

-- ---------------------------------------------------------------------------
-- SESSIONS (who is logged in). The browser holds a random token in an
-- httpOnly cookie; we store only its SHA-256 hash, so a leaked database
-- cannot be used to log in. Deleting a row logs that browser out.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
