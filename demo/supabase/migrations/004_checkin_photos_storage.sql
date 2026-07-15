-- =============================================================================
-- Migration: Storage bucket + RLS for check-in photos
-- =============================================================================
-- Private bucket. Uploads happen server-side only (checkin Edge Function,
-- service role key — bypasses RLS). Read access is scoped so a manager/admin
-- can see their own company's photos, and a worker can see only their own.
--
-- Path convention: {company_id}/{user_id}/{timestamp}.jpg
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', false)
on conflict (id) do nothing;

drop policy if exists "checkin-photos: read own company" on storage.objects;
create policy "checkin-photos: read own company"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and (storage.foldername(name))[1] = auth_company_id()::text
    and (
      auth_role() in ('manager', 'admin')
      or (storage.foldername(name))[2] = auth_profile_id()::text
    )
  );
