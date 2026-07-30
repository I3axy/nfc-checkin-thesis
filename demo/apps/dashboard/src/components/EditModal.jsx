import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { normalizeUid, hashPin } from '../lib/utils'
import { Modal, Field, Divider } from './ui'
import { toast } from './toast'

// ISO → datetime-local string (local time)
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function EditModal({ employee, onClose, onSaved }) {
  const [name, setName]   = useState(employee.name)
  const [role, setRole]   = useState(employee.role)
  const [dept, setDept]   = useState(employee.department ?? '')
  const [uid, setUid]     = useState(employee.nfc_uid ?? '')
  const [pinValue, setPinValue] = useState('')
  const [clearPin, setClearPin] = useState(false)
  const [expiresAt, setExpiresAt] = useState(toLocalInput(employee.guest_expires_at))
  const [scanning, setScanning]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [addType, setAddType]     = useState('checkin')
  const [addTs, setAddTs]         = useState(() => new Date().toISOString().slice(0, 16))
  const [addNote, setAddNote]     = useState('')
  const [addingEvent, setAddingEvent] = useState(false)
  const nfcSupported = 'NDEFReader' in window

  async function scanCard() {
    setScanning(true)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => { setUid(serialNumber); setScanning(false) }, { once: true })
    } catch (err) { setScanning(false); setError('NFC scan failed: ' + err.message) }
  }

  const isGuest = role === 'guest'

  async function handleSave(e) {
    e.preventDefault()
    if (!isGuest && pinValue && !/^\d{4,6}$/.test(pinValue)) { setError('A PIN 4–6 számjegy legyen'); return }
    setSaving(true); setError('')

    const update = {
      name: name.trim(),
      role,
      department: isGuest ? null : (dept.trim() || null),
      nfc_uid: normalizeUid(uid) || null,
      guest_expires_at: isGuest ? (expiresAt ? new Date(expiresAt).toISOString() : null) : null,
    }
    // PIN: only touch it when the manager explicitly sets a new one or clears it.
    if (clearPin) update.pin = null
    else if (!isGuest && pinValue) update.pin = await hashPin(employee.company_id, pinValue)

    const { error } = await supabase.from('profiles').update(update).eq('id', employee.id)
    if (error) {
      const dupPin = error.code === '23505' && /pin/i.test(error.message)
      setError(dupPin ? 'Ez a PIN már foglalt a cégben, válassz másikat' : error.message)
      toast('A mentés nem sikerült', 'error')
      setSaving(false)
    } else { toast('Profil mentve'); onSaved() }
  }

  async function handleAddEvent() {
    setAddingEvent(true); setError('')
    const { error } = await supabase.from('events').insert({ company_id: employee.company_id, user_id: employee.id, type: addType, timestamp: new Date(addTs).toISOString(), is_manual: true, note: addNote.trim() || null })
    if (error) { setError(error.message); toast('Az esemény rögzítése nem sikerült', 'error') }
    else { setAddNote(''); toast('Esemény rögzítve'); onSaved() }
    setAddingEvent(false)
  }

  return (
    <Modal title={`Szerkesztés — ${employee.name}`} onClose={onClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <Field label="Név"><input value={name} onChange={e => setName(e.target.value)} required style={S.input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Field label="Szerepkör">
            <select value={role} onChange={e => setRole(e.target.value)} style={S.input}>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="guest">Vendég</option>
            </select>
          </Field>
          {isGuest
            ? <Field label="Érvényesség vége"><input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={S.input} /></Field>
            : <Field label="Részleg"><input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} /></Field>
          }
        </div>
        <Field label="NFC UID">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={uid} onChange={e => setUid(e.target.value)} style={{ ...S.input, flex: 1, fontFamily: 'monospace' }} />
            {nfcSupported && <button type="button" onClick={scanCard} disabled={scanning} style={{ ...S.btnPrimary, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>{scanning ? '…' : '📡'}</button>}
          </div>
        </Field>
        {!isGuest && (
          <Field label="PIN">
            <input
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={clearPin}
              inputMode="numeric"
              placeholder={employee.pin ? '•••• beállítva — új PIN a cseréhez' : 'nincs — új PIN megadása'}
              style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.2em', opacity: clearPin ? 0.5 : 1 }}
            />
            {employee.pin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: C.muted, marginTop: '0.35rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={clearPin} onChange={e => setClearPin(e.target.checked)} style={{ accentColor: C.accent }} />
                PIN törlése
              </label>
            )}
          </Field>
        )}
        {error && <div style={S.errorBox}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} style={{ ...S.btnSecondary, flex: 1 }}>Mégse</button>
          <button type="submit" disabled={saving} style={{ ...S.btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Mentés…' : 'Mentés'}</button>
        </div>
      </form>

      <Divider label="Kézi esemény hozzáadása" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Field label="Típus">
          <select value={addType} onChange={e => setAddType(e.target.value)} style={S.input}>
            <option value="checkin">Belépés</option>
            <option value="checkout">Kilépés</option>
          </select>
        </Field>
        <Field label="Időpont"><input type="datetime-local" value={addTs} onChange={e => setAddTs(e.target.value)} style={S.input} /></Field>
      </div>
      <Field label="Megjegyzés">
        <input value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="pl. Elfelejtett kártya" style={{ ...S.input, marginBottom: '0.5rem' }} />
      </Field>
      <button onClick={handleAddEvent} disabled={addingEvent} style={{ ...S.btnPrimary, width: '100%', opacity: addingEvent ? 0.6 : 1 }}>
        {addingEvent ? 'Mentés…' : '+ Esemény hozzáadása'}
      </button>
    </Modal>
  )
}
