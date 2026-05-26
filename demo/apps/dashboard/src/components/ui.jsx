import { C, S } from '../lib/theme'

export function Table({ children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  )
}

export function Th({ children, sortable, onClick }) {
  return (
    <th onClick={onClick} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: sortable ? 'pointer' : 'default', userSelect: 'none', borderBottom: `1px solid ${C.border}` }}>
      {children}
    </th>
  )
}

export function TableEmpty({ children, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan ?? 10} style={{ padding: '1.5rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>{children}</td>
    </tr>
  )
}

export function SectionLabel({ children, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <div style={{ width: 3, height: 14, background: color }} />
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
    </div>
  )
}

export function Badge({ children, color }) {
  return (
    <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: color + '20', color, border: `1px solid ${color}40` }}>
      {children}
    </span>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: C.muted, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}

export function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 0.75rem' }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

export function Modal({ title, onClose, children, wide, maxWidth }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, width: '100%', maxWidth: maxWidth ?? (wide ? 760 : 460), maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 3, height: 16, background: C.accent }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.text }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
      </div>
    </div>
  )
}

export function SettingsRow({ label, hint, children }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ ...S.td, width: '40%' }}>
        <div style={{ fontWeight: 600, color: C.text }}>{label}</div>
        {hint && <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.15rem' }}>{hint}</div>}
      </td>
      <td style={S.td}>{children}</td>
    </tr>
  )
}

export function EmptyState({ children }) {
  return <div style={{ color: C.muted, padding: '3rem', textAlign: 'center', fontSize: '0.9rem', border: `1px solid ${C.border}` }}>{children}</div>
}
