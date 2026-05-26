import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, CAL } from '../lib/theme'
import { Table, TableEmpty, SectionLabel, Badge, Field } from '../components/ui'

export const ABSENCE_LABELS = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }

export function AbsencesTab({ employees }) {
  const [absences, setAbsences] = useState([])
  const [userId, setUserId]     = useState('')
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType]         = useState('vacation')
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const workers    = employees.filter(e => e.role === 'worker')
  const profileMap = Object.fromEntries(employees.map(e => [e.id, e]))

  useEffect(() => { if (workers.length > 0 && !userId) setUserId(workers[0].id) }, [workers, userId])
  useEffect(() => {
    supabase.from('absences').select('id, user_id, date, type, note').order('date', { ascending: false }).limit(100)
      .then(({ data }) => setAbsences(data ?? []))
  }, [saving])

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('absences').insert({ user_id: userId, date, type, note: note.trim() || null })
    if (error) setError(error.message)
    else setNote('')
    setSaving(false)
  }

  async function del(id) {
    await supabase.from('absences').delete().eq('id', id)
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)', gap: '1.5rem' }}>
      <div>
        <SectionLabel color={C.accent}>Rögzítés</SectionLabel>
        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '1.25rem' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <Field label="Dolgozó">
              <select value={userId} onChange={e => setUserId(e.target.value)} style={S.input}>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Dátum"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} /></Field>
              <Field label="Típus">
                <select value={type} onChange={e => setType(e.target.value)} style={S.input}>
                  {Object.entries(ABSENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Megjegyzés"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Opcionális" style={S.input} /></Field>
            {error && <div style={S.errorBox}>{error}</div>}
            <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Mentés…' : '+ Rögzítés'}</button>
          </form>
        </div>
      </div>

      <div>
        <SectionLabel color={C.muted}>Rögzített hiányzások</SectionLabel>
        <Table>
          <tbody>
            {absences.length === 0
              ? <TableEmpty>Nincs rögzített hiányzás</TableEmpty>
              : absences.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...S.td, fontWeight: 600, color: C.text }}>{profileMap[a.user_id]?.name ?? '?'}</td>
                  <td style={S.td}><Badge color={a.type === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar}>{ABSENCE_LABELS[a.type]}</Badge></td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.8rem', color: C.muted }}>{a.date}</td>
                  <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>{a.note ?? ''}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button onClick={() => del(a.id)} style={{ ...S.btnIcon, color: C.red, borderColor: C.red + '40' }}>✕</button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </Table>
      </div>
    </div>
  )
}
