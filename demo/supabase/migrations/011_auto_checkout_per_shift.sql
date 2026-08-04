-- =============================================================================
-- Migration: műszakonként külön automatikus kiléptetési óra
-- =============================================================================
-- Eddig cégenként egyetlen óra volt beállítható (auto_checkout_hour). Ez a
-- gyakorlatban kevés: az éjszakás műszak reggel 6-kor végez, a nappali délután
-- 14-kor. Egyetlen közös órával az egyik műszak mindig rosszul zárul.
--
-- Megoldás: a companies táblára kerül egy JSONB leképezés, amely műszaknévhez
-- (profiles.department) rendel órát. Ami nincs benne, arra a cég alapértelmezett
-- auto_checkout_hour értéke marad érvényben — így a meglévő beállítás nem
-- változik, és a részleg nélküli dolgozók is kezelve vannak.
--
-- Példa: {"Éjszakai": 6, "Nappali": 14}
--
-- FONTOS: ez a migráció feltételezi, hogy a 009 már lefutott. Ha nem, ez a fájl
-- önmagában is helyreállítja az órás ütemezést (a régi, éjfél UTC-s job
-- törlésre kerül) — a 009 külön futtatása ilyenkor sem árt.
--
-- Egyszer kell lefuttatni a Supabase SQL szerkesztőjében.
-- =============================================================================

create extension if not exists pg_cron;

alter table companies
  add column if not exists auto_checkout_by_shift jsonb not null default '{}'::jsonb;

comment on column companies.auto_checkout_by_shift is
  'Műszaknév -> óra (0-23) leképezés. Ami nincs benne, arra auto_checkout_hour érvényes.';

-- ─── A kiléptető függvény ────────────────────────────────────────────────────
-- Óránként fut. Minden nyitva maradt belépéshez kikeresi az adott dolgozóra
-- érvényes órát, és csak akkor zár, ha az megegyezik az aktuális HELYI órával.
create or replace function auto_checkout_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_hour int;
begin
  -- Helyi óra, nyári/téli időszámítást is figyelembe véve. Ezért fut a job
  -- óránként, és nem egy fix UTC időpontban.
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
  join profiles  p on p.id = e.user_id
  where e.type = 'checkin'
    -- Csak a friss belépések: egy 24 óránál régebbi nyitott bejegyzést nem
    -- ehhez a naphoz tartozónak tekintünk.
    and e.timestamp > now() - interval '24 hours'
    -- A műszakra beállított óra, ha van; különben a cég alapértelmezése.
    -- A mintaillesztés szándékos: egy kézzel elrontott JSONB érték castolása
    -- kivételt dobna, és ezzel MINDEN cég automatikus kiléptetése elmaradna.
    -- Így a hibás bejegyzés csak arra a műszakra hat, ott is az alapértelmezésre
    -- visszaesve. A 24-99 közti érték sosem egyezik a 0-23 közti órával.
    and coalesce(
          (case
             when c.auto_checkout_by_shift ->> p.department ~ '^[0-9]{1,2}$'
               then (c.auto_checkout_by_shift ->> p.department)::int
           end),
          c.auto_checkout_hour
        ) = cur_hour
    -- Csak akkor, ha a belépés óta nem volt kilépés.
    and not exists (
      select 1 from events e2
      where e2.user_id = e.user_id
        and e2.type = 'checkout'
        and e2.timestamp > e.timestamp
    )
  order by e.company_id, e.user_id, e.timestamp desc;
end;
$$;

-- ─── Ütemezés ────────────────────────────────────────────────────────────────
-- A régi, éjfél UTC-re rögzített job eltávolítása (nyáron 02:00-kor futott).
select cron.unschedule('auto-checkout')
where exists (select 1 from cron.job where jobname = 'auto-checkout');

select cron.schedule('auto-checkout', '0 * * * *', $$ select auto_checkout_due(); $$);
