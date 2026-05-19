import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Splash />
  return session ? <Dashboard /> : <Login />
}

function Splash() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg0 }}>
      <div style={{ fontSize: '0.8rem', color: C.muted, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Betöltés…</div>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg0, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(360px, 100%)' }}>
        {/* Logo */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text }}>
            NFC <span style={{ color: C.accent }}>Check-in</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '0.3rem' }}>Manager Dashboard</div>
        </div>

        <div style={{ background: C.bg1, border: `1px solid ${C.border}` }}>
          {/* Header stripe */}
          <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 3, height: 16, background: C.accent }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>Bejelentkezés</span>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={S.input} placeholder="you@example.com" />
            </Field>
            <Field label="Jelszó">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={S.input} placeholder="••••••••" />
            </Field>
            {error && <div style={S.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Bejelentkezés…' : 'Bejelentkezés →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────

function Dashboard() {
  const [employees, setEmployees] = useState([])
  const [events, setEvents] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [tab, setTab] = useState('status')

  const loadData = useCallback(async () => {
    const [{ data: profiles }, { data: allEvents }] = await Promise.all([
      supabase.from('profiles').select('id, name, role, department, nfc_uid').order('name'),
      supabase.from('events').select('id, user_id, type, timestamp, is_manual, note').order('timestamp', { ascending: false }).limit(500),
    ])
    const latestEvent = {}
    const eventsByUser = {}
    for (const e of allEvents ?? []) {
      if (!latestEvent[e.user_id]) latestEvent[e.user_id] = e
      if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
      eventsByUser[e.user_id].push(e)
    }
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setEmployees((profiles ?? []).map(p => {
      const ue = eventsByUser[p.id] ?? []
      const today = getDaySummary(ue)
      return { ...p, lastEvent: latestEvent[p.id] ?? null, todayMinutes: today.totalMinutes, todayCheckins: today.checkins, firstInToday: today.firstIn, lastOutToday: today.lastOut, weekMinutes: calcRangeMinutes(ue, 7), weekEvents: countRangeEvents(ue, 7) }
    }))
    setEvents((allEvents ?? []).map(e => ({ ...e, name: profileMap[e.user_id]?.name ?? 'Ismeretlen' })))
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => { loadData(); setLastUpdate(new Date()) }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const checkedIn = employees.filter(e => e.lastEvent?.type === 'checkin').length
  const todayCI   = events.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString() && e.type === 'checkin').length
  const totalMins = employees.reduce((s, e) => s + e.todayMinutes, 0)

  const navItems = [
    { key: 'status',    label: 'Státusz' },
    { key: 'log',       label: 'Napló' },
    { key: 'insights',  label: 'Statisztika' },
    { key: 'absences',  label: 'Hiányzások' },
    { key: 'register',  label: 'Regisztráció' },
  ]

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: C.bg0, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: C.bg1, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '1.1rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text }}>NFC <span style={{ color: C.accent }}>Check-in</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
            {lastUpdate && <span style={{ fontSize: '0.6rem', color: C.muted }}>{lastUpdate.toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: C.muted }}>Bent most</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.green }}>{checkedIn}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: C.muted }}>Összes dolgozó</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.text }}>{employees.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: C.muted }}>Mai belépések</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.accent }}>{todayCI}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: C.muted }}>Mai összes idő</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.text }}>{fmtMins(totalMins)}</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {navItems.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '0.55rem 1rem', border: 'none', cursor: 'pointer',
              background: tab === n.key ? C.bg2 : 'transparent',
              color: tab === n.key ? C.text : C.muted,
              fontSize: '0.85rem', fontWeight: tab === n.key ? 700 : 400,
              borderLeft: tab === n.key ? `3px solid ${C.accent}` : '3px solid transparent',
            }}>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => supabase.auth.signOut()} style={{ ...S.btnSecondary, width: '100%', fontSize: '0.78rem' }}>
            Kilépés
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 3, height: 16, background: C.accent }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {navItems.find(n => n.key === tab)?.label}
          </span>
        </div>

        <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
          {tab === 'status'   && <StatusTab employees={employees} onSaved={loadData} />}
          {tab === 'log'      && <LogTab events={events} onSaved={loadData} />}
          {tab === 'insights' && <InsightsTab employees={employees} />}
          {tab === 'absences' && <AbsencesTab employees={employees} />}
          {tab === 'register' && <RegisterTab onSaved={loadData} />}
        </div>
      </main>
    </div>
  )
}

