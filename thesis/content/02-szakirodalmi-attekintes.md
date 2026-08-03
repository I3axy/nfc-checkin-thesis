<!-- ===========================================================================
     2. SZAKIRODALMI ÁTTEKINTÉS
     Előírás: a teljes szöveg 20–30%-a  ->  cél kb. 2000–2800 szó.
     FONTOS: ez NEM a saját munkád bemutatása, hanem mások megoldásainak
     áttekintése és elemzése. Minden állítás mellé hivatkozás kell: [1], [2]...
     A hivatkozások számozása a SZÖVEGBELI megjelenés sorrendjében megy, és
     ugyanez a sorrend az Irodalom fejezetben.
     Legalább EGY valódi szakkönyvnek szerepelnie kell a forrásjegyzékben!
     =========================================================================== -->

# Szakirodalmi áttekintés

<!-- ~150 szó bevezető: mit tekint át ez a fejezet és milyen sorrendben.
     A sablon három kérdést vár meg:
       - Mit végeztek mások ugyanezen vagy hasonló probléma kapcsán?
       - Mi a jelenlegi helyzet a probléma megoldásában?
       - Egy hasonló megoldás gyakorlati példája. -->

## Az azonosítási technológiák áttekintése

<!-- ~500 szó. Tartalom-javaslat:
       - vonalkód és QR-kód: olcsó, de másolható
       - mágneskártya: kopás, alacsony biztonság
       - RFID és NFC viszonya: az NFC az RFID 13,56 MHz-es alesete
       - biometria: ujjlenyomat, arcfelismerés — pontosság vs. adatvédelem (GDPR)
     Táblázat ide kívánkozik (a felirat a táblázat FÖLÉ kerül):
     @@TABLE Az azonosítási technológiák összehasonlítása
     ...majd a Word-táblázatot kézzel illeszted be a generált dokumentumba. -->

## Az NFC technológia

<!-- ~500 szó:
       - működési elv, 13,56 MHz, ISO/IEC 14443, ~4 cm hatótáv
       - a három működési mód: olvasó/író, kártyaemuláció, peer-to-peer
       - kártyatípusok (MIFARE Classic / Ultralight / DESFire) és az UID szerepe
       - biztonsági korlátok: az UID önmagában nem titok, klónozható
         -> ez indokolja a dolgozatban a fényképes ellenőrzést
       - Web NFC API: böngészőből elérhető, jelenleg Android/Chrome korlát -->

## Jelenléti nyilvántartó rendszerek

<!-- ~600 szó:
       - kereskedelmi megoldások áttekintése és korlátaik
       - önálló terminál vs. mobileszköz-alapú megközelítés
       - visszaélési minták: buddy punching (más helyett bélyegzés) és
         a védekezés módjai (fénykép, GPS, biometria)
       - munkajogi/adatvédelmi vonatkozások, adatminimalizálás -->

## Webalkalmazás-architektúrák

<!-- ~600 szó:
       - PWA: telepíthetőség, service worker, offline működés
       - offline-first tervezés: helyi tároló (IndexedDB), műveleti sor,
         idempotens szinkronizáció, eventual consistency
       - BaaS/szerver nélküli megközelítés (Supabase, Firebase): mit vált ki
       - multi-tenant adatmodellek: külön adatbázis / külön séma / közös tábla
         sorszintű szűréssel — előnyök és kockázatok
       - sorszintű biztonság (Row Level Security) mint izolációs eszköz -->

## Mesterséges intelligencia alkalmazása vezetői kimutatásokban

<!-- ~400 szó:
       - nagy nyelvi modellek (LLM) szerepe strukturált adatok
         természetes nyelvű összefoglalásában
       - miért hasznos ez a vezetőnek: gyors értelmezés a nyers számok helyett
       - korlátok: hallucináció, adatvédelem (mit küldünk ki a modellnek),
         költség és késleltetés
     Ez alapozza meg a 3. fejezet MI-összefoglaló alfejezetét. -->

## Következtetések az áttekintésből

<!-- ~200 szó: mi hiányzik a meglévő megoldásokból, és ez hogyan vezet át
     a saját megoldás követelményeihez. Ez köti össze a 2. és 3. fejezetet. -->
