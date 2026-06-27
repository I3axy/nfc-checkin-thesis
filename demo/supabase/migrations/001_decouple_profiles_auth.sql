-- =============================================================================
-- Migration: decouple profiles.id from auth.users
-- =============================================================================
-- Until now profiles.id WAS the auth.users id, so every employee needed a login
-- account. That contradicts the worker model (the NFC card is the identity —
-- workers never log in). This migration makes profiles.id a standalone uuid and
-- links login users (manager/admin) via a new nullable auth_user_id column.
--
-- Safe to run on existing data — no reset required. Run once in the Supabase
-- SQL editor.
-- =============================================================================

-- 1. New column linking a profile to a login account (nullable)
alter table profiles
  add column if not exists auth_user_id uuid unique references auth.users on delete set null;

-- 2. Backfill: until now profiles.id held the auth user id.
--    Only copy where a matching auth account actually exists (guards the FK).
update profiles p set auth_user_id = id
where auth_user_id is null
  and exists (select 1 from auth.users u where u.id = p.id);

-- 3. Workers don't need a login account — keep the link only for manager/admin
update profiles set auth_user_id = null where role = 'worker';

-- 4. Drop the FK that tied profiles.id to auth.users
alter table profiles drop constraint if exists profiles_id_fkey;

-- 5. profiles.id is now an independent uuid primary key
alter table profiles alter column id set default gen_random_uuid();

-- 6. Index for the helper-function lookups
create index if not exists profiles_auth_user_id_idx on profiles (auth_user_id);

-- 7. Helper functions now resolve the current user via auth_user_id
create or replace function auth_profile_id()
returns uuid language sql stable security definer as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

create or replace function auth_company_id()
returns uuid language sql stable security definer as $$
  select company_id from profiles where auth_user_id = auth.uid()
$$;

create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where auth_user_id = auth.uid()
$$;

-- 8. Recreate the policies that referenced auth.uid() directly
drop policy if exists "profiles: worker self update" on profiles;
create policy "profiles: worker self update"
  on profiles for update to authenticated
  using (auth_user_id = auth.uid() and company_id = auth_company_id())
  with check (auth_user_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "events: worker read own" on events;
create policy "events: worker read own"
  on events for select to authenticated
  using (
    company_id = auth_company_id()
    and (auth_role() in ('manager', 'admin') or user_id = auth_profile_id())
  );

drop policy if exists "absences: read own company" on absences;
create policy "absences: read own company"
  on absences for select to authenticated
  using (
    company_id = auth_company_id()
    and (auth_role() in ('manager', 'admin') or user_id = auth_profile_id())
  );