// ─── Status Tab ───────────────────────────────────────────────────────────────

function StatusTab({ employees, onSaved }) {
  const [editing, setEditing] = useState(null)
  const [deptFilter, setDeptFilter] = useState('all')

  const departments = useMemo(() => ['all', ...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])
  const filtered = deptFilter === 'all' ? employees : employees.filter(e => e.department === deptFilter)
  const inside  = filtered.filter(e => e.lastEvent?.type === 'checkin')
  const outside = filtered.filter(e => e.lastEvent?.type !== 'checkin')

  if (employees.length === 0) return <EmptyState>Nincs dolgozó regisztrálva</EmptyState>

  return (
    <>
      {departments.length > 2 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', border: `1px solid ${deptFilter === d ? C.accent : C.border}`, background: deptFilter === d ? C.bg2 : 'transparent', color: deptFilter === d ? C.accent : C.muted, cursor: 'pointer' }}>
              {d === 'all' ? 'Mind' : d}
            </button>
          ))}
        </div>
      )}

      <SectionLabel color={C.green}>Bent — {inside.length}</SectionLabel>
      <Table>
        {inside.length === 0
          ? <TableEmpty>Senki nincs bent</TableEmpty>
          : inside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)
        }
      </Table>

      <div style={{ height: '1.25rem' }} />

      <SectionLabel color={C.muted}>Kint — {outside.length}</SectionLabel>
      <Table>
        {outside.length === 0
          ? <TableEmpty>Mindenki bent van</TableEmpty>
          : outside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)
        }
      </Table>

      {editing && <EditModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved() }} />}
    </>
  )
}

