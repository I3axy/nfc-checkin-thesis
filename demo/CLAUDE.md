# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Employee and visitor check-in/check-out via NFC cards. Competition demo (Innohub), built in one day.

## Stack

- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Frontend:** React + Vite — monorepo, three apps
- **Deploy:** Vercel

## Monorepo structure

```
apps/
  scanner/    # PWA, Android Chrome NFC kiosk
  worker/     # PWA, Android Chrome, worker self-service
  dashboard/  # React, manager dashboard (desktop)
```

## Common commands

```bash
# Run individual apps
cd apps/scanner   && npm run dev
cd apps/worker    && npm run dev
cd apps/dashboard && npm run dev

# Build
cd apps/<app> && npm run build
```

## Database schema

```sql
profiles: id (uuid, FK auth.users), nfc_uid, name, role ('worker'|'manager'), created_at
events:   id, user_id (FK profiles), type ('checkin'|'checkout'), timestamp
```

## Auth model

| App       | Auth method                          |
|-----------|--------------------------------------|
| dashboard | Supabase email+password (anon key)   |
| scanner   | Service role key — NFC card = identity |
| worker    | Service role key — NFC card = identity |

## Environment variables

Each app has its own `.env`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=      # dashboard only
VITE_SUPABASE_SERVICE_KEY=   # scanner + worker only
```

## NFC

- Web NFC API (`NDEFReader`), Android Chrome only
- UID read via: `reader.scan()` → `event.serialNumber`

## UI rules

- UI must be simple and large — demo runs on mobile screens
- Scanner: full-screen green/red feedback, auto-reset after 3 s
- All timestamps stored in UTC, displayed in local time
- Do not add unnecessary complexity — this is a one-day demo

## Demo flow

1. Tap NFC card to **Scanner** → green/red screen
2. Tap same card to **Worker App** → personal check-in history
3. Open **Dashboard** on laptop → login → live data via Supabase Realtime

## Implementation status

- [x] Supabase tables created — run `supabase/schema.sql`
- [x] Scanner PWA — `apps/scanner/src/App.jsx`
- [x] Worker PWA — `apps/worker/src/App.jsx`
- [x] Dashboard — `apps/dashboard/src/App.jsx`
- [x] `.env` files filled in for each app
- [ ] Vercel deploy
