-- =============================================================================
-- Migration: értesítések a dolgozó felé
-- =============================================================================
-- A dolgozó eddig csak akkor szerzett tudomást a kérelme sorsáról, ha éppen
-- megnyitotta a hiányzások fület. Egy hete elutasított kérelem így észrevétlen
-- maradhatott. Az értesítés ezért TÁROLT bejegyzés, nem múló felugró üzenet:
-- visszamenőleg is megtekinthető, és külön jelzi, mi az, amit még nem olvastak.
--
-- Az értesítést ADATBÁZIS-ESEMÉNY hozza létre, nem a vezetői felület. Így akkor
-- is keletkezik, ha a döntés más úton születik (SQL szerkesztő, jövőbeli felület),
-- és nem lehet elfelejteni a kliensoldalon.
--
-- A trigger UTASÍTÁS szintű: egy kéthetes szabadság tíz sort érint, de a
-- döntésről EGY értesítés szól. Ehhez a Postgres átmeneti tábláit
-- (REFERENCING ... TABLE) használjuk.
--
-- Egyszer kell lefuttatni a Supabase SQL szerkesztőjében.
-- =============================================================================

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null references profiles(id)  on delete cascade,
  type        text not null check (type in ('absence_approved', 'absence_rejected')),
  -- A megjelenítéshez szükséges adatok. Azért JSONB, mert a szöveg
  -- megfogalmazása a felület dolga: a nyelv és a formátum ott változhat,
  -- az adatbázisban tárolt tény nem.
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

comment on table notifications is
  'Dolgozói értesítések. A user_id a CÍMZETT profilja, nem a döntéshozóé.';

-- A leggyakoribb lekérdezés: egy dolgozó értesítései, legfrissebb elöl.
create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);

-- ─── Az értesítést létrehozó eseménykezelő ───────────────────────────────────
create or replace function notify_absence_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (company_id, user_id, type, data)
  select
    n.company_id,
    n.user_id,
    case when n.status = 'approved' then 'absence_approved' else 'absence_rejected' end,
    jsonb_build_object(
      'date_from',     min(n.date),
      'date_to',       max(n.date),
      'days',          count(*),
      'absence_type',  n.type,
      'decision_note', n.decision_note
    )
  from new_rows n
  join old_rows o on o.id = n.id
  -- Csak a tényleges állapotváltás számít: a megjegyzés utólagos javítása
  -- vagy egy változatlan mentés nem szülhet újabb értesítést.
  where n.status is distinct from o.status
    and n.status in ('approved', 'rejected')
  group by n.company_id, n.user_id, n.status, n.type, n.decision_note;

  return null;   -- utasítás szintű trigger: a visszatérési értéket figyelmen kívül hagyja
end;
$$;

drop trigger if exists absences_notify_decision on absences;

create trigger absences_notify_decision
  after update on absences
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function notify_absence_decision();

-- ─── Sorszintű biztonság ─────────────────────────────────────────────────────
-- A dolgozói alkalmazás a szolgáltatói kulcsot használó Edge Functionön
-- keresztül fér hozzá, ezért itt csak a bejelentkező vezetőkre kell szabály.
alter table notifications enable row level security;

drop policy if exists "notifications: read own company" on notifications;
create policy "notifications: read own company"
  on notifications for select to authenticated
  using (company_id = auth_company_id());
