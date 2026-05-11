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
