<!-- ===========================================================================
     3. PROBLÉMAMEGOLDÁS
     Ez a dolgozat lényegi része: a SAJÁT szakmai hozzájárulás.
     Cél: kb. 5000–7000 szó (a 2. fejezettel együtt 7000–10 000).
     Előírás: a teljes programkód NEM ide, hanem a Mellékletekbe kerül.
     Ide csak az a néhány részlet jöhet, ami a megértéshez elengedhetetlen.
     Az ábrákra hivatkozni kell a szövegben (pl. "az 1. ábrán látható módon").
     =========================================================================== -->

# Problémamegoldás

<!-- ~200 szó: a fejezet felépítésének felvezetése. -->

## Követelmények meghatározása

### Funkcionális követelmények

<!-- ~400 szó. Szerepkörönként érdemes bontani:
       - dolgozó: kártyás be- és kiléptetés, saját adatok megtekintése,
         hiányzás bejelentése
       - vezető: valós idejű állapot, napló, kimutatások, exportálás,
         dolgozók kezelése, beállítások
       - rendszer: automatikus kiléptetés, napi értesítő, vendégkezelés -->

### Nem funkcionális követelmények

<!-- ~300 szó: rendelkezésre állás hálózatkimaradás esetén, válaszidő,
     adatbiztonság és cégek közti elkülönítés, bővíthetőség, hordozhatóság. -->

## A rendszer architektúrája

<!-- ~600 szó: a háromalkalmazásos felépítés indoklása (miért nem egy app).
     Ide kívánkozik az architektúra-ábra: -->

![A rendszer architektúrája](architektura.png)

<!-- Az ábrafájlt a thesis/figures/ mappába kell tenni. A felirat és a
     sorszám automatikusan az ábra alá kerül. -->

### Az alkalmazott technológiák

<!-- ~500 szó: React + Vite, Supabase (PostgreSQL, Auth, Storage, Realtime,
     Edge Functions), Deno futtatókörnyezet. Minden választás INDOKLÁSSAL —
     nem felsorolás, hanem érvelés. -->

## Az adatmodell

<!-- ~700 szó: táblánként a szerep és a fontosabb mezők.
     Az adatbázis-séma ábrája ide való. -->

![Az adatbázis logikai sémája](adatbazis-sema.png)

### A több bérlős (multi-tenant) felépítés

<!-- ~400 szó: minden táblán company_id, és a sorszintű biztonság (RLS)
     hogyan garantálja, hogy egy cég adata más cég számára láthatatlan.
     Rövid szabály-részlet bemutatható: -->

```
create policy "events: read own company"
  on events for select to authenticated
  using (company_id = auth_company_id());
```

### A profilok és a hitelesítés szétválasztása

<!-- ~400 szó: miért nem a profiles.id az auth.users azonosítója.
     A dolgozók NEM rendelkeznek belépési fiókkal — náluk a kártya az identitás;
     csak a vezetők kapnak auth-fiókot (auth_user_id). Ez tervezési döntés volt,
     és a fejlesztés közben derült ki, hogy szükséges — ezt érdemes leírni. -->

## A beléptető alkalmazás

### Az NFC-kártya olvasása

<!-- ~400 szó: Web NFC API, NDEFReader, a serialNumber kiolvasása,
     az UID egységesítése (nagybetűsítés, elválasztók eltávolítása) és hogy
     miért kritikus ez a kliens és a szerver oldalon egyformán. -->

### A be- és kiléptetés logikája

<!-- ~400 szó: az utolsó esemény alapján váltakozó irány, a duplikáció-szűrés
     (30 másodperces ablak), a visszajelzés kialakítása (teljes képernyős
     színkód, hogy több méterről is olvasható legyen). -->

### Fényképes ellenőrzés

