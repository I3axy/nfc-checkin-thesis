// -----------------------------------------------------------------------------
// Design tokens.
//
// Every color is a CSS custom property reference — the actual values live in
// index.html under :root[data-theme='dark'|'light'], so switching the
// data-theme attribute re-themes the whole app at runtime while all the
// existing inline `style={{ color: C.text }}` code keeps working unchanged.
// -----------------------------------------------------------------------------

export const C = {
  bg0:    'var(--bg)',
  bg1:    'var(--surface)',
  bg2:    'var(--surface-2)',
  border: 'var(--border)',
  text:   'var(--text)',
  muted:  'var(--muted)',
  accent: 'var(--accent)',
  accentContrast: 'var(--accent-contrast)',
  green:  'var(--green)',
  red:    'var(--red)',
  warn:   'var(--warn)',
  overlay:'var(--overlay)',
  shadow: 'var(--shadow)',
}

// Translucent tint of a token color (replaces the old `C.red + '40'` hex-alpha
// trick, which can't work on top of var() references).
export const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

// Semantic status colors — consistent across all tabs and calendar
export const CAL = {
  normal:      { bar: 'var(--cal-normal)',      text: 'var(--cal-normal)' },
  late:        { bar: 'var(--cal-late)',        text: 'var(--cal-late)' },
  overtime:    { bar: 'var(--cal-overtime)',    text: 'var(--cal-overtime)' },
  justified:   { bar: 'var(--cal-justified)',   text: 'var(--cal-justified)' },
  unjustified: { bar: 'var(--cal-unjustified)', text: 'var(--cal-unjustified)' },
}

// Sharp, squared-off corners throughout — set these to re-introduce rounding.
export const R = { sm: 0, md: 0, lg: 0 }

export const S = {
  input: {
    width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.86rem',
    background: C.bg0, border: `1px solid ${C.border}`, color: C.text,
    outline: 'none', boxSizing: 'border-box', borderRadius: R.md,
    transition: 'border-color 0.15s',
  },
  btnPrimary: {
    padding: '0.6rem 1.25rem', fontSize: '0.86rem', fontWeight: 600,
    background: C.accent, color: C.accentContrast, border: 'none',
    cursor: 'pointer', borderRadius: R.md, transition: 'opacity 0.15s',
  },
  btnSecondary: {
    padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600,
    background: 'transparent', color: C.text, border: `1px solid ${C.border}`,
    cursor: 'pointer', borderRadius: R.md,
  },
  btnIcon: {
    background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
    cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.78rem', borderRadius: R.sm,
  },
  td: { padding: '0.65rem 1rem', fontSize: '0.85rem', color: C.text, background: C.bg1 },
  errorBox: {
    background: tint(C.red, 10), border: `1px solid ${tint(C.red, 30)}`,
    padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: C.red, borderRadius: R.md,
  },
}
