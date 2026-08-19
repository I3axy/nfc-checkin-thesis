-- =============================================================================
-- Migration: a napi összesítő címzettjeinek kiválasztása
-- =============================================================================
-- Eddig a levél MINDEN manager/admin szerepkörű fióknak kiment, választás
-- nélkül. Ez két gondot okozott: aki nem kérte, annak is jött, és nem lehetett
-- olyan címre küldeni, amely nem tartozik vezetői profilhoz (például a saját,
-- ténylegesen olvasott postafiókra).
--
-- A lista NULL értéke a korábbi viselkedést jelenti — minden vezető megkapja —,
-- így a meglévő cégeknél semmi nem változik. Üres tömb azt jelenti, hogy senki:
-- ezzel a napi küldés kikapcsolható anélkül, hogy külön kapcsolót vezetnénk be.
--
-- FONTOS BIZTONSÁGI MEGKÖTÉS: a cím nem tetszőleges. A küldő függvény minden
-- címet összevet a cég vezetői fiókjaihoz tartozó címekkel, és csak egyezés
-- esetén küld. Enélkül a rendszer tetszőleges címre küldő levéltovábbítóvá
-- válna, hiszen a küldő végpont hitelesítés nélkül hívható.
--
-- Egyszer kell lefuttatni a Supabase SQL szerkesztőjében.
-- =============================================================================

alter table companies
  add column if not exists digest_recipients jsonb default null;

comment on column companies.digest_recipients is
  'A napi összesítő címzettjei (e-mail címek tömbje). NULL = minden vezető, [] = senki.';
