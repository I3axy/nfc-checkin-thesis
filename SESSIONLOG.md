# Szakdolgozat — Beszélgetés Összefoglalója (2026-05-05)

## Projekt Koncepciója

**Cím:** NFC alapú Check-in/Check-out Rendszer

**Célcsoport:** Universális (nem csak építési területek)
- Építési területek
- Gyárak, raktárak
- Irodaházak, iskolák
- Rendezvények, egészségügyi intézmények

**Fő komponensek:**
1. Passzív NFC chip (csak azonosítót tárol, privacy-friendly)
2. Mobilapp — alternatíva kártyához; ugyanarra a fiókra mutat
3. Manager dashboard — munkahelyi adatok: késések, hiányzások, statisztikák
4. Munkás önkiszolgáló felület — saját adatok, hibajegyzés
5. Vendég/látogató profil — külön jogosultsági szint

**Tech irány:** NFC chip → scanner → szerver → dashboard

**Fontos szempontok:** 
- GDPR-kompatibilis
- Minimális adattárolás az eszközön
- Aggregált statisztikák a managernek
- Portábilis reader (akár telefon is)

---

## Meglévő Demo (InnoHub)

**Repo:** https://github.com/RiscyX/InnoHub.git (klónozva: `c:\dolgok\Szakdolgozat\demo`)

### Jelenlegi állapot:
- ✅ Supabase schema (profiles, events, RLS)
- ✅ Scanner PWA (NFC, UI, logika)
- ✅ Worker PWA (NFC, profil nézet, manager nézet)
- ✅ Dashboard (login, status, insights, log, register)
- ❌ Vercel deploy (config megvan, de nem live)

### Tech stack:
- **Frontend:** React 18 + Vite (monorepo: scanner, worker, dashboard)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **PWA:** Android Chrome-ra optimalizálva (Web NFC API)
- **Deploy:** Vercel (config: `vercel.json` minden app-ban)

### Auth model:
| App | Módszer | Megjegyzés |
|---|---|---|
| scanner | Service role key | RLS bypass, NFC UID = identitás |
| worker | Service role key | RLS bypass, NFC UID = identitás |
| dashboard | Email/pw + anon key | Session-alapú, JWT token |

---

## Konkurens Rendszerek Analízise

### Popul ár megoldások:
Workyard, Connecteam, Clockify, Deputy, FieldPulse, Procore, Buddy Punch, busybusy

### Főbb funkcióik (amit van):
- NFC/RFID kártyás be/kilépés
- Geofencing (GPS-alapú automatikus check-in)
- Offline mód (lokális queue + szinkronizálás)
- Biometria / arcfelismerés (buddy punching megelőzés)
- Manager dashboard grafikonokkal
- Export (Excel, PDF, bérszámfejtő)
- Szünet tracking, túlóra figyelés
- Vendég kezelés (előregisztráció, időkorlát)
- Automatikus riportok

### Amit MI reálisan lehet:

**Mindenképp:**
- NFC + mobilapp check-in/out ✅ (már megvan)
- Manager dashboard statisztikákkal, diagramokkal (kell bővíteni)
- Munkás önkiszolgáló felület ✅ (már megvan)
- Vendég profil időkorláttal (kell)
- Export (CSV/Excel) (kell)

**Plusz, ami értéket ad:**
- Késés/hiányzás automatikus detektálás + értesítés
- Offline mód (scanner queue + sync)
- Automatikus checkout (éjfél vagy beállítható időpont)
- Szünet tracking
- Heti munkaidő összesítő automatikusan

**Amit megemlíteni, de nem implementálni:**
- GPS geofencing
- Arcfelismerés/biometria
- Bérszámfejtő integráció
- AI anomália detektálás

---

## GDPR / Adatvédelmi Szempontok

