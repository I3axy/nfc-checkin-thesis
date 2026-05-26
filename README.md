# NFC Check-in System

A multi-tenant employee check-in/check-out system using NFC cards, built as a university thesis project. Workers tap their NFC card at a kiosk to record attendance; managers monitor everything in real time from a web dashboard.

---

## Overview

Three independent web apps share a single Supabase backend:

| App | Role | Platform |
|-----|------|----------|
| **Scanner** | NFC kiosk — reads cards, records check-in/out | Android Chrome PWA |
| **Worker** | Employee self-service — personal attendance history | Android Chrome PWA |
| **Dashboard** | Manager control panel — live status, reporting, admin | Desktop browser |

---

## Features

### Scanner (Kiosk)
- Web NFC API (`NDEFReader`) — reads card UID on tap
- Calls a Supabase Edge Function (no service key exposed to client)
- Full-screen green/red feedback, auto-reset after 3 s
- 30-second duplicate event deduplication

### Worker App
- Personal check-in/out history
- Shift status overview

### Manager Dashboard
- **Live status** — who is currently inside, real-time via Supabase Realtime
- **Worker management** — master-detail layout with profile editing, per-worker calendar, NFC UID assignment
- **Calendar view** — Windows 11-style calendar per worker; color-coded dots (normal / late / overtime / justified absence / unjustified absence); click a day to add/delete events or write a note
- **Attendance log** — full event log with CSV and Excel (SheetJS) export
- **Absences** — record vacation, sick leave, unjustified, or other absences per worker
- **Statistics** — daily/weekly summary charts (Recharts)
- **Registration** — register new workers and assign NFC cards via browser scan
- **Settings** — configurable work-start time (late threshold), auto-checkout time, company details
- **Lateness detection** — "Late" badge on Status tab if first check-in is after the configured threshold
- Collapsible sidebar navigation

### Backend
- **Multi-tenant** — full data isolation via Row Level Security (`company_id` on every table)
- **Edge Function: `/checkin`** — validates card, toggles check-in/out, handles deduplication; service key never reaches the browser
- **Edge Function: `/send-alerts`** — sends absence/lateness email alerts (Resend)
- **pg_cron** — automatic checkout job at midnight UTC for anyone still checked in
- **Supabase Realtime** — dashboard updates instantly on every new event

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Backend / DB | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Edge Functions | Deno (TypeScript) |
| Charts | Recharts |
| Excel export | SheetJS (xlsx) |
| NFC | Web NFC API (Android Chrome only) |
| Deploy | Vercel (each app independently) |

---

## Project Structure

```
demo/
├── apps/
│   ├── scanner/        # NFC kiosk PWA
│   ├── worker/         # Worker self-service PWA
│   └── dashboard/      # Manager dashboard
├── supabase/
│   ├── schema.sql      # Full DB schema with RLS policies and pg_cron
│   └── functions/
│       ├── checkin/    # NFC event recording
│       ├── send-alerts/# Email notifications
│       └── worker-data/# Worker data endpoint
└── package.json        # Workspace root
```

---

## Database Schema

```
companies   — id, name, slug, photo_required
profiles    — id, company_id, nfc_uid, name, role, department, pin
events      — id, company_id, user_id, type, timestamp, is_manual, note, photo_url
absences    — id, company_id, user_id, date, type, note, approved_by
```

Row Level Security ensures each company's data is completely isolated. The `auth_company_id()` helper function is used in all policies.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Apply the database schema

In the Supabase SQL editor, run:
```sql
-- supabase/schema.sql
```

This creates all tables, RLS policies, indexes, the Realtime publication, and the midnight auto-checkout cron job.

### 2. Deploy Edge Functions

```bash
supabase functions deploy checkin
supabase functions deploy send-alerts
supabase functions deploy worker-data
```

### 3. Configure environment variables

Each app has its own `.env` (copy from `.env.example`):

**`apps/dashboard/.env`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**`apps/scanner/.env`** and **`apps/worker/.env`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_KEY=your-service-role-key   # used only server-side via Edge Function
VITE_CHECKIN_FUNCTION_URL=https://your-project.supabase.co/functions/v1/checkin
VITE_COMPANY_SLUG=your-company-slug
```

### 4. Run locally

```bash
# Dashboard
cd apps/dashboard && npm install && npm run dev

# Scanner
cd apps/scanner && npm install && npm run dev

# Worker
cd apps/worker && npm install && npm run dev
```

### 5. Deploy to Vercel

Each app is deployed as a separate Vercel project pointing to its own `apps/<name>` directory. Set the environment variables in the Vercel dashboard for each project.

---

## NFC — Platform Notes

| Platform | Support |
|----------|---------|
| Android Chrome | Full — Scanner kiosk + Worker app |
| iOS Safari | **Not supported** — Web NFC API unavailable on iOS |

This is a documented limitation. iOS users can access the Worker app for history viewing only; check-in recording requires the Android kiosk. The NFC card stores an NDEF URL (`https://app.example.com/checkin?uid=...`). In production, an HMAC signature should be added to prevent UID spoofing.

---

## Auth Model

| App | Method |
|-----|--------|
| Dashboard | Supabase email + password (anon key) |
| Scanner | Calls Edge Function — no user session needed |
| Worker | Supabase Auth or NFC card identity |

---

## Color Palette

The UI uses a Steam-inspired dark theme:

```js
bg0: '#1b2838'   // page background
bg1: '#16202d'   // sidebar, cards
bg2: '#2a475e'   // active states, headers
accent: '#66c0f4' // primary accent (blue)
green: '#5ba32b'  // checked-in / success
red: '#c94f4f'    // checked-out / error
```

Status colors (calendar dots, badges):
```js
normal:      '#4ade80'   // worked, on time
late:        '#f97316'   // arrived late
overtime:    '#38bdf8'   // worked 8+ hours
justified:   '#a78bfa'   // approved absence
unjustified: '#f87171'   // unexcused absence
```

---

## License

MIT
