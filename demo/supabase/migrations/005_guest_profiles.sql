-- =============================================================================
-- Migration: guest/visitor profiles with an expiry time
-- =============================================================================
-- A guest is an NFC profile with role='guest' and a guest_expires_at timestamp.
-- After that time the checkin Edge Function refuses the card (GUEST_EXPIRED).
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- 1. Expiry timestamp (guests only; null for staff)
alter table profiles add column if not exists guest_expires_at timestamptz;

-- 2. Allow the new 'guest' role
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('worker', 'manager', 'admin', 'guest'));
