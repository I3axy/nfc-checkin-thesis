// Közös felületi elemek. Szándékosan nincs bennük ikon vagy hangulatjel —
// a jelentést a szöveg, a szín és az elrendezés hordozza. A sarkok élesek,
// hogy a három alkalmazás formanyelve egységes legyen a vezetői felülettel.

export const S = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  label: {
    fontSize: '0.68rem',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    fontWeight: 700,
    letterSpacing: '0.09em',
  },
  input: {
    width: '100%',
    padding: '0.7rem 0.75rem',
    fontSize: '1rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    boxSizing: 'border-box',
    borderRadius: 0,
    outline: 'none',
    fontFamily: 'inherit',
  },
  mono: { fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
}

export function Button({ onClick, variant = 'ghost', disabled, children, type = 'button' }) {
  const styles = {
    primary: { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' },
    ghost:   { background: 'transparent',   color: 'var(--text)',            border: '1px solid var(--border)' },
    danger:  { background: 'transparent',   color: 'var(--red)',             border: '1px solid var(--red)' },
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...styles,
      width: '100%',
      padding: '0.85rem 1.25rem',
      fontSize: '0.95rem',
      fontWeight: 600,
      fontFamily: 'inherit',
      borderRadius: 0,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      // Nagy érintőfelület: az alkalmazás telefonon, gyakran munka közben megy
      minHeight: 48,
    }}>
      {children}
    </button>
  )
}

export function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 1rem', margin: '1.5rem 0 0.5rem' }}>
      <span style={S.label}>{children}</span>
      {right && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{right}</span>}
    </div>
  )
}

export function Card({ children, style }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>
}

export function Stat({ label, value, accent }) {
  return (
    <div style={{ padding: '0.85rem 1rem', flex: 1, minWidth: 0 }}>
      <div style={{ ...S.label, fontSize: '0.62rem' }}>{label}</div>
      <div style={{
        fontWeight: 700, fontSize: '1.25rem', marginTop: '0.2rem',
        color: accent ?? 'var(--text)', ...S.mono, whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return (
    <div style={{ color: 'var(--muted)', padding: '1.75rem 1rem', textAlign: 'center', fontSize: '0.88rem' }}>
      {children}
    </div>
  )
}

export function Pill({ children, color = 'var(--muted)' }) {
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, color,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      padding: '0.2rem 0.55rem', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

// Teljes képernyős állapot (várakozás, hiba, olvasásra kész). Az ikon helyett
// egy egyszerű, CSS-ből rajzolt kártya-jel áll — nem hangulatjel.
export function FullScreen({ title, sub, tone = 'neutral', children, pulse }) {
  const toneColor = { neutral: 'var(--muted)', ok: 'var(--green)', error: 'var(--red)' }[tone]
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center', padding: '1.75rem', boxSizing: 'border-box',
    }}>
      <CardMark color={toneColor} pulse={pulse} />
      <div>
        <div style={{ fontSize: 'clamp(1.35rem, 6vw, 1.8rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
        {sub && <div style={{ fontSize: '0.92rem', color: 'var(--muted)', marginTop: '0.5rem', maxWidth: 340, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      {children && <div style={{ width: 'min(320px, 100%)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{children}</div>}
    </div>
  )
}

// Kártya + rádióhullám jel, tisztán CSS-ből.
function CardMark({ color, pulse }) {
  return (
    <div style={{ position: 'relative', width: 92, height: 62 }}>
      {pulse && (
        <span style={{
          position: 'absolute', inset: -14, border: `2px solid ${color}`,
          opacity: 0.25, animation: 'nfc-pulse 1.8s ease-out infinite',
        }} />
      )}
      <div style={{ position: 'absolute', inset: 0, border: `2px solid ${color}`, background: 'var(--surface)' }}>
        <div style={{ height: 12, background: color, opacity: 0.5, margin: '10px 0 0' }} />
        <div style={{ height: 6, width: '45%', background: color, opacity: 0.3, margin: '10px 0 0 10px' }} />
      </div>
    </div>
  )
}
