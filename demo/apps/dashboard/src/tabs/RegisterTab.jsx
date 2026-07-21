import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { Field } from '../components/ui'

// datetime-local string for `hours` from now, in local time
function hoursFromNow(hours) {
  const ms = Date.now() + hours * 3600000 - new Date().getTimezoneOffset() * 60000
  return new Date(ms).toISOString().slice(0, 16)
}

export function RegisterTab({ companyId, onSaved }) {
  const [uid, setUid]           = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('worker')
  const [dept, setDept]         = useState('')
  const [expiresAt, setExpiresAt] = useState(() => hoursFromNow(4))
  const [scanning, setScanning] = useState(false)
  const [status, setStatus]     = useState(null)
  const [okGuest, setOkGuest]   = useState(false)
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
    setStatus('saving'); setErrorMsg('')

    const payload = {
      company_id: companyId,
      nfc_uid: uid,
      name: name.trim(),
      role,
      department: isGuest ? null : (dept.trim() || null),
      guest_expires_at: isGuest ? new Date(expiresAt).toISOString() : null,
    }
    const { error } = await supabase.from('profiles').insert(payload)
    if (error) { setErrorMsg(error.message); setStatus('error') }
    else {
      setOkGuest(isGuest)
      setStatus('ok')
      setUid(''); setName(''); setRole('worker'); setDept(''); setExpiresAt(hoursFromNow(4))
      onSaved()
    }
  }

  if (status === 'ok') return (
    <div style={{ background: C.bg1, border: `1px solid ${C.green}40`, padding: '2rem', textAlign: 'center', maxWidth: 400 }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
      <div style={{ fontWeight: 700, color: C.green }}>{okGuest ? 'Vendég regisztrálva' : 'Dolgozó regisztrálva'}</div>
      <button onClick={() => setStatus(null)} style={{ ...S.btnPrimary, marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>Újabb regisztráció</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Field label="NFC kártya UID">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input readOnly value={uid} placeholder={scanning ? 'Tartsd a kártyát…' : 'Nyomj 📡-t, aztán tartsd a kártyát'} style={{ ...S.input, flex: 1, fontFamily: 'monospace' }} />
            {nfcSupported
              ? <button type="button" onClick={scanCard} disabled={scanning} style={{ ...S.btnPrimary, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>📡</button>
              : <input value={uid} onChange={e => setUid(e.target.value)} placeholder="Kézi UID" style={{ ...S.input, flex: 1, fontFamily: 'monospace' }} />
            }
          </div>
        </Field>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <Field label="Teljes név"><input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={isGuest ? 'pl. Látogató Anna' : 'pl. Kovács Péter'} style={S.input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Szerepkör">
            <select value={role} onChange={e => setRole(e.target.value)} style={S.input}>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
              <option value="guest">Vendég</option>
            </select>
          </Field>
          {!isGuest && <Field label="Részleg"><input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} /></Field>}
        </div>

        {isGuest && (
          <Field label="Érvényesség vége">
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {[['+2 óra', 2], ['+4 óra', 4], ['+8 óra', 8], ['+1 nap', 24]].map(([label, h]) => (
                <button key={h} type="button" onClick={() => setExpiresAt(hoursFromNow(h))} style={{ ...S.btnSecondary, fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>{label}</button>
              ))}
            </div>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required style={S.input} />
            <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.3rem' }}>Ez után a kártya nem működik a scanner-en.</div>
          </Field>
        )}

        {status === 'error' && <div style={S.errorBox}>{errorMsg}</div>}
        <button type="submit" disabled={status === 'saving'} style={{ ...S.btnPrimary, opacity: status === 'saving' ? 0.6 : 1 }}>
          {status === 'saving' ? 'Regisztrálás…' : isGuest ? 'Vendég regisztrálása →' : 'Regisztrálás →'}
        </button>
      </form>
    </div>
  )
}
