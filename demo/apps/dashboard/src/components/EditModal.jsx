import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { Modal, Field, Divider } from './ui'

export function EditModal({ employee, onClose, onSaved }) {
  const [name, setName]   = useState(employee.name)
  const [role, setRole]   = useState(employee.role)
  const [dept, setDept]   = useState(employee.department ?? '')
  const [uid, setUid]     = useState(employee.nfc_uid ?? '')
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

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('profiles').update({ name: name.trim(), role, department: dept.trim() || null, nfc_uid: uid.trim() || null }).eq('id', employee.id)
    if (error) { setError(error.message); setSaving(false) } else onSaved()
  }

  async function handleAddEvent() {
    setAddingEvent(true); setError('')
    const { error } = await supabase.from('events').insert({ user_id: employee.id, type: addType, timestamp: new Date(addTs).toISOString(), is_manual: true, note: addNote.trim() || null })
    if (error) setError(error.message)
    else { setAddNote(''); onSaved() }
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
            </select>
          </Field>
          <Field label="Részleg"><input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} /></Field>
        </div>
        <Field label="NFC UID">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={uid} onChange={e => setUid(e.target.value)} style={{ ...S.input, flex: 1, fontFamily: 'monospace' }} />
            {nfcSupported && <button type="button" onClick={scanCard} disabled={scanning} style={{ ...S.btnPrimary, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>{scanning ? '…' : '📡'}</button>}
          </div>
        </Field>
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
