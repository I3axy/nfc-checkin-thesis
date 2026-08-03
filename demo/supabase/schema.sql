-- =============================================================================
-- NFC Check-in/Check-out System — Multi-tenant Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "pg_cron";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- COMPANIES
-- ---------------------------------------------------------------------------
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,          -- URL-friendly identifier (e.g. "acme-corp")
  photo_required bool not null default false, -- foto check-in on/off per company
  pin_photo_required bool not null default false, -- require photo for PIN check-ins (PINs are shareable)
  work_start_hour        int not null default 8,   -- work rules (per company)
  work_start_minute      int not null default 0,
  late_threshold_minutes int not null default 15,  -- late if checkin > start + threshold
  auto_checkout_hour     int not null default 23,  -- pg_cron auto-checkout time
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users on delete set null,  -- only login users (manager/admin); workers have none (NFC = identity)
  company_id    uuid not null references companies(id) on delete cascade,
  nfc_uid       text,
  first_name    text not null default '',
  last_name     text not null default '',
  -- Teljes név: mindig a két összetevőből származik, így nem tud eltérni tőlük.
  -- Minden meglévő lekérdezés (scanner, worker app, e-mail, export) ezt olvassa.
  name          text generated always as (trim(both ' ' from last_name || ' ' || first_name)) stored,
  phone         text,                        -- E.164 alak, pl. +36301234567
  email         text,                        -- manager/admin esetén a belépési cím
  role          text not null check (role in ('worker', 'manager', 'admin', 'guest')),
  department    text,                        -- optional group/shift (e.g. "A műszak")
  pin           text,                        -- PIN fallback: sha256(company_id || ':' || pin), company-salted for lookup
  guest_expires_at timestamptz,              -- guests only: card stops working after this time
  created_at    timestamptz not null default now(),
  unique (company_id, nfc_uid)               -- UID only unique within a company
);

-- A PIN resolves to exactly one person within a company (null = no PIN)
create unique index if not exists profiles_company_pin_key
  on profiles (company_id, pin) where pin is not null;

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null check (type in ('checkin', 'checkout')),
  timestamp   timestamptz not null default now(),
  note        text,                          -- manual correction comment
  is_manual   bool not null default false,   -- true if manager entered manually
  photo_url   text,                          -- foto check-in Storage URL
  client_event_id uuid                       -- client-gen id for idempotent offline sync
);

-- At most one event per client_event_id (offline sync idempotency); nulls free
create unique index if not exists events_client_event_id_key
  on events (client_event_id)
  where client_event_id is not null;

-- ---------------------------------------------------------------------------
-- ABSENCES
-- ---------------------------------------------------------------------------
create table absences (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('vacation', 'sick', 'unjustified', 'other')),
  note         text,
  approved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (company_id, user_id, date)
);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table companies enable row level security;
alter table profiles   enable row level security;
alter table events     enable row level security;
alter table absences   enable row level security;

-- Helper function: returns the profile id of the currently logged-in user
create or replace function auth_profile_id()
returns uuid
language sql stable security definer
as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

-- Helper function: returns the company_id of the currently logged-in user
create or replace function auth_company_id()
returns uuid
language sql stable security definer
as $$
  select company_id from profiles where auth_user_id = auth.uid()
$$;

-- Helper function: returns the role of the currently logged-in user
create or replace function auth_role()
returns text
language sql stable security definer
as $$
  select role from profiles where auth_user_id = auth.uid()
$$;

-- COMPANIES: authenticated users can only see their own company
create policy "company: own company only"
  on companies for select to authenticated
  using (id = auth_company_id());

-- COMPANIES: managers/admins can update their own company's settings
create policy "company: manager update"
  on companies for update to authenticated
  using (id = auth_company_id() and auth_role() in ('manager', 'admin'))
  with check (id = auth_company_id() and auth_role() in ('manager', 'admin'));

-- PROFILES: read own company's profiles
create policy "profiles: read own company"
  on profiles for select to authenticated
  using (company_id = auth_company_id());

