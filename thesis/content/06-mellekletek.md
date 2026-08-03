<!-- ===========================================================================
     5. MELLÉKLETEK
     Ide kerül minden, ami feleslegesen terhelné a 2. és 3. fejezetet:
     teljes forráskód, adatbázis-séma, hosszabb táblázatok.
     A mellékletek szövege NEM számít bele a 7000–10 000 szavas kvótába.
     =========================================================================== -->

# Mellékletek

## Nyomtatott mellékletek

<!-- Rövid felvezetés, majd a tényleges tartalom. Kódrészletek így jelölendők
     (a ``` sor után a "framed" szó keretes stílust ad):

```
create table events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null check (type in ('checkin', 'checkout')),
  timestamp   timestamptz not null default now()
);
```
-->

## Elektronikus mellékletek

<!-- A sablon előírása szerint: DVD, amely tartalmazza a szakdolgozatot
     .docx és .pdf formátumban, valamint a védéshez használt prezentációt.
     Itt érdemes felsorolni a forráskód-tároló elérhetőségét is. -->
