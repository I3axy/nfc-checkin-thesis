// -----------------------------------------------------------------------------
// Tiny toast system — bottom-right notifications for operation results.
//
//   import { toast } from '../components/toast'
//   toast('Beállítások elmentve')            // success (green)
//   toast('A mentés nem sikerült', 'error')  // error (red)
//
// <ToastHost /> is mounted once in App; toast() can be called from anywhere.
// -----------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { C, R, tint } from '../lib/theme'

let pushToast = null
let seq = 0

export function toast(msg, type = 'success') {
  pushToast?.({ id: ++seq, msg, type })
}

const ICON = {
  success: ['✓', 'var(--green)'],
  error:   ['✕', 'var(--red)'],
  info:    ['i', 'var(--accent)'],
}

export function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const timers = []
    pushToast = (t) => {
      setItems(prev => [...prev, t])
      timers.push(setTimeout(() => setItems(prev => prev.map(x => x.id === t.id ? { ...x, leaving: true } : x)), 3200))
      timers.push(setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3550))
    }
    return () => { pushToast = null; timers.forEach(clearTimeout) }
  }, [])

  if (items.length === 0) return null

  return (
    <div style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 500, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 380, pointerEvents: 'none' }}>
      {items.map(t => {
        const [icon, color] = ICON[t.type] ?? ICON.info
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            background: C.bg1, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`,
            borderRadius: R.md, padding: '0.6rem 0.9rem', boxShadow: C.shadow,
            animation: t.leaving ? 'toast-out 0.35s ease forwards' : 'toast-in 0.25s ease',
          }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: tint(color, 15), color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.35 }}>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}
