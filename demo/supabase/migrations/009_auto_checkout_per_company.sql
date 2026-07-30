-- =============================================================================
-- Migration: auto-checkout honours each company's auto_checkout_hour
-- =============================================================================
-- The original job was hardcoded to midnight UTC and never read
-- companies.auto_checkout_hour, so the dashboard setting did nothing (and in
-- summer it fired at 02:00 Hungarian time).
--
-- Now a job runs every hour on the hour and closes open check-ins only for the
-- companies whose configured hour matches the current *local* hour.
--
-- Anyone still checked in gets a synthetic checkout stamped at that moment,
-- with a note so it is distinguishable from a real NFC tap in the log.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

create extension if not exists pg_cron;

create or replace function auto_checkout_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_hour int;
begin
  -- Work rules are wall-clock local time; DST is handled by the time zone.
  cur_hour := extract(hour from (now() at time zone 'Europe/Budapest'))::int;

  insert into events (company_id, user_id, type, is_manual, note)
  select distinct on (e.company_id, e.user_id)
    e.company_id,
    e.user_id,
    'checkout',
    false,
    'Automatikus kiléptetés'
  from events e
  join companies c on c.id = e.company_id
  where c.auto_checkout_hour = cur_hour
    and e.type = 'checkin'
    and e.timestamp > now() - interval '24 hours'
    -- still inside: no checkout recorded after this check-in
    and not exists (
      select 1 from events e2
      where e2.user_id = e.user_id
        and e2.type = 'checkout'
        and e2.timestamp > e.timestamp
    )
  order by e.company_id, e.user_id, e.timestamp desc;
end;
$$;

-- Replace the old midnight-UTC schedule with an hourly check.
select cron.unschedule('auto-checkout')
where exists (select 1 from cron.job where jobname = 'auto-checkout');

select cron.schedule(
  'auto-checkout',
  '0 * * * *',
  $$ select auto_checkout_due(); $$
);

-- To inspect:  select * from cron.job;
-- To test now: select auto_checkout_due();
