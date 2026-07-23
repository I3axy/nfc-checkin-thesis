-- =============================================================================
-- Migration: schedule the daily attendance digest email
-- =============================================================================
-- A pg_cron job calls the send-alerts Edge Function once a day; the function
-- builds a presence digest per company and emails it to the managers via
-- Resend. An empty JSON body means "all companies".
--
-- Prerequisites (run once, Supabase SQL editor as the postgres role):
--   * pg_cron  — scheduler
--   * pg_net   — async HTTP from Postgres (net.http_post)
--
-- IMPORTANT: replace <PROJECT_REF> below with your project ref if different.
-- send-alerts must be deployed with "Verify JWT" OFF (it's called with no auth).
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running is safe: drop the previous schedule if it exists.
select cron.unschedule('daily-attendance-digest')
where exists (select 1 from cron.job where jobname = 'daily-attendance-digest');

-- 16:00 UTC daily (~17:00 CET / 18:00 CEST — end of the workday in Hungary).
select cron.schedule(
  'daily-attendance-digest',
  '0 16 * * *',
  $$
  select net.http_post(
    url     := 'https://nszmqtuiniwcbonlsiza.supabase.co/functions/v1/send-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- To inspect:   select * from cron.job;
-- To remove:    select cron.unschedule('daily-attendance-digest');
