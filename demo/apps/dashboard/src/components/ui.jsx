import { useState, useEffect, useRef } from 'react'
import { C, S, R, tint } from '../lib/theme'

export function Table({ children, className }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, overflowX: 'auto', borderRadius: R.lg, background: C.bg1 }}>
      <table className={className} style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  )
}

// A `num` oszlop jobbra igazodik és szűkebb térközt kap: a számok így
// egymás alatt olvashatók, és a táblázat sem lóg ki a helyéről.
export function Th({ children, sortable, active, dir, num, className, onClick }) {
  return (
    <th
      className={className}
      onClick={onClick}
      title={sortable ? 'Rendezés' : undefined}
      style={{
        padding: num ? '0.6rem 0.7rem' : '0.6rem 1rem',
        textAlign: num ? 'right' : 'left',
        fontSize: '0.68rem', fontWeight: 600,
        color: active ? C.accent : C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        cursor: sortable ? 'pointer' : 'default', userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: `1px solid ${C.border}`, background: C.bg2,
      }}
    >
      {children}
      {/* A nyíl helye akkor is foglalt, ha az oszlop nem aktív — így a
          fejléc nem ugrik meg rendezéskor. */}
      {sortable && (
        <span style={{ marginLeft: '0.35rem', opacity: active ? 1 : 0.3, display: 'inline-block', width: '0.6em' }}>
          {active ? (dir === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      )}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 0 }} />
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
    </div>
  )
}

export function Badge({ children, color }) {
  return (
    <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem', background: tint(color, 13), color, border: `1px solid ${tint(color, 28)}`, borderRadius: 0 }}>
      {children}
    </span>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: C.muted, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
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

// A `headerRight` a bezáró gomb mellé kerül — ide való minden olyan művelet,
// amely magára az ablak tartalmára vonatkozik (például újratöltés).
export function Modal({ title, onClose, children, wide, maxWidth, headerRight }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, width: '100%', maxWidth: maxWidth ?? (wide ? 760 : 460), maxHeight: '90dvh', overflowY: 'auto', borderRadius: R.lg, boxShadow: C.shadow }}>
        {/* A cím zsugorodhat és tördelhet, a műveletek viszont nem: keskeny
            képernyőn különben a bezáró gomb szorulna ki a fejlécből. */}
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0.8rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', position: 'sticky', top: 0, background: C.bg1, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <div style={{ width: 3, height: 16, background: C.accent, borderRadius: 0, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.text, minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            {headerRight}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.1rem 0.3rem', borderRadius: R.sm }}>×</button>
          </div>
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
  return <div style={{ color: C.muted, padding: '3rem', textAlign: 'center', fontSize: '0.9rem', border: `1px solid ${C.border}`, borderRadius: R.lg, background: C.bg1 }}>{children}</div>
}

// Szűrő- és választócsip. Egyetlen helyen definiálva, mert a napló, a státusz
// és a statisztika lap ugyanazt a vizuális elemet használja; korábban
// mindhárom külön, kissé eltérő méretekkel volt megírva.
export function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      style={{
        padding: '0.36rem 0.75rem',
        fontSize: '0.76rem',
        fontWeight: active ? 700 : 500,
        fontFamily: 'inherit',
        lineHeight: 1.3,
        color: active ? C.accent : C.muted,
        background: active ? tint(C.accent, 12) : 'transparent',
        border: `1px solid ${active ? tint(C.accent, 45) : C.border}`,
        borderRadius: 0,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// Szűrőcsoportok elválasztása a szűrősávon belül
export function FilterGroup({ label, children, grow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, flex: grow ? '1 1 220px' : '0 0 auto' }}>
      <span style={{ fontSize: '0.64rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  )
}

// Saját legördülő választó.
//
// A natív <select> listáját a böngésző rajzolja, a szélességét a leghosszabb
// elemhez igazítja, és ezt stíluslapból nem lehet megadni. Szűk elrendezésben
// ezért a lista kilóg a képernyőről — hiába teljes szélességű maga a mező.
// Ez a változat maga jeleníti meg a listát, így az sosem lehet szélesebb a
// választónál, és a formanyelve is a felület többi részét követi.
//
// A natív elemet nem mindenhol váltjuk ki: rövid, néhány elemű listáknál
// (szerepkör, hiányzástípus) a böngésző saját megoldása kifogástalan, és
// érintőképernyőn kényelmesebb is.
export function Select({ value, onChange, options, placeholder = 'Válassz…', style }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // Megnyitáskor a kijelölt elem legyen látható a görgethető listában
  useEffect(() => {
    if (!open) return
    setActive(options.findIndex(o => o.value === value))
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    })
  }, [open])   // eslint-disable-line react-hooks/exhaustive-deps

  function choose(v) { onChange(v); setOpen(false) }

  function onKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (options[active]) choose(options[active].value) }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0, ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          ...S.input,
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          borderColor: open ? C.accent : C.border,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: current ? C.text : C.muted }}>
          {current?.label ?? placeholder}
        </span>
        <span style={{ color: C.muted, fontSize: '0.7rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 2px)', left: 0,
            // A lista SOSEM szélesebb a választónál — ez a lényeg
            width: '100%', maxHeight: 260, overflowY: 'auto',
            background: C.bg1, border: `1px solid ${C.border}`,
            boxShadow: C.shadow, zIndex: 60,
          }}
        >
          {options.map((o, i) => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.5rem 0.7rem', fontSize: '0.85rem', fontFamily: 'inherit',
                  background: i === active ? tint(C.accent, 12) : 'transparent',
                  color: selected ? C.accent : C.text,
                  fontWeight: selected ? 700 : 400,
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
