import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, CAL } from '../lib/theme'
import { calcDayMinutes, isWorkerLate, fmtMins, fmtClock, normalizeUid } from '../lib/utils'
import { Table, Th, TableEmpty, SectionLabel, Badge, Field } from '../components/ui'

const SHIFT_OPTIONS = ['Nappali', 'Éjszakai', 'C műszak', 'Rugalmas']
const ABSENCE_LABELS = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }
const SUBTABS = [
  { key: 'profil',  label: 'Profil'      },
  { key: 'naptar',  label: 'Naptár'      },
  { key: 'hianyok', label: 'Hiányzások'  },
]

// ─── Master list ──────────────────────────────────────────────────────────────

export function WorkersTab({ employees, settings, onSaved }) {
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (selected) {
      const updated = employees.find(e => e.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [employees])

  const filtered = employees.filter(e => {
    if (e.role === 'guest') return false   // guests are managed on the Status tab
    const q = search.toLowerCase()
    const matchSearch = e.name.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q)
    const matchFilter =
      filter === 'in'  ? e.lastEvent?.type === 'checkin' :
      filter === 'out' ? e.lastEvent?.type !== 'checkin' : true
    return matchSearch && matchFilter
  })

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 'calc(100dvh - 2.5rem)', minHeight: 0 }}>

      {/* ── Left sidebar ── */}
      <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', background: C.bg1, border: `1px solid ${C.border}`, minHeight: 0 }}>

        <div style={{ padding: '0.65rem 0.75rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Keresés…"
            style={{ ...S.input, fontSize: '0.82rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem 0.75rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[['all', 'Mind'], ['in', 'Bent'], ['out', 'Kint']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.72rem',
                fontWeight: filter === key ? 700 : 400,
                border: `1px solid ${filter === key ? C.accent : C.border}`,
                background: filter === key ? C.accent + '18' : 'transparent',
                color: filter === key ? C.accent : C.muted,
                cursor: 'pointer', borderRadius: 0,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {filtered.length === 0
            ? <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.78rem', color: C.muted, textAlign: 'center' }}>Nincs találat</div>
            : filtered.map(emp => {
              const isIn  = emp.lastEvent?.type === 'checkin'
              const isSel = selected?.id === emp.id
              return (
                <div
                  key={emp.id}
                  onClick={() => setSelected(prev => prev?.id === emp.id ? null : emp)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderBottom: `1px solid ${C.border}`,
                    borderLeft: isSel ? `3px solid ${C.accent}` : '3px solid transparent',
                    background: isSel ? C.bg2 : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: isIn ? C.green : C.border, flexShrink: 0, display: 'inline-block' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: isSel ? 700 : 500, color: isSel ? C.accent : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.department ?? '—'}
                    </div>
                  </div>
                  {emp.todayMinutes > 0 && (
                    <span style={{ fontSize: '0.68rem', color: C.muted, fontFamily: 'monospace', flexShrink: 0 }}>
                      {fmtMins(emp.todayMinutes)}
                    </span>
                  )}
                </div>
              )
            })
          }
        </div>

        <div style={{ padding: '0.4rem 0.75rem', borderTop: `1px solid ${C.border}`, fontSize: '0.65rem', color: C.muted, flexShrink: 0 }}>
          {filtered.length} / {employees.filter(e => e.role !== 'guest').length} dolgozó
        </div>
      </div>

      {/* ── Right: detail or placeholder ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {selected
          ? <WorkerDetail key={selected.id} worker={selected} employees={employees} settings={settings} onClose={() => setSelected(null)} onSaved={onSaved} />
          : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: '0.85rem', border: `1px solid ${C.border}`, background: C.bg1 }}>
              Válassz ki egy dolgozót a listából
            </div>
        }
      </div>
    </div>
  )
}

// ─── Detail panel with sub-tabs ───────────────────────────────────────────────

function WorkerDetail({ worker, employees, settings, onClose, onSaved }) {
  const [subTab, setSubTab] = useState('profil')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Sub-tab nav + X */}
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
        {SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '0.6rem 1.25rem', fontSize: '0.82rem',
              fontWeight: subTab === t.key ? 700 : 400,
              border: 'none',
              background: subTab === t.key ? C.bg0 : 'transparent',
              color: subTab === t.key ? C.accent : C.muted,
              cursor: 'pointer',
              borderBottom: subTab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...S.btnIcon, margin: 'auto 0.65rem', padding: '0.2rem 0.55rem', alignSelf: 'center' }}>✕</button>
      </div>

      {/* Sub-tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg0, border: `1px solid ${C.border}`, borderTop: 'none', padding: '1.25rem', minHeight: 0 }}>
        {subTab === 'profil'  && <ProfilSubTab  worker={worker} onSaved={onSaved} />}
        {subTab === 'naptar'  && <NaptarSubTab  worker={worker} settings={settings} />}
        {subTab === 'hianyok' && <HianyokSubTab worker={worker} />}
      </div>
    </div>
  )
}

// ─── Profil sub-tab ───────────────────────────────────────────────────────────

function ProfilSubTab({ worker, onSaved }) {
  const [name,    setName]    = useState(worker.name)
  const [role,    setRole]    = useState(worker.role)
  const [dept,    setDept]    = useState(worker.department ?? '')
  const [uid,     setUid]     = useState(worker.nfc_uid ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [saveOk,  setSaveOk]  = useState(false)

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setSaveErr(''); setSaveOk(false)
    const { error } = await supabase.from('profiles')
      .update({ name: name.trim(), role, department: dept.trim() || null, nfc_uid: normalizeUid(uid) || null })
      .eq('id', worker.id)
    if (error) { setSaveErr(error.message); setSaving(false) }
    else { setSaving(false); setSaveOk(true); setTimeout(() => { setSaveOk(false); onSaved() }, 1200) }
  }

  return (
    <div style={{ maxWidth: 380 }}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <Field label="Teljes név">
          <input value={name} onChange={e => setName(e.target.value)} required style={S.input} />
        </Field>
        <Field label="NFC UID">
          <input value={uid} onChange={e => setUid(e.target.value)} style={{ ...S.input, fontFamily: 'monospace' }} placeholder="pl. 04:A3:B2:C1" />
        </Field>
        <Field label="Szerepkör">
          <select value={role} onChange={e => setRole(e.target.value)} style={S.input}>
            <option value="worker">Worker</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Műszak / Részleg">
          <input value={dept} onChange={e => setDept(e.target.value)} list="shift-opts" placeholder="pl. Nappali" style={S.input} />
          <datalist id="shift-opts">
            {SHIFT_OPTIONS.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>
        {saveErr && <div style={S.errorBox}>{saveErr}</div>}
        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, background: saveOk ? C.green : C.accent }}>
          {saving ? 'Mentés…' : saveOk ? '✓ Mentve' : 'Profil mentése'}
        </button>
      </form>
    </div>
  )
}

// ─── Naptár sub-tab ───────────────────────────────────────────────────────────

function NaptarSubTab({ worker, settings }) {
  const [calMonth,      setCalMonth]      = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [monthEvents,   setMonthEvents]   = useState([])
  const [monthAbsences, setMonthAbsences] = useState([])
  const [loadingCal,    setLoadingCal]    = useState(false)
  const [selectedDay,   setSelectedDay]   = useState(null)

  useEffect(() => {
    setLoadingCal(true); setSelectedDay(null)
    const from  = calMonth.toISOString()
    const to    = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1).toISOString()
    const fromD = calMonth.toISOString().slice(0, 10)
    const toD   = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('events').select('id, type, timestamp, is_manual, note').eq('user_id', worker.id).gte('timestamp', from).lt('timestamp', to).order('timestamp', { ascending: true }),
      supabase.from('absences').select('id, date, type, note').eq('user_id', worker.id).gte('date', fromD).lte('date', toD),
    ]).then(([{ data: evts }, { data: abs }]) => {
      setMonthEvents(evts ?? [])
      setMonthAbsences(abs ?? [])
      setLoadingCal(false)
    })
  }, [worker.id, calMonth])

  async function reloadMonth() {
    const from = calMonth.toISOString()
    const to   = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1).toISOString()
    const { data } = await supabase.from('events').select('id, type, timestamp, is_manual, note').eq('user_id', worker.id).gte('timestamp', from).lt('timestamp', to).order('timestamp', { ascending: true })
    setMonthEvents(data ?? [])
  }

  async function handleAddEvent(type, timestamp) {
    const { error } = await supabase.from('events').insert({ company_id: worker.company_id, user_id: worker.id, type, timestamp, is_manual: true })
    if (!error) reloadMonth()
  }

  async function deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id)
    setMonthEvents(prev => prev.filter(e => e.id !== id))
  }

  const selDayEvts = selectedDay ? monthEvents.filter(e => e.timestamp.slice(0, 10) === selectedDay) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ flex: '0 0 auto' }}>
          <CalendarGrid
            days={getMonthDays(calMonth)}
            events={monthEvents}
            absences={monthAbsences}
            settings={settings}
            selectedDay={selectedDay}
            onDayClick={d => setSelectedDay(prev => prev === d ? null : d)}
            calMonth={calMonth}
            loading={loadingCal}
            onPrevMonth={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            onPrevYear={() => setCalMonth(m => new Date(m.getFullYear() - 1, m.getMonth(), 1))}
            onNextYear={() => setCalMonth(m => new Date(m.getFullYear() + 1, m.getMonth(), 1))}
          />
        </div>

        <div style={{ flex: '0 0 290px', maxHeight: 440, overflowY: 'auto' }}>
          {selectedDay
            ? <DayPanel dateStr={selectedDay} workerId={worker.id} events={selDayEvts} onAdd={handleAddEvent} onDelete={deleteEvent} />
            : <div style={{ paddingTop: '3rem', color: C.muted, fontSize: '0.78rem', textAlign: 'center' }}>Kattints egy napra</div>
          }
        </div>
      </div>

      <div>
        <SectionLabel color={C.muted}>
          Eseménytörténet — {calMonth.toLocaleDateString('hu', { year: 'numeric', month: 'long' })}
        </SectionLabel>
        <Table>
          <thead>
            <tr style={{ background: C.bg2 }}>
              <Th>Típus</Th><Th>Időpont</Th><Th>Megjegyzés</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {monthEvents.length === 0
              ? <TableEmpty colSpan={4}>Nincs esemény ebben a hónapban</TableEmpty>
              : [...monthEvents].reverse().map(e => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={S.td}>
                    <Badge color={e.type === 'checkin' ? C.green : C.red}>{e.type === 'checkin' ? '↑ Be' : '↓ Ki'}</Badge>
                    {e.is_manual && <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', color: C.accent, border: `1px solid ${C.accent}40`, padding: '0 0.3rem' }}>kézi</span>}
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {new Date(e.timestamp).toLocaleDateString('hu', { month: 'short', day: 'numeric' })} {fmtClock(e.timestamp)}
                  </td>
                  <td style={{ ...S.td, fontSize: '0.78rem', color: C.muted }}>{e.note ?? ''}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button onClick={() => deleteEvent(e.id)} style={{ ...S.btnIcon, color: C.red, borderColor: C.red + '40' }}>✕</button>
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

// ─── Hiányzások sub-tab ───────────────────────────────────────────────────────

function HianyokSubTab({ worker }) {
  const [absences, setAbsences] = useState([])
  const [date,     setDate]     = useState(() => new Date().toISOString().slice(0, 10))
  const [type,     setType]     = useState('vacation')
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    supabase.from('absences').select('id, date, type, note').eq('user_id', worker.id).order('date', { ascending: false }).limit(100)
      .then(({ data }) => setAbsences(data ?? []))
  }, [worker.id, saving])

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('absences').insert({ company_id: worker.company_id, user_id: worker.id, date, type, note: note.trim() || null })
    if (error) setError(error.message)
    else setNote('')
    setSaving(false)
  }

  async function del(id) {
    await supabase.from('absences').delete().eq('id', id)
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)', gap: '1.5rem' }}>
      <div>
        <SectionLabel color={C.accent}>Hiányzás rögzítése</SectionLabel>
        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '1.25rem' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <Field label="Dátum"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} /></Field>
              <Field label="Típus">
                <select value={type} onChange={e => setType(e.target.value)} style={S.input}>
                  {Object.entries(ABSENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Megjegyzés">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Opcionális" style={S.input} />
            </Field>
            {error && <div style={S.errorBox}>{error}</div>}
            <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Mentés…' : '+ Rögzítés'}
            </button>
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
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.8rem', color: C.muted }}>{a.date}</td>
                  <td style={S.td}>
                    <Badge color={a.type === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar}>
                      {ABSENCE_LABELS[a.type]}
                    </Badge>
                  </td>
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

// ─── Day panel ────────────────────────────────────────────────────────────────

function DayPanel({ dateStr, workerId, events, onAdd, onDelete }) {
  const noteKey = `nfc_note_${workerId}_${dateStr}`
  const [addType, setAddType] = useState('checkin')
  const [addTime, setAddTime] = useState('08:00')
  const [adding,  setAdding]  = useState(false)
  const [addErr,  setAddErr]  = useState('')
  const [dayNote, setDayNote] = useState(() => localStorage.getItem(noteKey) ?? '')

  function handleNoteChange(e) {
    setDayNote(e.target.value)
    localStorage.setItem(noteKey, e.target.value)
  }

  async function handleAdd() {
    setAdding(true); setAddErr('')
    await onAdd(addType, new Date(`${dateStr}T${addTime}:00`).toISOString())
    setAdding(false)
  }

  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('hu', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Date */}
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.accent }}>
        {dateLabel}
      </div>

      {/* Events */}
      <div>
        {events.length === 0
          ? <div style={{ fontSize: '0.78rem', color: C.muted }}>Nincs esemény ezen a napon.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {events.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge color={ev.type === 'checkin' ? C.green : C.red}>
                    {ev.type === 'checkin' ? '↑ Be' : '↓ Ki'}
                  </Badge>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, color: C.text }}>
                    {fmtClock(ev.timestamp)}
                  </span>
                  {ev.is_manual && <span style={{ fontSize: '0.6rem', color: C.accent, border: `1px solid ${C.accent}40`, padding: '0 0.3rem' }}>kézi</span>}
                  <button
                    onClick={() => onDelete(ev.id)}
                    title="Törlés"
                    style={{ ...S.btnIcon, color: C.red, borderColor: C.red + '40', marginLeft: 'auto', padding: '0.1rem 0.4rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Note */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '0.6rem' }}>
        <div style={{ fontSize: '0.62rem', color: C.muted, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nap megjegyzése</div>
        <textarea
          value={dayNote}
          onChange={handleNoteChange}
          placeholder="Ide írj megjegyzést ehhez a naphoz…"
          rows={3}
          style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.5 }}
        />
      </div>

      {/* Add event */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '0.6rem' }}>
        <div style={{ fontSize: '0.62rem', color: C.muted, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Esemény hozzáadása</div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={addType} onChange={e => setAddType(e.target.value)} style={{ ...S.input, width: 110 }}>
            <option value="checkin">↑ Belépés</option>
            <option value="checkout">↓ Kilépés</option>
          </select>
          <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)} style={{ ...S.input, width: 100 }} />
          <button onClick={handleAdd} disabled={adding} style={{ ...S.btnPrimary, padding: '0.55rem 0.9rem', opacity: adding ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {adding ? '…' : '+ Hozzáad'}
          </button>
        </div>
        {addErr && <div style={{ ...S.errorBox, marginTop: '0.4rem' }}>{addErr}</div>}
      </div>
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function getMonthDays(month) {
  const y = month.getFullYear(), m = month.getMonth()
  const first  = new Date(y, m, 1)
  const last   = new Date(y, m + 1, 0)
  const offset = (first.getDay() + 6) % 7
  const days   = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const NAV_BTN = {
  background: 'transparent', border: 'none', color: C.muted,
  cursor: 'pointer', fontSize: '1rem', padding: '0.2rem 0.4rem',
  lineHeight: 1, borderRadius: 4,
}

function CalendarGrid({ days, events, absences, settings, selectedDay, onDayClick, calMonth, loading, onPrevMonth, onNextMonth, onPrevYear, onNextYear }) {
  const today = new Date()
  const CELL  = 40
  const GAP   = 5

  return (
    <div style={{ userSelect: 'none', width: 7 * CELL + 6 * GAP }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text }}>
          {calMonth.toLocaleDateString('hu', { year: 'numeric', month: 'long' })}
          {loading && <span style={{ color: C.muted, fontWeight: 400, fontSize: '0.78rem' }}> …</span>}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={onPrevYear}  style={NAV_BTN} title="Előző év">«</button>
          <button onClick={onPrevMonth} style={NAV_BTN} title="Előző hónap">‹</button>
          <button onClick={onNextMonth} style={NAV_BTN} title="Következő hónap">›</button>
          <button onClick={onNextYear}  style={NAV_BTN} title="Következő év">»</button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP, marginBottom: GAP }}>
        {['H','K','Sze','Cs','P','Szo','V'].map((d, i) => (
          <div key={d} style={{ width: CELL, textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: i === 6 ? '#f87171' : C.muted, paddingBottom: '0.2rem' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP }}>
        {days.map((day, i) => {
          if (!day) return <div key={`e-${i}`} style={{ width: CELL, height: CELL + 6 }} />

          const isSunday  = day.getDay() === 0
          const isWeekend = isSunday || day.getDay() === 6
          const isFuture  = day > today && day.toDateString() !== today.toDateString()
          const isToday   = day.toDateString() === today.toDateString()
          const dateStr   = day.toISOString().slice(0, 10)
          const isSel     = selectedDay === dateStr
          const dayEvts   = events.filter(e => e.timestamp.slice(0, 10) === dateStr)
          const absence   = absences.find(a => a.date === dateStr)
          const clickable = !isWeekend && !isFuture

          let dotColor = null
          if (!isWeekend && !isFuture) {
            if (absence) {
              dotColor = absence.type === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar
            } else if (dayEvts.length > 0) {
              const mins    = calcDayMinutes(dayEvts)
              const firstIn = dayEvts.find(e => e.type === 'checkin')?.timestamp
              const late    = firstIn ? isWorkerLate(firstIn, settings) : false
              dotColor = mins >= 480 ? CAL.overtime.bar : late ? CAL.late.bar : CAL.normal.bar
            }
          }

          // Win11 style: today = solid accent fill, selected = semitransparent accent ring
          const circleBg =
            isToday ? C.accent :
            isSel   ? C.accent + '22' : 'transparent'
          const circleBorder =
            isToday ? 'none' :
            isSel   ? `2px solid ${C.accent}` : 'none'
          const numColor =
            isToday             ? C.bg0 :
            isSunday            ? '#f87171' :
            isWeekend || isFuture ? C.border :
            C.text

          return (
            <div
              key={dateStr}
              onClick={clickable ? () => onDayClick(dateStr) : undefined}
              style={{ width: CELL, height: CELL + 6, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: clickable ? 'pointer' : 'default' }}
            >
              <div style={{ width: CELL, height: CELL, borderRadius: '50%', background: circleBg, border: circleBorder, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: isToday || isSel ? 700 : 400, color: numColor, lineHeight: 1 }}>
                  {day.getDate()}
                </span>
              </div>
              {dotColor && <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, marginTop: 2 }} />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        {[[CAL.normal,'Rendes'],[CAL.late,'Késő'],[CAL.overtime,'Túlóra'],[CAL.justified,'Igazolt'],[CAL.unjustified,'Igazolatlan']].map(([s, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.bar }} />
            <span style={{ fontSize: '0.6rem', color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
