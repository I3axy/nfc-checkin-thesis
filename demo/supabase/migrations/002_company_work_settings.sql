-- =============================================================================
-- Migration: move work-rule settings onto the companies table (per-company)
-- =============================================================================
-- Until now the work rules (start time, late threshold, auto-checkout) lived in
-- the manager's browser localStorage — not multi-tenant and not shared between
-- devices. This moves them to the companies table so every setting is scoped to
-- a company in the database. (photo_required already lives here.)
--
-- Safe to run on existing data. Run once in the Supabase SQL editor.
-- =============================================================================

alter table companies
  add column if not exists work_start_hour        int not null default 8,
  add column if not exists work_start_minute      int not null default 0,
  add column if not exists late_threshold_minutes int not null default 15,
  add column if not exists auto_checkout_hour     int not null default 23;
