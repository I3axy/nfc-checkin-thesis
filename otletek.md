# Ötletek és funkcióelemzés — NFC Check-in/Check-out Rendszer

## Célcsoport (univerzális)

A rendszer nem kizárólag építési területekre tervezendő — bármilyen helyszínen használható ahol:
- Munkások fizikailag megjelennek egy helyszínen
- Pontos munkaidő-nyilvántartás szükséges
- Több jogosultsági szint kell (munkás, manager, vendég)

**Példák:** építési területek, gyárak, raktárak, irodaházak, iskolák, rendezvények, egészségügyi intézmények

---

## Konkurens rendszerek — Funkcióáttekintés

### Alap check-in/out (minden rendszernél megvan)
- NFC kártyás be/kilépés
- Mobilapp alternatíva
- Eseménynapló (ki, mikor, mit csinált)
- Manager áttekintő felület

---

### Azonosítás és fraud prevention
- **NFC/RFID kártya** — fizikai közelség szükséges, nehéz meghamisítani
// **QR kód** — olcsóbb, de megosztható (gyengébb biztonság) //
- **Arcfelismerés / biometria** — buddy punching megelőzés (valaki más ne tudjon bejelentkezni)
- **GPS geofencing** — csak akkor enged check-in-t, ha fizikailag a helyszínen van
- **Fotó rögzítés** — időbélyeges kép belépéskor

### Munkaidő-kezelés
- Alapidő nyilvántartás (mikor érkezett, mikor ment)
- **Szünet tracking** — mikor, mennyi ideig volt szünet
- **Túlóra figyelés** — automatikus jelzés ha valaki túl sokat dolgozik
- **Késés / hiányzás detektálás** — ha nem jelent meg várható időben
- **Munkahét összesítő** — heti/havi bontás
- **Műszak kezelés** — ki melyik műszakban dolgozik

### Manager dashboard
- Élő nézet — ki van bent éppen
- Statisztikák, grafikonok (napi/heti/havi)
- Késések, hiányzások listája
- Projekt/helyszín alapú szűrés
- **Labor cost** — mennyi munkabér-költség keletkezett
- **Automatikus riportok** — napi/heti összesítő emailben
- **Export** — Excel, CSV, PDF

### Munkás önkiszolgáló felület
- Saját munkaidő megtekintése
- Hibás bejegyzés jelzése (manager jóváhagyással javítható)
- Szabadság / távollét kérelem
- Saját statisztikák (heti óra, fizetés előnézet)
- Értesítések (pl. megerősítés check-in-ről)

### Vendég / látogató kezelés
- Külön profiltípus (nem munkás)
- **Előregisztráció** — ne kelljen helyszínen kitölteni adatokat
- **Időkorlát** — vendég X óra/nap után automatikusan kilép
- Biztonsági tájékoztató digitális elfogadtatása
- Jelvény / azonosító nyomtatás

### Értesítések és automatizálás
- Push értesítés check-in/out-kor
- Alert ha valaki nem jelent meg
- Túlóra figyelmeztetés
- Automatikus checkout ha valaki elfelejtett kilépni (pl. éjfélkor)
- Manager értesítés rendkívüli eseményről

### Offline működés
- Check-in/out akkor is működjön ha nincs internet
- Lokális tárolás, automatikus szinkronizálás reconnect után
- Fontos építési területeken / gyárakban ahol nincs stabil net

### Integráció
- Bérszámfejtő rendszer export (pl. QuickBooks, SAP)
- HR rendszer szinkron
- Projekt menedzsment eszközök (pl. munkafázis alapú nyilvántartás)

---

## Amit a mi rendszerünkbe bele lehetne tenni (reálisan)

### Mindenképp (alapfunkció):
- NFC + mobilapp check-in/out
- Manager dashboard statisztikákkal, diagramokkal
- Munkás önkiszolgáló felület
- Vendég profil időkorláttal
- Export (CSV/Excel)

### Plusz, ami értéket ad és megvalósítható:
- Késés / hiányzás automatikus detektálás + értesítés
- Offline mód (scanner queue + sync)
- Automatikus checkout (éjfél vagy beállítható időpont)
- Szünet tracking
- Heti munkaidő összesítő automatikusan

### Ami bonyolultabb, szakdolgozatnál inkább csak megemlíteni:
- GPS geofencing
- Arcfelismerés / biometria
- Bérszámfejtő integráció
- AI alapú anomália detektálás

---

## GDPR / Adatvédelem szempontok

- Csak szükséges adatok tárolása (adatminimalizálás)
- Munkás csak saját adatát látja
- Manager csak munkahelyi adatokat lát (nem személyes)
- Adat törlési lehetőség (DSAR)
- Meghatározott adattárolási idő (pl. 1 év után törlés)
- Naplózás — ki, mikor fért hozzá az adatokhoz
- Átláthatóság — munkás tudja mi kerül rögzítésre

---

## Technológia irány (jelenlegi demo alapján)

- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Frontend:** React + Vite (monorepo: scanner / worker / dashboard)
- **NFC:** Web NFC API (Android Chrome), fallback: manuális / QR
- **Deploy:** Vercel
- **Diagramok:** Recharts vagy Chart.js (még nincs)
