-- =============================================================================
-- Migration: PIN fallback login + per-company PIN photo policy
-- =============================================================================
-- If a worker forgets/loses their NFC card they can check in with a PIN typed
-- on the scanner keypad. The scanner only sends a PIN (no username), so the
-- profile must be found *by value*. bcrypt can't be looked up by value (random
-- salt), so we store a deterministic, company-salted SHA-256 hash instead:
--
--     profiles.pin = sha256( company_id || ':' || raw_pin )   (lowercase hex)
--
-- The raw PIN is never stored. The hash is unique per company so a typed PIN
-- resolves to exactly one person (and two workers can't share a PIN).
--
-- Because a PIN can be told to a colleague, a manager can separately require a
-- photo for PIN check-ins (companies.pin_photo_required), independent of the
-- normal card photo setting.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- Deterministic, company-salted PIN hash (null = no PIN set)
alter table profiles add column if not exists pin text;

-- A PIN resolves to exactly one person within a company
create unique index if not exists profiles_company_pin_key
  on profiles (company_id, pin)
  where pin is not null;

-- Manager can require a photo specifically for PIN check-ins
alter table companies add column if not exists pin_photo_required boolean not null default false;