- Csak szükséges adatok tárolása (adatminimalizálás)
- Munkás csak saját adatát látja
- Manager csak munkahelyi adatokat lát
- Adat törlési lehetőség (DSAR)
- Meghatározott adattárolási idő (pl. 1 év után törlés)
- Naplózás — ki, mikor fért hozzá az adatokhoz
- Átláthatóság — munkás tudja mi kerül rögzítésre

---

## Következő Lépések

### Holnap (konzultáció után):
1. **Tanár visszajelzés** — mi okés, mi nem, scope meghatározása
2. **Fejlesztési irányok pontosítása** — mely funkciók kerüljenek bele
3. **Tervezés** — detailed planning a tervezett funkcióhoz

### Fejlesztési roadmap (szakdolgozathoz):
1. Manager dashboard kibővítése (diagramok, statisztikák)
2. Offline mód megvalósítása
3. Vendég/látogató kezelés
4. Export funkció (CSV/Excel)
5. Tesztek és dokumentáció

---

## Konfigurációs Változások

### Claude Code Settings:
- **Syntax highlighting:** Bekapcsolva (`syntaxHighlightingDisabled: false`)
- **Effort level:** High
- **Permissions mode:** `acceptEdits` — fájlolvasás/írás/szerkesztés automatikus
- **Bash allowlist:** git, npm, npx, node, ls/dir/where — kérdés nélkül
- **Veszélyes műveletek** (git push, rm, stb.) — még mindig kérdez

### Playwright MCP:
- Konfigurálva (`~/.claude/mcp.json`)
- Új sessionben lesz elérhető a `/browser` parancs

---

## Fájlstruktúra

```
c:\dolgok\Szakdolgozat\
├── .git/                           # Git repo
├── .gitignore                      # Git ignorálási szabályok
├── demo/                           # Klónozott InnoHub repo
│   ├── apps/
│   │   ├── scanner/                # NFC kiosk PWA
│   │   ├── worker/                 # Munkás app PWA
│   │   └── dashboard/              # Manager dashboard
│   ├── supabase/
│   │   └── schema.sql              # Adatbázis séma
│   └── CLAUDE.md
├── otletek.md                      # Konkurens rendszerek, ötletek
├── .claude/
│   ├── settings.local.json         # Helyi Claude Code beállítások
│   └── memory/                     # Auto-memory fájlok
│       ├── MEMORY.md               # Memória index
│       ├── project_szakdolgozat.md # Projekt context
│       ├── user_profile.md         # Felhasználó profil
│       └── feedback_style.md       # Válasz stílus preferencia
└── [itt lesz a szakdolgozat kódja később]
```

---

## Még Nyitott Kérdések (konzultációra)

1. Mennyire universal legyen? (csak építés vs. gyár/iroda stb.)
2. iOS NFC támogatás szükséges-e? (jelenleg Android Chrome only)
3. Biometria / arcfelismerés belekerül-e?
4. Bérszámfejtő integráció része-e?
5. Offline mód prioritása?
6. Vendég kezelés komplexitása?
7. Diagramok/statisztikák mélysége?

---

## Kommunikációs Preferenciák

- **Stílus:** Direkt, őszinte — nem kell túlzott dicsérgetés
- **Magyarázat:** Ha valami nem jó irány, azt azonnal jelezni kell
- **Feedback:** Konstruktív, konkrét — nem általános
- **Előrehaladás:** Rövid, tömör szummák (ne hosszú narratívák)

---

## Friss Elérhetőségek

- **Szakdolgozat repo:** `c:\dolgok\Szakdolgozat` (git initialized)
- **Demo repo:** `c:\dolgok\Szakdolgozat\demo` (submodule)
- **Ötletek dokumentum:** `c:\dolgok\Szakdolgozat\otletek.md`
- **Claude Code memory:** `c:\dolgok\Szakdolgozat\.claude\memory\`

---

**Utolsó frissítés:** 2026-05-05
**Status:** Planning fázis, konzultációra vár
