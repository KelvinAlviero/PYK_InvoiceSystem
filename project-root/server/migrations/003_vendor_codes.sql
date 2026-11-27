-- PYK Invoice System - migration 003: 3-letter vendor codes and date-based invoice IDs.
--
-- Every approved vendor gets a unique 3-letter code (e.g. BCA), chosen by the admin on
-- approval or generated from the vendor name. It can never change once set.
-- Invoice IDs become  <first submission date, Jakarta time>-<vendor code><number>,
-- e.g. 2026-09-12-BCA001, numbered per vendor and never reset (BCA001, BCA002, ...).

-- ---------------------------------------------------------------------------
-- Vendor codes
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN short_code   TEXT UNIQUE CHECK (short_code ~ '^[A-Z]{3}$'),
  ADD COLUMN invoice_seq  INTEGER NOT NULL DEFAULT 0;   -- last invoice number used by this vendor

-- Suggests a free 3-letter code for a vendor name. Used by the API (automatic codes and
-- the admin's suggestion) and by the backfill below, so there is one implementation.
--   "PT Bumi Cahaya Abadi" -> BCA   (legal prefixes like PT/CV are skipped)
--   "UI Vendor"            -> UVE   (too few initials: filled from the last word)
--   "Sentosa"              -> SEN   (one word: its first letters)
-- If taken, tries the same first two letters with another third letter, then any code.
CREATE FUNCTION suggest_vendor_code(vendor_name TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
DECLARE
  words     TEXT[];
  word      TEXT;
  initials  TEXT := '';
  last_word TEXT := '';
  base      TEXT;
  candidate TEXT;
  alphabet  CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  i INTEGER;
  j INTEGER;
BEGIN
  words := regexp_split_to_array(
    trim(regexp_replace(upper(coalesce(vendor_name, '')), '[^A-Z ]', ' ', 'g')), '\s+');

  FOREACH word IN ARRAY words LOOP
    CONTINUE WHEN word = '' OR word IN ('PT', 'CV', 'UD', 'PD', 'TBK', 'FIRMA', 'KOPERASI');
    initials := initials || left(word, 1);
    last_word := word;
  END LOOP;

  -- Initials first; if there are fewer than 3, fill up with the rest of the last word.
  base := left(initials || substr(last_word, 2), 3);
  IF length(base) < 3 THEN
    base := rpad(base, 3, 'X');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM companies WHERE short_code = base) THEN
    RETURN base;
  END IF;

  FOR i IN 1..26 LOOP
    candidate := left(base, 2) || substr(alphabet, i, 1);
    IF NOT EXISTS (SELECT 1 FROM companies WHERE short_code = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;

  FOR i IN 1..26 LOOP
    FOR j IN 1..26 LOOP
      candidate := left(base, 1) || substr(alphabet, i, 1) || substr(alphabet, j, 1);
      IF NOT EXISTS (SELECT 1 FROM companies WHERE short_code = candidate) THEN
        RETURN candidate;
      END IF;
    END LOOP;
  END LOOP;

  RAISE EXCEPTION 'No free vendor code left for %', vendor_name;
END;
$$;

-- Once a vendor has a code it can never change (invoice IDs contain it).
CREATE FUNCTION keep_vendor_code() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.short_code IS NOT NULL AND NEW.short_code IS DISTINCT FROM OLD.short_code THEN
    RAISE EXCEPTION 'Vendor code % cannot be changed', OLD.short_code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_keep_vendor_code
  BEFORE UPDATE OF short_code ON companies
  FOR EACH ROW EXECUTE FUNCTION keep_vendor_code();

-- Give vendors that are already approved an automatic code (oldest approval first).
DO $$
DECLARE
  company RECORD;
BEGIN
  FOR company IN
    SELECT id, vendor_name FROM companies
     WHERE status = 'approved' AND short_code IS NULL
     ORDER BY reviewed_at NULLS LAST, id
  LOOP
    UPDATE companies SET short_code = suggest_vendor_code(company.vendor_name) WHERE id = company.id;
  END LOOP;
END;
$$;

-- From now on an approved vendor always has a code.
ALTER TABLE companies
  ADD CONSTRAINT companies_approved_has_code CHECK (status <> 'approved' OR short_code IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Invoice IDs
-- ---------------------------------------------------------------------------
-- invoice_code was generated from the row id (DOC-000001); it becomes a normal column
-- that the API fills in when the invoice is created.
ALTER TABLE invoices ALTER COLUMN invoice_code DROP EXPRESSION;

-- Renumber existing invoices: per vendor, in order of first submission.
WITH first_submission AS (
  SELECT i.id, i.company_id,
         coalesce(
           (SELECT min(e.created_at) FROM invoice_events e
             WHERE e.invoice_id = i.id AND e.action = 'submitted'),
           i.submitted_at) AS first_at
    FROM invoices i
), numbered AS (
  SELECT f.id, f.company_id, f.first_at,
         row_number() OVER (PARTITION BY f.company_id ORDER BY f.first_at, f.id) AS n
    FROM first_submission f
)
UPDATE invoices i
   SET invoice_code = to_char(n.first_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')
                      || '-' || c.short_code
                      || CASE WHEN n.n < 1000 THEN lpad(n.n::text, 3, '0') ELSE n.n::text END
  FROM numbered n
  JOIN companies c ON c.id = n.company_id
 WHERE i.id = n.id;

-- Each vendor continues counting after its existing invoices.
UPDATE companies c
   SET invoice_seq = sub.total
  FROM (SELECT company_id, count(*)::int AS total FROM invoices GROUP BY company_id) sub
 WHERE c.id = sub.company_id;

ALTER TABLE invoices ALTER COLUMN invoice_code SET NOT NULL;
