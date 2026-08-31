-- =============================================================================
-- Migration: kártya önregisztrálása a beléptető eszközön
-- =============================================================================
-- Eddig a kártyaazonosítót a vezetőnek kellett kézzel bevinnie a dolgozó
-- felvételekor. Ez nem csupán lassú: NÉMÁN hibázik. Egyetlen elgépelt karakter
-- esetén a kártya működik, csak épp rossz személyhez rendelve, és a hiba addig
-- rejtve marad, amíg valaki össze nem veti a naplót a valósággal.
--
-- Az új folyamatban a PIN-nel belépő dolgozónak — ha még nincs kártyája — a
-- beléptető felajánlja a párosítást: a kártya fizikailag ott van a helyes
-- ember kezében, tehát elgépelni nincs mit.
--
-- A PIN ezzel első ízben jogosít adatmódosításra, ezért a szerver három
-- korlátot érvényesít (lásd checkin/index.ts, action:'enroll_card'):
--   1. csak akkor, ha a profilhoz MÉG NEM tartozik kártya — felülírás soha;
--   2. csak akkor, ha az azonosító a cégen belül szabad;
--   3. csak akkor, ha a cég engedélyezi (az alábbi kapcsoló).
--
-- Egyszer kell lefuttatni a Supabase SQL szerkesztőjében.
-- =============================================================================

-- Cégenkénti kapcsoló. Alapértelmezésben BE: a kézi bevitel néma elgépelése
-- nagyobb kockázat, mint a párosítás — az legalább nyomot hagy (lásd alább).
alter table companies
  add column if not exists card_self_enroll boolean not null default true;

comment on column companies.card_self_enroll is
  'Párosíthatja-e a dolgozó a saját kártyáját a beléptetőn, PIN-nel. Ha false, a kártyaazonosítót csak vezető viheti be.';

-- A párosítás nyoma. Ha kitöltött, a kártyát a dolgozó maga rendelte a
-- profiljához a beléptetőnél; ha üres, vezető vitte be (vagy nincs kártya).
-- Enélkül a két eset utólag megkülönböztethetetlen volna.
alter table profiles
  add column if not exists nfc_uid_enrolled_at timestamptz;

comment on column profiles.nfc_uid_enrolled_at is
  'Mikor párosította a dolgozó a saját kártyáját a beléptetőn. NULL = vezető rögzítette, vagy nincs kártya.';
