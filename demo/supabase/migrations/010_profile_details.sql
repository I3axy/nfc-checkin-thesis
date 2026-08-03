-- =============================================================================
-- Migration: bővített személyi adatok a profilokon
-- =============================================================================
-- Új mezők: vezeték- és keresztnév külön, telefonszám, e-mail cím.
--
-- A `name` oszlop NEM tűnik el: GENERÁLT oszloppá alakul, amely a vezeték- és
-- keresztnévből áll össze. Így a scanner, a worker app, a napi e-mail, az
-- Excel-export és minden meglévő lekérdezés változatlanul működik tovább, és
-- a teljes név sosem tud eltérni az összetevőitől.
--
-- A meglévő nevek az első szóköznél kerülnek szétbontásra, magyar sorrendet
-- feltételezve ("Kovács Péter" -> vezetéknév: Kovács, keresztnév: Péter).
-- FIGYELEM: a többtagú neveket (pl. "Nagy Kiss Anna") a migráció után kézzel
-- kell ellenőrizni a Munkások lapon.
--
-- A telefonszám E.164 alakban tárolódik (pl. +36301234567).
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

-- 1. Új oszlopok
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name  text;
alter table profiles add column if not exists phone      text;   -- E.164, pl. +36301234567
alter table profiles add column if not exists email      text;

-- 2. A meglévő nevek szétbontása (csak ott, ahol még nincs kitöltve)
update profiles
set last_name  = case when position(' ' in name) > 0
                      then split_part(name, ' ', 1)
                      else name end,
    first_name = case when position(' ' in name) > 0
                      then trim(substring(name from position(' ' in name) + 1))
                      else '' end
where last_name is null and name is not null;

-- 3. A generált oszlop nem tűrhet NULL összetevőt
alter table profiles alter column first_name set default '';
alter table profiles alter column last_name  set default '';
update profiles set first_name = coalesce(first_name, ''), last_name = coalesce(last_name, '');
alter table profiles alter column first_name set not null;
alter table profiles alter column last_name  set not null;

-- 4. A `name` oszlop generálttá alakítása.
--    Előbb el kell dobni, mert meglévő oszlop nem alakítható generálttá.
alter table profiles drop column if exists name;
alter table profiles add column name text
  generated always as (trim(both ' ' from last_name || ' ' || first_name)) stored;

-- 5. Kereséshez / rendezéshez
create index if not exists profiles_company_lastname_idx on profiles (company_id, last_name, first_name);
