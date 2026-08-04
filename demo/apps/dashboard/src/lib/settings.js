// Work rules are stored per-company in the DB (companies table).
// Theme is a per-device UI preference, kept in localStorage.

export const DEFAULT_SETTINGS = {
  startHour: 8,
  startMinute: 0,
  lateThresholdMinutes: 15,
  autoCheckoutHour: 23,
  // Műszaknév -> óra felülírás. Ami nincs benne, arra autoCheckoutHour él.
  autoCheckoutByShift: {},
  photoRequired: false,
  pinPhotoRequired: false,
  theme: 'dark',
}

// ─── Theme (localStorage + <html data-theme>) ──────────────────────────
// Two themes: 'dark' | 'light'. The old 'blue' value migrates to 'dark'.
export function loadTheme() {
  return localStorage.getItem('nfc_theme') === 'light' ? 'light' : 'dark'
}

// Persists AND applies immediately (index.html applies it on first paint).
export function saveTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  localStorage.setItem('nfc_theme', t)
  document.documentElement.dataset.theme = t
}

// ─── Company work rules (DB row → settings shape) ──────────────────────
export function companyToSettings(company) {
  return {
    startHour:            company.work_start_hour,
    startMinute:          company.work_start_minute,
    lateThresholdMinutes: company.late_threshold_minutes,
    autoCheckoutHour:     company.auto_checkout_hour,
    autoCheckoutByShift:  company.auto_checkout_by_shift ?? {},
    photoRequired:        company.photo_required,
    pinPhotoRequired:     company.pin_photo_required,
  }
}

// settings shape → company DB columns
export function settingsToCompany(s) {
  return {
    work_start_hour:        Number(s.startHour),
    work_start_minute:      Number(s.startMinute),
    late_threshold_minutes: Number(s.lateThresholdMinutes),
    auto_checkout_hour:     Number(s.autoCheckoutHour),
    auto_checkout_by_shift: sanitizeShiftHours(s.autoCheckoutByShift),
    photo_required:         !!s.photoRequired,
    pin_photo_required:     !!s.pinPhotoRequired,
  }
}

// Csak érvényes órák (0–23) kerülhetnek az adatbázisba. Az üres és a
// hibás érték kimarad — azokra a cég alapértelmezett órája marad érvényes,
// pontosan úgy, ahogy az SQL oldali coalesce is kezeli.
export function sanitizeShiftHours(map) {
  const out = {}
  for (const [shift, hour] of Object.entries(map ?? {})) {
    const name = String(shift).trim()
    if (!name) continue
    if (hour === '' || hour === null || hour === undefined) continue
    const h = Number(hour)
    if (!Number.isInteger(h) || h < 0 || h > 23) continue
    out[name] = h
  }
  return out
}