function EmpRow({ emp, onEdit }) {
  const isIn = emp.lastEvent?.type === 'checkin'
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ ...S.td, width: 10, paddingRight: 0 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isIn ? C.green : C.border }} />
      </td>
      <td style={{ ...S.td, fontWeight: 700, color: C.text }}>{emp.name}</td>
      <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>{emp.department ?? '—'}</td>
      <td style={S.td}>
        {emp.lastEvent
          ? <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(emp.lastEvent.timestamp)}</Badge>
          : <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
        }
      </td>
      <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>
        {emp.todayMinutes > 0 ? fmtMins(emp.todayMinutes) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button onClick={onEdit} style={S.btnIcon}>✎</button>
      </td>
    </tr>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ employee, onClose, onSaved }) {
  const [name, setName]   = useState(employee.name)
  const [role, setRole]   = useState(employee.role)
  const [dept, setDept]   = useState(employee.department ?? '')
  const [uid, setUid]     = useState(employee.nfc_uid ?? '')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [addType, setAddType]   = useState('checkin')
  const [addTs, setAddTs]       = useState(() => new Date().toISOString().slice(0, 16))
  const [addNote, setAddNote]   = useState('')
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
      <Field label="Megjegyzés"><input value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="pl. Elfelejtett kártya" style={{ ...S.input, marginBottom: '0.5rem' }} /></Field>
      <button onClick={handleAddEvent} disabled={addingEvent} style={{ ...S.btnPrimary, width: '100%', opacity: addingEvent ? 0.6 : 1 }}>
        {addingEvent ? 'Mentés…' : '+ Esemény hozzáadása'}
      </button>
    </Modal>
  )
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab({ events, onSaved }) {
  const [nameFilter, setNameFilter] = useState('all')
  const [sortDir, setSortDir]       = useState('desc')
  const [deleting, setDeleting]     = useState(null)

  const names  = ['all', ...Array.from(new Set(events.map(e => e.name))).sort()]
  const sorted = [...events]
    .filter(e => nameFilter === 'all' || e.name === nameFilter)
    .sort((a, b) => sortDir === 'desc' ? new Date(b.timestamp) - new Date(a.timestamp) : new Date(a.timestamp) - new Date(b.timestamp))

  async function deleteEvent(id) {
    setDeleting(id)
    await supabase.from('events').delete().eq('id', id)
    onSaved(); setDeleting(null)
  }

  function exportCSV() {
    const rows = [['Név', 'Típus', 'Időpont', 'Kézi', 'Megjegyzés'], ...sorted.map(e => [e.name, e.type === 'checkin' ? 'Belépés' : 'Kilépés', new Date(e.timestamp).toLocaleString(), e.is_manual ? 'Igen' : '', e.note ?? ''])]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })), download: `checkin-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nameFilter} onChange={e => setNameFilter(e.target.value)} style={{ ...S.input, width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
          {names.map(n => <option key={n} value={n}>{n === 'all' ? 'Mind' : n}</option>)}
        </select>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>{sorted.length} esemény</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} style={S.btnSecondary}>↓ CSV export</button>
      </div>
      <Table>
        <thead>
          <tr style={{ background: C.bg2 }}>
            <Th>Dolgozó</Th>
            <Th>Típus</Th>
            <Th sortable onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>Időpont {sortDir === 'desc' ? '↓' : '↑'}</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={S.td}>
                <span style={{ fontWeight: 600, color: C.text }}>{e.name}</span>
                {e.is_manual && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: C.accent, border: `1px solid ${C.accent}40`, padding: '0 0.3rem' }}>kézi</span>}
                {e.note && <div style={{ fontSize: '0.72rem', color: C.muted }}>{e.note}</div>}
              </td>
              <td style={S.td}>
                <Badge color={e.type === 'checkin' ? C.green : C.red}>{e.type === 'checkin' ? '↑ Be' : '↓ Ki'}</Badge>
              </td>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                <span style={{ color: C.text }}>{fmtClock(e.timestamp)}</span>
                <span style={{ color: C.muted, marginLeft: '0.5rem', fontSize: '0.72rem' }}>{new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                {e.is_manual && (
                  <button onClick={() => deleteEvent(e.id)} disabled={deleting === e.id} style={{ ...S.btnIcon, color: C.red, borderColor: C.red + '40' }}>
                    {deleting === e.id ? '…' : '✕'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && <TableEmpty colSpan={4}>Nincs esemény</TableEmpty>}
        </tbody>
      </Table>
    </>
  )
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab({ employees }) {
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => { if (employees.length > 0 && !selectedId) setSelectedId(employees[0].id) }, [employees, selectedId])
  if (employees.length === 0) return <EmptyState>Nincs dolgozó</EmptyState>
  const sel = employees.find(e => e.id === selectedId) ?? employees[0]
  const avgShift = sel.todayCheckins > 0 ? Math.floor(sel.todayMinutes / sel.todayCheckins) : 0
  const isIn = sel.lastEvent?.type === 'checkin'

  return (
    <>
      <div style={{ marginBottom: '1.25rem', maxWidth: 360 }}>
        <Field label="Dolgozó">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={S.input}>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: C.border, border: `1px solid ${C.border}`, marginBottom: '1.25rem' }}>
        {[
          { label: 'Ma összesen',       value: fmtMins(sel.todayMinutes), color: C.green },
          { label: 'Mai munkamenetek',  value: String(sel.todayCheckins ?? 0), color: C.accent },
          { label: '7 napos összesen',  value: fmtMins(sel.weekMinutes ?? 0), color: C.text },
          { label: 'Átlag műszak',      value: fmtMins(avgShift),          color: C.text },
        ].map(s => (
          <div key={s.label} style={{ background: C.bg1, padding: '1rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Table>
        {[
          { label: 'Jelenlegi státusz', value: isIn ? 'Bent' : 'Kint', color: isIn ? C.green : C.red },
          { label: 'Első belépés ma',   value: sel.firstInToday ? fmtClock(sel.firstInToday) : '—', color: C.text },
          { label: 'Utolsó kilépés ma', value: sel.lastOutToday ? fmtClock(sel.lastOutToday) : '—', color: C.text },
          { label: 'Események 7 nap',   value: String(sel.weekEvents ?? 0), color: C.text },
        ].map((r, i) => (
          <tr key={r.label} style={{ borderBottom: i < 3 ? `1px solid ${C.border}` : 'none' }}>
            <td style={{ ...S.td, color: C.muted }}>{r.label}</td>
            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: r.color }}>{r.value}</td>
          </tr>
        ))}
      </Table>
    </>
  )
}

// ─── Absences Tab ─────────────────────────────────────────────────────────────

const ABSENCE_LABELS = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }

function AbsencesTab({ employees }) {
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
    supabase.from('absences').select('id, user_id, date, type, note').order('date', { ascending: false }).limit(100).then(({ data }) => setAbsences(data ?? []))
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
          {absences.length === 0
            ? <TableEmpty>Nincs rögzített hiányzás</TableEmpty>
            : absences.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ ...S.td, fontWeight: 600, color: C.text }}>{profileMap[a.user_id]?.name ?? '?'}</td>
                <td style={S.td}><Badge color={a.type === 'unjustified' ? C.red : C.muted}>{ABSENCE_LABELS[a.type]}</Badge></td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.8rem', color: C.muted }}>{a.date}</td>
                <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>{a.note ?? ''}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <button onClick={() => del(a.id)} style={{ ...S.btnIcon, color: C.red, borderColor: C.red + '40' }}>✕</button>
                </td>
              </tr>
            ))
          }
        </Table>
      </div>
    </div>
  )
}

// ─── Register Tab ─────────────────────────────────────────────────────────────

function RegisterTab({ onSaved }) {
  const [uid, setUid]       = useState('')
  const [name, setName]     = useState('')
  const [role, setRole]     = useState('worker')
  const [dept, setDept]     = useState('')
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState(null)
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

// ─── Shared UI components ─────────────────────────────────────────────────────

function Table({ children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  )
}

function Th({ children, sortable, onClick }) {
  return (
    <th onClick={onClick} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: sortable ? 'pointer' : 'default', userSelect: 'none', borderBottom: `1px solid ${C.border}` }}>
      {children}
    </th>
  )
}

function TableEmpty({ children, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan ?? 10} style={{ padding: '1.5rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>{children}</td>
    </tr>
  )
}

function SectionLabel({ children, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <div style={{ width: 3, height: 14, background: color }} />
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
    </div>
  )
}

function Badge({ children, color }) {
  return (
    <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: color + '20', color, border: `1px solid ${color}40` }}>
      {children}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: C.muted, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 0.75rem' }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, width: '100%', maxWidth: 460, maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 3, height: 16, background: C.accent }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: C.text }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
      </div>
    </div>
  )
}

function EmptyState({ children }) {
  return <div style={{ color: C.muted, padding: '3rem', textAlign: 'center', fontSize: '0.9rem', border: `1px solid ${C.border}` }}>{children}</div>
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getDaySummary(userEvents) {
  const today = new Date().toDateString()
  const sorted = userEvents.filter(e => new Date(e.timestamp).toDateString() === today).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let totalMinutes = 0, checkins = 0, lastIn = null, firstIn = null, lastOut = null
  for (const e of sorted) {
    if (e.type === 'checkin') { checkins++; const at = new Date(e.timestamp); if (!firstIn) firstIn = at; lastIn = at }
    else if (e.type === 'checkout') { const at = new Date(e.timestamp); lastOut = at; if (lastIn) { totalMinutes += (at - lastIn) / 60000; lastIn = null } }
  }
  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000
  return { totalMinutes: Math.floor(totalMinutes), checkins, firstIn, lastOut }
}

function calcRangeMinutes(userEvents, days) {
  const cutoff = Date.now() - days * 86400000
  const sorted = userEvents.filter(e => new Date(e.timestamp).getTime() >= cutoff).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let totalMinutes = 0, lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') lastIn = new Date(e.timestamp)
    else if (e.type === 'checkout' && lastIn) { totalMinutes += (new Date(e.timestamp) - lastIn) / 60000; lastIn = null }
  }
  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000
  return Math.max(0, Math.floor(totalMinutes))
}

function countRangeEvents(userEvents, days) {
  return userEvents.filter(e => new Date(e.timestamp).getTime() >= Date.now() - days * 86400000).length
}

function fmtMins(m) {
  if (m < 1) return '—'
  const h = Math.floor(m / 60), min = Math.floor(m % 60)
  return h === 0 ? `${min}m` : min === 0 ? `${h}h` : `${h}h ${min}m`
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg0:    '#1b2838',
  bg1:    '#16202d',
  bg2:    '#2a475e',
  border: '#3d4450',
  text:   '#c6d4df',
  muted:  '#8f98a0',
  accent: '#66c0f4',
  green:  '#5ba32b',
  red:    '#c94f4f',
}

const S = {
  input: { width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.86rem', background: C.bg0, border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box', borderRadius: 0 },
  btnPrimary: { padding: '0.6rem 1.25rem', fontSize: '0.86rem', fontWeight: 700, background: C.accent, color: C.bg0, border: 'none', cursor: 'pointer', borderRadius: 0 },
  btnSecondary: { padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer', borderRadius: 0 },
  btnIcon: { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.78rem', borderRadius: 0 },
  td: { padding: '0.65rem 1rem', fontSize: '0.85rem', color: C.text, background: C.bg1 },
  errorBox: { background: C.red + '15', border: `1px solid ${C.red}40`, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: C.red },
}
