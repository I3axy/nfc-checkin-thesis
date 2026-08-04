-- =============================================================================
-- Migration: hiányzások jóváhagyási folyamata
-- =============================================================================
-- Eddig a dolgozó által beküldött hiányzás azonnal ténnyé vált. Ez a valós
-- működésnek nem felel meg: a szabadság kérelem, amelyről a vezető dönt.
--
-- Új állapotok:
--   pending   – a dolgozó kérelmezte, döntésre vár
--   approved  – a vezető jóváhagyta (vagy a vezető maga rögzítette)
--   rejected  – a vezető elutasította
--
-- A MEGLÉVŐ sorok 'approved' állapotot kapnak: azokat vagy a vezető rögzítette,
-- vagy a korábbi működés szerint már elfogadott tények. Visszamenőleg
-- függőbe tenni őket hibás lenne.
--
-- A döntéshozót a már meglévő approved_by oszlop tárolja.
--
-- Egyszer kell lefuttatni a Supabase SQL szerkesztőjében.
-- =============================================================================

alter table absences
  add column if not exists status text not null default 'approved',
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text;

-- A megkötést külön adjuk hozzá, hogy az ismételt futtatás ne akadjon el.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'absences_status_check'
  ) then
    alter table absences
      add constraint absences_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

comment on column absences.status is
  'pending: dolgozói kérelem, döntésre vár | approved: érvényes hiányzás | rejected: elutasítva';
comment on column absences.decision_note is
  'A vezető indoklása elutasításkor — a dolgozó ezt látja a saját alkalmazásában.';

-- A függőben lévő kérelmek listázása a vezetői felület leggyakoribb szűrése.
create index if not exists absences_pending_idx
  on absences (company_id, status, date)
  where status = 'pending';
