import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, R, tint } from '../lib/theme'
import { normalizeUid, hashPin } from '../lib/utils'
import { Field, SectionLabel } from '../components/ui'
import { toast } from '../components/toast'

// datetime-local string: `hours` added to `current` (or to now if empty), local time
function addHours(current, hours) {
  const base = current ? new Date(current) : new Date()
  const d = new Date(base.getTime() + hours * 3600000)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ROLES = [
  { key: 'worker',  label: 'Dolgozó' },
  { key: 'manager', label: 'Manager' },
  { key: 'guest',   label: 'Vendég' },
]

export function RegisterTab({ companyId, onSaved }) {
  const [uid, setUid]           = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('worker')
  const [dept, setDept]         = useState('')
  const [pin, setPin]           = useState('')
  const [expiresAt, setExpiresAt] = useState(() => addHours(null, 4))
  const [scanning, setScanning] = useState(false)
  const [status, setStatus]     = useState(null)
  const [okGuest, setOkGuest]   = useState(false)
  const [okName, setOkName]     = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const nfcSupported = 'NDEFReader' in window
  const isGuest = role === 'guest'

  async function scanCard() {
    setScanning(true); setStatus(null)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => { setUid(serialNumber); setScanning(false) }, { once: true })
    } catch (err) { setScanning(false); setErrorMsg('NFC scan failed: ' + err.message); setStatus('error') }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!uid) { setErrorMsg('Először olvass be egy kártyát'); setStatus('error'); return }
    if (!companyId) { setErrorMsg('A cég azonosító még töltődik, próbáld újra egy pillanat múlva'); setStatus('error'); return }
    if (isGuest && !expiresAt) { setErrorMsg('Adj meg egy érvényességi időt a vendégnek'); setStatus('error'); return }
    if (!isGuest && pin && !/^\d{4,6}$/.test(pin)) { setErrorMsg('A PIN 4–6 számjegy legyen'); setStatus('error'); return }
    setStatus('saving'); setErrorMsg('')

    const payload = {
      company_id: companyId,
      nfc_uid: normalizeUid(uid),
      name: name.trim(),
      role,
      department: isGuest ? null : (dept.trim() || null),
      pin: (!isGuest && pin) ? await hashPin(companyId, pin) : null,
      guest_expires_at: isGuest ? new Date(expiresAt).toISOString() : null,
    }
    const { error } = await supabase.from('profiles').insert(payload)
    if (error) {
      const dupPin = error.code === '23505' && /pin/i.test(error.message)
      setErrorMsg(dupPin ? 'Ez a PIN már foglalt a cégben, válassz másikat' : error.message)
      setStatus('error')
      toast('A regisztráció nem sikerült', 'error')
    } else {
      setOkGuest(isGuest)
      setOkName(name.trim())
      setStatus('ok')
      toast(isGuest ? `Vendég regisztrálva: ${name.trim()}` : `Dolgozó regisztrálva: ${name.trim()}`)
      setUid(''); setName(''); setRole('worker'); setDept(''); setPin(''); setExpiresAt(addHours(null, 4))
      onSaved()
    }
  }

  if (status === 'ok') return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 420, margin: '2.5rem auto 0', borderRadius: R.lg }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: tint(C.green, 15), color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>✓</div>
      <div style={{ fontWeight: 700, color: C.text, fontSize: '1.05rem' }}>{okGuest ? 'Vendég regisztrálva' : 'Dolgozó regisztrálva'}</div>
      {okName && <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: '0.25rem' }}>{okName}</div>}
      <button onClick={() => setStatus(null)} style={{ ...S.btnPrimary, marginTop: '1.25rem', width: 'auto', padding: '0.55rem 1.5rem' }}>Újabb regisztráció</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '2.5rem auto 0' }}>
      <SectionLabel color={C.accent}>Új személy regisztrálása</SectionLabel>
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '1.5rem' }}>

        {/* Role selector — the active option is marked by weight/colour only */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem' }}>
          {ROLES.map(r => (
            <button key={r.key} type="button" onClick={() => setRole(r.key)} style={{
              padding: 0, fontSize: '0.86rem',
              fontWeight: role === r.key ? 700 : 500,
              background: 'transparent',
              color: role === r.key ? C.text : C.muted,
              border: 'none', cursor: 'pointer',
            }}>
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <Field label="NFC kártya UID">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly={nfcSupported} value={uid} onChange={e => setUid(e.target.value)}
                placeholder={nfcSupported ? (scanning ? 'Tartsd a kártyát…' : 'Nyomj 📡-t, aztán tartsd a kártyát') : 'Kézi UID'}
                style={{ ...S.input, flex: 1, fontFamily: "'JetBrains Mono', monospace" }} />
              {nfcSupported && (
                <button type="button" onClick={scanCard} disabled={scanning} style={{ ...S.btnPrimary, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>📡</button>
              )}
            </div>
          </Field>

          <Field label="Teljes név">
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={isGuest ? 'pl. Látogató Anna' : 'pl. Kovács Péter'} style={S.input} />
          </Field>

          {!isGuest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Részleg">
                <input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} />
              </Field>
              <Field label="PIN (opcionális)">
                <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="pl. 1234" style={{ ...S.input, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.2em' }} />
              </Field>
            </div>
          )}
          {!isGuest && pin && (
            <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '-0.5rem' }}>Kártya nélküli belépéshez a scanneren. Titkosítva tároljuk.</div>
          )}

          {isGuest && (
            <div style={{ background: tint(C.accent, 7), border: `1px solid ${tint(C.accent, 22)}`, borderRadius: R.md, padding: '0.9rem 1rem' }}>
              <Field label="Érvényesség vége">
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[['+2 óra', 2], ['+4 óra', 4], ['+8 óra', 8], ['+1 nap', 24]].map(([label, h]) => (
                    <button key={h} type="button" onClick={() => setExpiresAt(c => addHours(c, h))} style={{ ...S.btnSecondary, fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>{label}</button>
                  ))}
                  <button type="button" onClick={() => setExpiresAt(addHours(null, 0))} style={{ ...S.btnIcon, fontSize: '0.72rem' }}>Most</button>
                </div>
                <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required style={S.input} />
                <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.35rem' }}>A gombok hozzáadják az időt a fenti értékhez. Lejárat után a kártya nem működik a scanneren.</div>
              </Field>
            </div>
          )}

          {status === 'error' && <div style={S.errorBox}>{errorMsg}</div>}
          <button type="submit" disabled={status === 'saving'} style={{ ...S.btnPrimary, opacity: status === 'saving' ? 0.6 : 1 }}>
            {status === 'saving' ? 'Regisztrálás…' : isGuest ? 'Vendég regisztrálása →' : 'Regisztrálás →'}
          </button>
        </form>
      </div>
    </div>
  )
}
