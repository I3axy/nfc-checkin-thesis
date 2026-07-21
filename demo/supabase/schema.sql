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
  name          text not null,
  role          text not null check (role in ('worker', 'manager', 'admin', 'guest')),
  department    text,                        -- optional group/shift (e.g. "A műszak")
  pin           text,                        -- hashed PIN fallback (bcrypt)
  guest_expires_at timestamptz,              -- guests only: card stops working after this time
  created_at    timestamptz not null default now(),
  unique (company_id, nfc_uid)               -- UID only unique within a company
);

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
  photo_url   text                           -- foto check-in Storage URL
);

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
create index on events     (company_id, user_id, timestamp desc);
create index on events     (company_id, timestamp desc);
create index on absences   (company_id, user_id, date);

-- ---------------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table events;

-- ---------------------------------------------------------------------------
-- PG_CRON — automatic checkout at midnight UTC
-- ---------------------------------------------------------------------------
select cron.schedule(
  'auto-checkout',
  '0 0 * * *',
  $$
    insert into events (company_id, user_id, type, is_manual, note)
    select distinct on (e.company_id, e.user_id)
      p.company_id,
      e.user_id,
      'checkout',
      false,
      'Automatikus kiléptetés éjfélkor'
    from events e
    join profiles p on p.id = e.user_id
    where e.type = 'checkin'
      and e.timestamp > now() - interval '24 hours'
      and not exists (
        select 1 from events e2
        where e2.user_id = e.user_id
          and e2.type = 'checkout'
          and e2.timestamp > e.timestamp
      )
    order by e.company_id, e.user_id, e.timestamp desc
  $$
);
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
