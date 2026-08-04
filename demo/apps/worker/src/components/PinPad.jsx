import { useState } from 'react'
import { S, Button } from './ui'

// Számbillentyűzet a PIN megadásához. Szándékosan nem a rendszer billentyűzete:
// telefonon az felugrik és eltakarja a képernyő felét, a nagy gombok pedig
// munka közben, kesztyűben is használhatók.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del']
const MAX_LEN = 6

export function PinPad({ onSubmit, error }) {
  const [pin, setPin] = useState('')

  function press(k) {
    if (k === 'del') { setPin(p => p.slice(0, -1)); return }
    setPin(p => (p.length >= MAX_LEN ? p : p + k))
  }

  const ready = pin.length >= 4

  return (
    <div>
      {/* Kitöltésjelző: a beírt jegyek száma látszik, a számjegyek nem */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0.6rem',
        padding: '1rem 0 1.25rem', minHeight: 20,
      }}>
        {Array.from({ length: MAX_LEN }).map((_, i) => (
          <span key={i} style={{
            width: 12, height: 12,
            border: `1px solid ${i < pin.length ? 'var(--accent)' : 'var(--border)'}`,
            background: i < pin.length ? 'var(--accent)' : 'transparent',
            opacity: i < 4 || i < pin.length ? 1 : 0.35,
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {KEYS.map((k, i) => k === null
          ? <span key={i} />
          : (
            <button key={i} type="button" onClick={() => press(k)} style={{
              padding: '1rem 0', fontSize: k === 'del' ? '0.85rem' : '1.4rem',
              fontWeight: 600, fontFamily: 'inherit',
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 0,
              cursor: 'pointer', minHeight: 58,
            }}>
              {k === 'del' ? 'Törlés' : k}
            </button>
          )
        )}
      </div>

      {error && (
        <div style={{ marginTop: '0.85rem', color: 'var(--red)', fontSize: '0.82rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Button variant="primary" disabled={!ready} onClick={() => onSubmit(pin)}>Belépés</Button>
      </div>
    </div>
  )
}
