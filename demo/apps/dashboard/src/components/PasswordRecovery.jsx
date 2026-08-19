import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, R } from '../lib/theme'
import { Field } from './ui'

// ─────────────────────────────────────────────────────────────────────────────
// Jelszó-visszaállítás a levélben kapott hivatkozásról
// ─────────────────────────────────────────────────────────────────────────────
// A hivatkozás egy egyszer felhasználható helyreállító munkamenetet nyit. A
// Supabase kliens ezt magától felismeri, és PASSWORD_RECOVERY eseményt küld —
// ilyenkor NEM a vezetői felületet kell megjeleníteni, hanem ezt a képernyőt.
//
// Korábban éppen ez hiányzott: a hivatkozás egyszerűen beléptetett, a jelszó
// pedig változatlan maradt, tehát a felhasználó a következő belépésnél megint
// ugyanott tartott.

const MIN_LENGTH = 8

// Visszajelzés a jelszó erősségéről. Nem tiltja a gyenge jelszót — csak
// megmutatja, hol tart —, mert a kényszerített szabályok jellemzően
// kiszámítható jelszavakhoz vezetnek.
function strength(pw) {
  let score = 0
  if (pw.length >= MIN_LENGTH) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^\w\s]/.test(pw)) score++
  if (score <= 1) return { label: 'gyenge', color: C.red, pct: 25 }
  if (score === 2) return { label: 'közepes', color: C.warn, pct: 50 }
  if (score === 3) return { label: 'jó', color: C.green, pct: 75 }
  return { label: 'erős', color: C.green, pct: 100 }
}

export function PasswordRecovery({ email, onDone }) {
  const [pw1, setPw1]     = useState('')
  const [pw2, setPw2]     = useState('')
  const [show, setShow]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [done, setDone]   = useState(false)

  const s = strength(pw1)
  const tooShort = pw1.length > 0 && pw1.length < MIN_LENGTH
  const mismatch = pw2.length > 0 && pw1 !== pw2

  async function submit(e) {
    e.preventDefault()
    if (pw1.length < MIN_LENGTH) { setErr(`A jelszó legalább ${MIN_LENGTH} karakter legyen.`); return }
    if (pw1 !== pw2) { setErr('A két jelszó nem egyezik.'); return }

    setBusy(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setBusy(false)

    if (error) {
      // A leggyakoribb eset a lejárt hivatkozás: a helyreállító munkamenet
      // rövid életű, és egyszer használható fel.
      setErr(
        /expired|invalid|session/i.test(error.message)
          ? 'A hivatkozás lejárt vagy már felhasználásra került. Kérj újat a bejelentkezési oldalon.'
          : error.message,
      )
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <Shell>
        <div style={{ padding: '1.75rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.green, color: C.accentContrast, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: '0.9rem' }}>✓</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Az új jelszó beállítva</div>
          <div style={{ fontSize: '0.82rem', color: C.muted, marginTop: '0.5rem', lineHeight: 1.6 }}>
            Mostantól ezzel tudsz belépni. A korábbi jelszó érvénytelen.
          </div>
          <button onClick={onDone} style={{ ...S.btnPrimary, marginTop: '1.25rem', width: '100%' }}>
            Tovább a felületre →
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={submit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Új jelszó megadása</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginTop: '0.3rem', lineHeight: 1.55 }}>
            {email
              ? <>A(z) <strong style={{ color: C.text }}>{email}</strong> fiókhoz.</>
              : 'Add meg az új jelszavadat.'}
          </div>
        </div>

        <Field label="Új jelszó">
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              value={pw1}
              onChange={e => { setPw1(e.target.value); setErr('') }}
              autoComplete="new-password"
              autoFocus
              style={{ ...S.input, paddingRight: '4.5rem' }}
              placeholder={`Legalább ${MIN_LENGTH} karakter`}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '0.7rem', padding: '0.3rem 0.4rem' }}
            >
              {show ? 'Elrejt' : 'Mutat'}
            </button>
          </div>
        </Field>

        {pw1 && (
          <div style={{ marginTop: '-0.5rem' }}>
            <div style={{ height: 3, background: C.bg2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: tooShort ? C.red : C.muted, marginTop: '0.3rem' }}>
              {tooShort ? `Még ${MIN_LENGTH - pw1.length} karakter kell` : `Erősség: ${s.label}`}
            </div>
          </div>
        )}

        <Field label="Új jelszó mégegyszer">
          <input
            type={show ? 'text' : 'password'}
            value={pw2}
            onChange={e => { setPw2(e.target.value); setErr('') }}
            autoComplete="new-password"
            style={{ ...S.input, borderColor: mismatch ? C.red : undefined }}
            placeholder="Ismételd meg"
          />
        </Field>
        {mismatch && <div style={{ fontSize: '0.75rem', color: C.red, marginTop: '-0.6rem' }}>A két jelszó nem egyezik.</div>}

        {err && <div style={S.errorBox}>{err}</div>}

        <button
          type="submit"
          disabled={busy || pw1.length < MIN_LENGTH || pw1 !== pw2}
          style={{ ...S.btnPrimary, opacity: busy || pw1.length < MIN_LENGTH || pw1 !== pw2 ? 0.55 : 1 }}
        >
          {busy ? 'Mentés…' : 'Jelszó beállítása'}
        </button>
      </form>
    </Shell>
  )
}

// A bejelentkezési képernyővel azonos keret — a felhasználó ugyanabban a
// környezetben marad, nem egy idegen lapra kerül.
function Shell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg0, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(380px, 100%)' }}>
        <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, background: C.accent, color: C.accentContrast, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>N</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>NFC Check-in</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginTop: '0.25rem' }}>Jelszó visszaállítása</div>
        </div>
        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, boxShadow: C.shadow }}>
          {children}
        </div>
      </div>
    </div>
  )
}