-- PROFILES: login users can update their own row (PIN change etc.)
create policy "profiles: worker self update"
  on profiles for update to authenticated
  using (auth_user_id = auth.uid() and company_id = auth_company_id())
  with check (auth_user_id = auth.uid() and company_id = auth_company_id());

-- PROFILES: managers/admins can insert new profiles in their company
create policy "profiles: manager insert"
  on profiles for insert to authenticated
  with check (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

-- PROFILES: managers/admins can update profiles in their company
create policy "profiles: manager update"
  on profiles for update to authenticated
  using (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  )
  with check (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

-- EVENTS: read own company's events
create policy "events: read own company"
  on events for select to authenticated
  using (company_id = auth_company_id());

-- EVENTS: workers can only read their own events
create policy "events: worker read own"
  on events for select to authenticated
  using (
    company_id = auth_company_id()
    and (
      auth_role() in ('manager', 'admin')
      or user_id = auth_profile_id()
    )
  );

-- EVENTS: managers/admins can insert manual events
create policy "events: manager insert"
  on events for insert to authenticated
  with check (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

-- EVENTS: managers/admins can update/delete events in their company
create policy "events: manager update"
  on events for update to authenticated
  using (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

create policy "events: manager delete"
  on events for delete to authenticated
  using (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

-- ABSENCES: read own company
create policy "absences: read own company"
  on absences for select to authenticated
  using (
    company_id = auth_company_id()
    and (
      auth_role() in ('manager', 'admin')
      or user_id = auth_profile_id()
    )
  );

create policy "absences: manager insert"
  on absences for insert to authenticated
  with check (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

create policy "absences: manager update"
  on absences for update to authenticated
  using (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

create policy "absences: manager delete"
  on absences for delete to authenticated
  using (
    company_id = auth_company_id()
    and auth_role() in ('manager', 'admin')
  );

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index on profiles   (auth_user_id);
create index on profiles   (company_id);
create index on profiles   (company_id, nfc_uid);
create index on profiles   (company_id, last_name, first_name);
create index on events     (company_id, user_id, timestamp desc);
create index on events     (company_id, timestamp desc);
create index on absences   (company_id, user_id, date);

-- ---------------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table events;

-- ---------------------------------------------------------------------------
-- PG_CRON — automatic checkout at each company's configured hour
-- ---------------------------------------------------------------------------
-- Runs hourly and closes open check-ins only where the company's
-- auto_checkout_hour matches the current local hour (DST-aware).
create or replace function auto_checkout_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_hour int;
begin
  cur_hour := extract(hour from (now() at time zone 'Europe/Budapest'))::int;

  insert into events (company_id, user_id, type, is_manual, note)
  select distinct on (e.company_id, e.user_id)
    e.company_id, e.user_id, 'checkout', false, 'Automatikus kiléptetés'
  from events e
  join companies c on c.id = e.company_id
  where c.auto_checkout_hour = cur_hour
    and e.type = 'checkin'
    and e.timestamp > now() - interval '24 hours'
    and not exists (
      select 1 from events e2
      where e2.user_id = e.user_id
        and e2.type = 'checkout'
        and e2.timestamp > e.timestamp
    )
  order by e.company_id, e.user_id, e.timestamp desc;
end;
$$;

select cron.schedule('auto-checkout', '0 * * * *', $$ select auto_checkout_due(); $$);
-- profiles table
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nfc_uid text unique,
  name text not null,
  role text not null check (role in ('worker', 'manager')),
  created_at timestamptz default now()
);

-- events table
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('checkin', 'checkout')),
  timestamp timestamptz default now()
);

-- RLS (scanner/worker use service role → bypass; dashboard uses anon → needs policy)
alter table profiles enable row level security;
alter table events enable row level security;

create policy "authenticated can read profiles" on profiles
  for select to authenticated using (true);

create policy "authenticated can read events" on events
  for select to authenticated using (true);

-- Realtime for dashboard live updates
alter publication supabase_realtime add table events;
