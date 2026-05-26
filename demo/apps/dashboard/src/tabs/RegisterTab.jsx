import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { Field } from '../components/ui'

export function RegisterTab({ onSaved }) {
  const [uid, setUid]       = useState('')
  const [name, setName]     = useState('')
  const [role, setRole]     = useState('worker')
  const [dept, setDept]     = useState('')
  const [scanning, setScanning] = useState(false)
  const [status, setStatus]     = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const nfcSupported = 'NDEFReader' in window

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
    setStatus('saving'); setErrorMsg('')
    const { error } = await supabase.from('profiles').insert({ id: crypto.randomUUID(), nfc_uid: uid, name: name.trim(), role, department: dept.trim() || null })
    if (error) { setErrorMsg(error.message); setStatus('error') }
    else { setStatus('ok'); setUid(''); setName(''); setRole('worker'); setDept(''); onSaved() }
  }

  if (status === 'ok') return (
    <div style={{ background: C.bg1, border: `1px solid ${C.green}40`, padding: '2rem', textAlign: 'center', maxWidth: 400 }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
      <div style={{ fontWeight: 700, color: C.green }}>Dolgozó regisztrálva</div>
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
        <Field label="Teljes név"><input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="pl. Kovács Péter" style={S.input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Szerepkör">
            <select value={role} onChange={e => setRole(e.target.value)} style={S.input}>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
          <Field label="Részleg"><input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} /></Field>
        </div>
        {status === 'error' && <div style={S.errorBox}>{errorMsg}</div>}
        <button type="submit" disabled={status === 'saving'} style={{ ...S.btnPrimary, opacity: status === 'saving' ? 0.6 : 1 }}>
          {status === 'saving' ? 'Regisztrálás…' : 'Regisztrálás →'}
        </button>
      </form>
    </div>
  )
}
