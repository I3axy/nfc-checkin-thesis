-- =============================================================================
-- Migration: add missing UPDATE policy on companies
-- =============================================================================
-- The companies table only had a SELECT policy. Since RLS defaults to deny,
-- SettingsTab's `supabase.from('companies').update(...)` silently affected
-- 0 rows (no error thrown — PostgREST just filters out all rows via RLS).
-- This is why saving settings appeared to do nothing.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

drop policy if exists "company: manager update" on companies;
create policy "company: manager update"
  on companies for update to authenticated
  using (id = auth_company_id() and auth_role() in ('manager', 'admin'))
  with check (id = auth_company_id() and auth_role() in ('manager', 'admin'));
