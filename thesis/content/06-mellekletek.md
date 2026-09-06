<!-- ===========================================================================
     5. MELLÉKLETEK
     Ide kerül minden, ami feleslegesen terhelné a 2. és 3. fejezetet:
     teljes forráskód, adatbázis-séma, hosszabb táblázatok.
     A mellékletek szövege NEM számít bele a 7000–10 000 szavas kvótába.
     =========================================================================== -->

# Mellékletek

## Nyomtatott mellékletek

Ez a melléklet azokat a részleteket tartalmazza, amelyekre a 3. fejezet
hivatkozik, terjedelmük miatt azonban a szövegben nem szerepelnek. A teljes
forráskód az elektronikus mellékletben található.

**1. melléklet — a jelenléti események táblája.** A `client_event_id` mező a
hálózat nélkül rögzített események ismétlésmentes továbbítását teszi lehetővé:
az azonosítót a kliens állítja elő, az egyediségi megkötés pedig az adatbázisban
él, ezért a küldés megismétlése sem hozhat létre kettőzött bejegyzést.

```
create table events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid not null references profiles(id)  on delete cascade,
  type            text not null check (type in ('checkin', 'checkout')),
  timestamp       timestamptz not null default now(),
  is_manual       boolean not null default false,
  note            text,
  photo_path      text,
  client_event_id text
);

create unique index events_client_event_id_key
  on events (client_event_id)
  where client_event_id is not null;
```

**2. melléklet — a cégek elkülönítését biztosító szabály.** A szabály az
adatbázisban él, ezért minden lekérdezésre érvényes, függetlenül attól, hogy azt
melyik alkalmazás állította össze.

```
alter table events enable row level security;

create policy events_same_company on events
  for all
  using (
    company_id = (
      select company_id from profiles
      where auth_user_id = auth.uid()
    )
  );
```

**3. melléklet — az automatikus kiléptetés órájának meghatározása.** A
mintaillesztés szándékos: a műszakonkénti beállítás szabadon szerkeszthető
szerkezetben tárolódik, egy érvénytelen érték közvetlen átalakítása pedig
kivételt okozna, és ezzel minden cég automatikus kiléptetése elmaradna.

```
coalesce(
  (case
     when c.auto_checkout_by_shift ->> p.department ~ '^[0-9]{1,2}$'
       then (c.auto_checkout_by_shift ->> p.department)::int
   end),
  c.auto_checkout_hour
) = cur_hour
```

**4. melléklet — a döntésről szóló értesítést létrehozó eseménykezelő.** Az
utasítás szintű eseménykezelő a Postgres átmeneti tábláin keresztül a teljes
módosításhalmazt egyszerre látja, ezért egy több napra szóló döntésről egyetlen
értesítés keletkezik.

```
create trigger absences_notify_decision
  after update on absences
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function notify_absence_decision();
```

## Elektronikus mellékletek

A dolgozathoz mellékelt adathordozó a szakdolgozatot `.docx` és `.pdf`
formátumban, a védéshez készült bemutatót, valamint a rendszer teljes
forráskódját tartalmazza, amelyben a három alkalmazás és a szerveroldali
függvények külön mappában szerepelnek. Az adathordozón megtalálhatók továbbá
az adatbázis-migrációk futtatható állományai időrendi sorrendben.