<!-- ~400 szó: a visszaélés elleni védelem. A kétlépéses folyamat indoklása:
     a szerver előbb jelzi, hogy fénykép szükséges, és csak a fényképpel
     érkező második kéréskor jön létre az esemény — így nem keletkezik
     félbehagyott bejegyzés. A képek zárt tárolóban, aláírt URL-lel. -->

### Offline működés

<!-- ~900 szó — ez a dolgozat egyik legerősebb műszaki fejezete.
     Alfejezetei:
       - a probléma: hálózatkimaradáskor a beléptetés teljesen leállna
       - helyi névjegyzék (roster) gyorsítótárazása, hogy offline is
         felismerhető legyen a kártya és eldönthető a be/ki irány
       - műveleti sor IndexedDB-ben, az eredeti időbélyeggel
       - idempotens visszajátszás: kliens által generált azonosító és
         egyedi index az adatbázisban -> az ismételt küldés sem duplikál
       - a szolgáltatásfeldolgozó (service worker) szerepe: az alkalmazásnak
         hálózat nélkül is el kell indulnia újratöltés után
       - a szinkronizáció hibakezelése: átmeneti vs. végleges hiba -->

### PIN-alapú tartalék belépés

<!-- ~400 szó: elfelejtett kártya esete. A PIN-t érték szerint kell
     visszakeresni, ezért nem használható véletlen sóval képzett hash;
     helyette cégre sózott, determinisztikus SHA-256. Ennek biztonsági
     következményei és a mérséklés (egyediségi megkötés, külön fénykép-
     kényszer, mert a PIN megosztható). -->

## A dolgozói alkalmazás

<!-- ~500 szó: önkiszolgáló felület, saját jelenléti adatok, heti összesítő,
     hiányzás bejelentése és annak életciklusa. -->

## A vezetői felület

### Valós idejű állapotkövetés

<!-- ~300 szó: a Realtime feliratkozás, azonnali frissülés check-inkor. -->

### Kimutatások és exportálás

<!-- ~500 szó: időszakos elemzés, havi összesítő, Excel-export.
     Képernyőkép ide: -->

![A vezetői felület statisztikai nézete](statisztika.png)

### Mesterséges intelligencia alapú összefoglaló

<!-- ~500 szó: a kiválasztott dolgozó adott időszaki teljesítményének
     természetes nyelvű összefoglalása. Mit küld a rendszer a modellnek
     (aggregált számok, nem személyes azonosítók), hogyan épül fel a prompt,
     és hogyan kezeli a rendszer a hibát/késleltetést. -->

## Automatizált folyamatok

<!-- ~500 szó: ütemezett feladatok (pg_cron):
       - automatikus kiléptetés a cég által beállított órában, helyi
         időzóna szerint (nyári/téli időszámítás kezelése)
       - napi jelenléti összesítő e-mail a vezetőknek -->

## Tesztelés és eredmények

<!-- ~700 szó — ez emeli meg a dolgozat színvonalát:
       - az automatizált egységtesztek (offline sor, szinkronizáció,
         időzóna-kezelés, munkaidő-számítás) és mit igazoltak
       - a kézi, eszközön végzett tesztek forgatókönyvei
       - a fejlesztés során feltárt és javított hibák bemutatása
         (pl. a szolgáltatásfeldolgozó nem tárolt semmit, ezért hálózat
         nélküli újratöltéskor az alkalmazás nem indult el)
       - mérési eredmények: válaszidők, offline szinkronizáció helyessége
     Táblázat-példa (a felirat a táblázat FÖLÉ kerül):
     @@TABLE A tesztesetek és eredményeik összefoglalása -->

## A megoldás korlátai

<!-- ~300 szó: őszinte számvetés. Web NFC csak Android/Chrome alatt;
     a determinisztikus PIN-hash kompromisszuma; a vezetői felület
     asztali eszközre tervezett; az e-mail küldés tesztüzemben egy
     címre korlátozott. Ez nem gyengíti a dolgozatot — a korlátok
     ismerete szakmai érettséget mutat. -->
