import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1b2838' }}>
      <div style={{ fontSize: '0.9rem', color: '#8f98a0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Initializing…</div>
    </div>
  )

  return session ? <Dashboard /> : <Login />
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1b2838', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ width: 'min(380px, 100%)', background: '#16202d', border: '1px solid #3d4450', padding: 'clamp(1.5rem, 5vw, 2.5rem)' }}>
        <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#66c0f4', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.3rem' }}>NFC Check-in</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c6d4df' }}>Manager Dashboard</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={F.label}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={F.input} placeholder="you@example.com" />
          </div>
          <div>
            <label style={F.label}>Jelszó</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={F.input} placeholder="••••••••" />
          </div>
          {error && <div style={F.error}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...F.btn, marginTop: '0.4rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Bejelentkezés…' : 'Bejelentkezés →'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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
    for (const e of allEvents ?? []) {
      if (!latestEvent[e.user_id]) latestEvent[e.user_id] = e
    }
    const profileMap = {}
    for (const p of profiles ?? []) profileMap[p.id] = p
    const eventsByUser = {}
    for (const e of allEvents ?? []) {
      if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
      eventsByUser[e.user_id].push(e)
    }
    setEmployees((profiles ?? []).map(p => {
      const userEvents = eventsByUser[p.id] ?? []
      const today = getDaySummary(userEvents)
      return {
        ...p,
        lastEvent: latestEvent[p.id] ?? null,
        todayMinutes: today.totalMinutes,
        todayCheckins: today.checkins,
        firstInToday: today.firstIn,
        lastOutToday: today.lastOut,
        weekMinutes: calcRangeMinutes(userEvents, 7),
        weekEvents: countRangeEvents(userEvents, 7),
      }
    }))
    setEvents((allEvents ?? []).map(e => ({ ...e, name: profileMap[e.user_id]?.name ?? 'Unknown' })))
  }, [])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => {
        loadData()
        setLastUpdate(new Date())
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  const checkedIn  = employees.filter(e => e.lastEvent?.type === 'checkin').length
  const todayStr   = new Date().toDateString()
  const todayCI    = events.filter(e => new Date(e.timestamp).toDateString() === todayStr && e.type === 'checkin').length
  const totalMins  = employees.reduce((s, e) => s + e.todayMinutes, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#1b2838', color: '#c6d4df', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#16202d', borderBottom: '1px solid #3d4450', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem', height: 52, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#c6d4df', borderRight: '1px solid #3d4450', paddingRight: '1rem' }}>
          NFC <span style={{ color: '#66c0f4' }}>Check-in</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5ba32b', display: 'inline-block' }} />
          <span style={{ fontSize: '0.7rem', color: '#5ba32b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
          {lastUpdate && <span style={{ fontSize: '0.65rem', color: '#4c6b22' }}>{lastUpdate.toLocaleTimeString()}</span>}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.72rem', color: '#5ba32b', background: '#5ba32b18', border: '1px solid #5ba32b40', padding: '0.2rem 0.6rem' }}>{checkedIn} bent</span>
        <span style={{ fontSize: '0.72rem', color: '#8f98a0', background: '#2a475e', border: '1px solid #3d4450', padding: '0.2rem 0.6rem' }}>{employees.length - checkedIn} kint</span>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: '1px solid #3d4450', color: '#8f98a0', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.7rem' }}>
          Kilépés
        </button>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '1rem' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: '#3d4450', border: '1px solid #3d4450', marginBottom: '1rem' }}>
          {[
            { label: 'Bent most', value: checkedIn, color: '#5ba32b' },
            { label: 'Összes dolgozó', value: employees.length, color: '#c6d4df' },
            { label: 'Mai belépések', value: todayCI, color: '#66c0f4' },
            { label: 'Mai összes idő', value: fmtMins(totalMins), color: '#c6d4df' },
          ].map(s => (
            <div key={s.label} style={{ background: '#16202d', padding: '0.9rem 1.1rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#8f98a0', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #3d4450', marginBottom: '1rem' }}>
          {[['status', 'Státusz'], ['log', 'Napló'], ['insights', 'Statisztika'], ['absences', 'Hiányzások'], ['register', '+ Regisztráció']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.6rem 1rem', border: 'none', borderBottom: tab === key ? '2px solid #66c0f4' : '2px solid transparent',
              background: 'transparent', color: tab === key ? '#66c0f4' : '#8f98a0', cursor: 'pointer',
              fontWeight: tab === key ? 700 : 400, fontSize: '0.85rem', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'status'    && <StatusTab employees={employees} onSaved={loadData} />}
        {tab === 'log'       && <LogTab events={events} employees={employees} onSaved={loadData} />}
        {tab === 'insights'  && <InsightsTab employees={employees} />}
        {tab === 'absences'  && <AbsencesTab employees={employees} />}
        {tab === 'register'  && <RegisterTab onSaved={loadData} />}
      </div>
    </div>
  )
}

// ─── Status Tab ───────────────────────────────────────────────────────────────

function StatusTab({ employees, onSaved }) {
  const [editing, setEditing] = useState(null)
  const [deptFilter, setDeptFilter] = useState('all')

  const departments = useMemo(() => {
    const d = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()
    return ['all', ...d]
  }, [employees])

  const filtered = deptFilter === 'all' ? employees : employees.filter(e => e.department === deptFilter)
  const inside  = filtered.filter(e => e.lastEvent?.type === 'checkin')
  const outside = filtered.filter(e => e.lastEvent?.type !== 'checkin')

  if (employees.length === 0) return <Empty>Nincs dolgozó</Empty>

  return (
    <>
      {departments.length > 1 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{
              padding: '0.3rem 0.8rem', fontSize: '0.78rem', border: '1px solid ' + (deptFilter === d ? '#66c0f4' : '#3d4450'),
              background: deptFilter === d ? '#2a475e' : 'transparent', color: deptFilter === d ? '#66c0f4' : '#8f98a0',
              cursor: 'pointer',
            }}>
              {d === 'all' ? 'Mind' : d}
            </button>
          ))}
        </div>
      )}

      <SectionHeader label={`Bent — ${inside.length}`} color="#5ba32b" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1px', background: '#3d4450', border: '1px solid #3d4450', marginBottom: '1rem' }}>
        {inside.length === 0
          ? <div style={{ background: '#16202d', padding: '1rem', color: '#4c6b22', fontSize: '0.85rem' }}>Senki nincs bent</div>
          : inside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)
        }
      </div>

      <SectionHeader label={`Kint — ${outside.length}`} color="#8f98a0" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1px', background: '#3d4450', border: '1px solid #3d4450' }}>
        {outside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)}
      </div>

      {editing && (
        <EditModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved() }} />
      )}
    </>
  )
}

function EmpRow({ emp, onEdit }) {
  const isIn = emp.lastEvent?.type === 'checkin'
  return (
    <div style={{ background: '#16202d', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: isIn ? '#5ba32b' : '#3d4450', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c6d4df', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
        <div style={{ fontSize: '0.72rem', color: '#8f98a0' }}>
          {emp.department && <span>{emp.department} · </span>}
          {emp.lastEvent
            ? <span style={{ color: isIn ? '#5ba32b' : '#c94f4f' }}>
                {isIn ? 'Be ' : 'Ki '}{fmtClock(emp.lastEvent.timestamp)}
              </span>
            : <span>Még nem volt</span>
          }
          {isIn && emp.todayMinutes > 0 && <span style={{ color: '#8f98a0' }}> · {fmtMins(emp.todayMinutes)}</span>}
        </div>
      </div>
      <button onClick={onEdit} style={{ background: 'transparent', border: '1px solid #3d4450', color: '#8f98a0', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>✎</button>
    </div>
  )
}

// ─── Edit Modal (profil + kézi event) ─────────────────────────────────────────

function EditModal({ employee, onClose, onSaved }) {
  const [name, setName]         = useState(employee.name)
  const [role, setRole]         = useState(employee.role)
  const [dept, setDept]         = useState(employee.department ?? '')
  const [uid, setUid]           = useState(employee.nfc_uid ?? '')
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  // manual event
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
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), role, department: dept.trim() || null, nfc_uid: uid.trim() || null })
      .eq('id', employee.id)
    if (error) { setError(error.message); setSaving(false) }
    else onSaved()
  }

  async function handleAddEvent() {
    setAddingEvent(true)
    setError('')
    const { error } = await supabase.from('events').insert({
      user_id: employee.id,
      type: addType,
      timestamp: new Date(addTs).toISOString(),
      is_manual: true,
      note: addNote.trim() || null,
    })
    if (error) { setError(error.message) }
    else { setAddNote(''); onSaved() }
    setAddingEvent(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#16202d', border: '1px solid #3d4450', padding: '1.5rem', width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.6rem', fontWeight: 700, color: '#c6d4df' }}>Szerkesztés — {employee.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8f98a0', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={F.label}>Név</label>
            <input value={name} onChange={e => setName(e.target.value)} required style={F.input} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={F.label}>Szerepkör</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={F.input}>
                <option value="worker">Worker</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={F.label}>Részleg</label>
              <input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={F.input} />
            </div>
          </div>
          <div>
            <label style={F.label}>NFC kártya UID</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={uid} onChange={e => setUid(e.target.value)} placeholder="UID" style={{ ...F.input, flex: 1, fontFamily: 'monospace', fontSize: '0.82rem' }} />
              {nfcSupported && (
                <button type="button" onClick={scanCard} disabled={scanning} style={{ ...F.btn, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>
                  {scanning ? '📡…' : '📡'}
                </button>
              )}
            </div>
          </div>
          {error && <div style={F.error}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ ...F.btnSecondary, flex: 1 }}>Mégse</button>
            <button type="submit" disabled={saving} style={{ ...F.btn, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Mentés…' : 'Mentés'}</button>
          </div>
        </form>

        {/* Manual event add */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #3d4450' }}>
          <div style={{ fontSize: '0.72rem', color: '#8f98a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Kézi esemény hozzáadása</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={F.label}>Típus</label>
              <select value={addType} onChange={e => setAddType(e.target.value)} style={F.input}>
                <option value="checkin">Belépés</option>
                <option value="checkout">Kilépés</option>
              </select>
            </div>
            <div>
              <label style={F.label}>Időpont</label>
              <input type="datetime-local" value={addTs} onChange={e => setAddTs(e.target.value)} style={F.input} />
            </div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={F.label}>Megjegyzés</label>
            <input value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="pl. Elfelejtett kártya" style={F.input} />
          </div>
          <button onClick={handleAddEvent} disabled={addingEvent} style={{ ...F.btn, width: '100%', opacity: addingEvent ? 0.6 : 1 }}>
            {addingEvent ? 'Mentés…' : '+ Esemény hozzáadása'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab({ events, employees, onSaved }) {
  const [nameFilter, setNameFilter] = useState('all')
  const [sortDir, setSortDir] = useState('desc')
  const [deleting, setDeleting] = useState(null)

  const names = ['all', ...Array.from(new Set(events.map(e => e.name))).sort()]
  const sorted = [...events]
    .filter(e => nameFilter === 'all' || e.name === nameFilter)
    .sort((a, b) => sortDir === 'desc'
      ? new Date(b.timestamp) - new Date(a.timestamp)
      : new Date(a.timestamp) - new Date(b.timestamp)
    )

  async function deleteEvent(id) {
    setDeleting(id)
    await supabase.from('events').delete().eq('id', id)
    onSaved()
    setDeleting(null)
  }

  function exportCSV() {
    const rows = [['Név', 'Típus', 'Időpont', 'Kézi', 'Megjegyzés']]
    for (const e of sorted) {
      rows.push([e.name, e.type === 'checkin' ? 'Belépés' : 'Kilépés', new Date(e.timestamp).toLocaleString(), e.is_manual ? 'Igen' : '', e.note ?? ''])
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checkin-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nameFilter} onChange={e => setNameFilter(e.target.value)} style={{ ...F.input, width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}>
          {names.map(n => <option key={n} value={n}>{n === 'all' ? 'Mind' : n}</option>)}
        </select>
        <span style={{ fontSize: '0.72rem', color: '#8f98a0' }}>{sorted.length} esemény</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} style={F.btnSecondary}>↓ CSV export</button>
      </div>

      <div style={{ border: '1px solid #3d4450', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#16202d', borderBottom: '1px solid #3d4450' }}>
              <th style={T.th}>Dolgozó</th>
              <th style={T.th}>Típus</th>
              <th style={{ ...T.th, cursor: 'pointer' }} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                Időpont {sortDir === 'desc' ? '↓' : '↑'}
              </th>
              <th style={T.th}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #2a475e' }}>
                <td style={T.td}>
                  <span style={{ fontWeight: 600, color: '#c6d4df' }}>{e.name}</span>
                  {e.is_manual && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: '#66c0f4', border: '1px solid #66c0f440', padding: '0 0.3rem' }}>kézi</span>}
                  {e.note && <div style={{ fontSize: '0.72rem', color: '#8f98a0' }}>{e.note}</div>}
                </td>
                <td style={T.td}>
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: e.type === 'checkin' ? '#5ba32b20' : '#c94f4f20', color: e.type === 'checkin' ? '#5ba32b' : '#c94f4f', border: `1px solid ${e.type === 'checkin' ? '#5ba32b40' : '#c94f4f40'}` }}>
                    {e.type === 'checkin' ? '↑ Be' : '↓ Ki'}
                  </span>
                </td>
                <td style={{ ...T.td, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  <span style={{ color: '#c6d4df' }}>{fmtClock(e.timestamp)}</span>
                  <span style={{ color: '#8f98a0', marginLeft: '0.5rem', fontSize: '0.72rem' }}>{new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </td>
                <td style={T.td}>
                  {e.is_manual && (
                    <button
                      onClick={() => deleteEvent(e.id)}
                      disabled={deleting === e.id}
                      style={{ background: 'transparent', border: '1px solid #c94f4f40', color: '#c94f4f', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      {deleting === e.id ? '…' : '✕'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#4c6b22', fontSize: '0.85rem' }}>Nincs esemény</div>}
      </div>
    </div>
  )
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab({ employees }) {
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (employees.length > 0 && !selectedId) setSelectedId(employees[0].id)
  }, [employees, selectedId])

  if (employees.length === 0) return <Empty>Nincs dolgozó</Empty>

  const selected = employees.find(e => e.id === selectedId) ?? employees[0]
  const avgShift = selected.todayCheckins > 0 ? Math.floor(selected.todayMinutes / selected.todayCheckins) : 0

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.75rem' }}>
        <label style={F.label}>Dolgozó</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...F.input, maxWidth: 320 }}>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1px', background: '#3d4450', border: '1px solid #3d4450' }}>
        {[
          { label: 'Ma összesen', value: fmtMins(selected.todayMinutes), color: '#5ba32b' },
          { label: 'Mai munkamenetek', value: String(selected.todayCheckins ?? 0), color: '#66c0f4' },
          { label: '7 napos összesen', value: fmtMins(selected.weekMinutes ?? 0), color: '#c6d4df' },
          { label: 'Átlag műszak', value: fmtMins(avgShift), color: '#c6d4df' },
        ].map(s => (
          <div key={s.label} style={{ background: '#16202d', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#8f98a0', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #3d4450' }}>
        {[
          { label: 'Jelenlegi státusz', value: selected.lastEvent?.type === 'checkin' ? 'Bent' : 'Kint', color: selected.lastEvent?.type === 'checkin' ? '#5ba32b' : '#c94f4f' },
          { label: 'Első belépés ma', value: selected.firstInToday ? fmtClock(selected.firstInToday) : '—', color: '#c6d4df' },
          { label: 'Utolsó kilépés ma', value: selected.lastOutToday ? fmtClock(selected.lastOutToday) : '—', color: '#c6d4df' },
          { label: 'Események 7 nap', value: String(selected.weekEvents ?? 0), color: '#c6d4df' },
        ].map((m, i) => (
          <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 1rem', background: '#16202d', borderBottom: i < 3 ? '1px solid #2a475e' : 'none' }}>
            <span style={{ fontSize: '0.82rem', color: '#8f98a0' }}>{m.label}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Absences Tab ─────────────────────────────────────────────────────────────

function AbsencesTab({ employees }) {
  const [absences, setAbsences] = useState([])
  const [userId, setUserId]     = useState('')
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType]         = useState('vacation')
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const workers = employees.filter(e => e.role === 'worker')

  useEffect(() => {
    if (workers.length > 0 && !userId) setUserId(workers[0].id)
  }, [workers, userId])

  useEffect(() => {
    supabase.from('absences')
      .select('id, user_id, date, type, note, created_at')
      .order('date', { ascending: false })
      .limit(100)
      .then(({ data }) => setAbsences(data ?? []))
  }, [saving])

  const profileMap = Object.fromEntries(employees.map(e => [e.id, e]))

  const typeLabel = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('absences').insert({ user_id: userId, date, type, note: note.trim() || null })
    if (error) setError(error.message)
    else { setNote('') }
    setSaving(false)
  }

  async function deleteAbsence(id) {
    await supabase.from('absences').delete().eq('id', id)
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
      {/* Form */}
      <div>
        <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.75rem', fontWeight: 700, color: '#c6d4df', marginBottom: '1rem' }}>Hiányzás rögzítése</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={F.label}>Dolgozó</label>
            <select value={userId} onChange={e => setUserId(e.target.value)} style={F.input}>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={F.label}>Dátum</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={F.input} />
            </div>
            <div>
              <label style={F.label}>Típus</label>
              <select value={type} onChange={e => setType(e.target.value)} style={F.input}>
                {Object.entries(typeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={F.label}>Megjegyzés</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Opcionális" style={F.input} />
          </div>
          {error && <div style={F.error}>{error}</div>}
          <button type="submit" disabled={saving} style={{ ...F.btn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Mentés…' : '+ Rögzítés'}</button>
        </form>
      </div>

      {/* List */}
      <div>
        <div style={{ borderLeft: '3px solid #3d4450', paddingLeft: '0.75rem', fontWeight: 700, color: '#c6d4df', marginBottom: '1rem' }}>Rögzített hiányzások</div>
        {absences.length === 0
          ? <Empty>Nincs rögzített hiányzás</Empty>
          : absences.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', borderBottom: '1px solid #2a475e', background: '#16202d' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#c6d4df' }}>{profileMap[a.user_id]?.name ?? '?'}</div>
                <div style={{ fontSize: '0.72rem', color: '#8f98a0' }}>
                  {a.date} · <span style={{ color: a.type === 'unjustified' ? '#c94f4f' : '#8f98a0' }}>{typeLabel[a.type]}</span>
                  {a.note && ` · ${a.note}`}
                </div>
              </div>
              <button onClick={() => deleteAbsence(a.id)} style={{ background: 'transparent', border: '1px solid #c94f4f40', color: '#c94f4f', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>✕</button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── Register Tab ─────────────────────────────────────────────────────────────

function RegisterTab({ onSaved }) {
  const [uid, setUid]           = useState('')
  const [name, setName]         = useState('')
  const [role, setRole]         = useState('worker')
  const [dept, setDept]         = useState('')
  const [scanning, setScanning] = useState(false)
  const [status, setStatus]     = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const nfcSupported = 'NDEFReader' in window

  async function scanCard() {
    setScanning(true)
    setStatus(null)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => { setUid(serialNumber); setScanning(false) }, { once: true })
    } catch (err) { setScanning(false); setErrorMsg('NFC scan failed: ' + err.message); setStatus('error') }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!uid) { setErrorMsg('Először olvass be egy kártyát'); setStatus('error'); return }
    setStatus('saving')
    setErrorMsg('')
    // NOTE: profiles.id is a FK to auth.users — in production use a register Edge Function
    // that creates both the auth user and the profile. For demo, we insert with random UUID.
    const { error } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      nfc_uid: uid,
      name: name.trim(),
      role,
      department: dept.trim() || null,
    })
    if (error) { setErrorMsg(error.message); setStatus('error') }
    else { setStatus('ok'); setUid(''); setName(''); setRole('worker'); setDept(''); onSaved() }
  }

  if (status === 'ok') return (
    <div style={{ border: '1px solid #5ba32b40', background: '#16202d', padding: '2rem', textAlign: 'center', maxWidth: 480 }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
      <div style={{ fontWeight: 700, color: '#5ba32b', fontSize: '1.1rem' }}>Dolgozó regisztrálva</div>
      <button onClick={() => setStatus(null)} style={{ ...F.btn, marginTop: '1rem', width: 'auto', padding: '0.6rem 1.5rem' }}>Újabb regisztráció</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.75rem', fontWeight: 700, color: '#c6d4df', marginBottom: '1.25rem' }}>Új dolgozó regisztrálása</div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={F.label}>NFC kártya UID</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input readOnly value={uid} placeholder={scanning ? 'Várj, tartsd a kártyát…' : 'Nyomj Scan-t, aztán tartsd a kártyát'}
            style={{ ...F.input, flex: 1, fontFamily: 'monospace', fontSize: '0.82rem' }} />
          {nfcSupported
            ? <button type="button" onClick={scanCard} disabled={scanning} style={{ ...F.btn, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>📡</button>
            : <input value={uid} onChange={e => setUid(e.target.value)} placeholder="Kézi UID bevitel" style={{ ...F.input, flex: 1, fontFamily: 'monospace' }} />
          }
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div>
          <label style={F.label}>Teljes név</label>
          <input type="text" placeholder="pl. Kovács Péter" value={name} onChange={e => setName(e.target.value)} required style={F.input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={F.label}>Szerepkör</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={F.input}>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label style={F.label}>Részleg</label>
            <input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={F.input} />
          </div>
        </div>
        {status === 'error' && <div style={F.error}>{errorMsg}</div>}
        <button type="submit" disabled={status === 'saving'} style={{ ...F.btn, opacity: status === 'saving' ? 0.6 : 1 }}>
          {status === 'saving' ? 'Regisztrálás…' : 'Regisztrálás →'}
        </button>
      </form>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function SectionHeader({ label, color }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: '0.6rem', fontSize: '0.72rem', color, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.4rem' }}>
      {label}
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ color: '#4c6b22', padding: '2rem', textAlign: 'center', fontSize: '0.85rem', border: '1px solid #2a475e' }}>{children}</div>
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getDaySummary(userEvents) {
  const today = new Date().toDateString()
  const sorted = userEvents.filter(e => new Date(e.timestamp).toDateString() === today).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let totalMinutes = 0, checkins = 0, lastIn = null, firstIn = null, lastOut = null
  for (const e of sorted) {
    if (e.type === 'checkin') {
      checkins++
      const at = new Date(e.timestamp)
      if (!firstIn) firstIn = at
      lastIn = at
    } else if (e.type === 'checkout') {
      const at = new Date(e.timestamp)
      lastOut = at
      if (lastIn) { totalMinutes += (at - lastIn) / 60000; lastIn = null }
    }
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
  const cutoff = Date.now() - days * 86400000
  return userEvents.filter(e => new Date(e.timestamp).getTime() >= cutoff).length
}

function fmtMins(m) {
  if (m < 1) return '—'
  const h = Math.floor(m / 60), min = Math.floor(m % 60)
  if (h === 0) return `${min}m`
  return min === 0 ? `${h}h` : `${h}h ${min}m`
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const F = {
  label: { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#8f98a0', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' },
  input: { width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.88rem', background: '#16202d', border: '1px solid #3d4450', color: '#c6d4df', outline: 'none', boxSizing: 'border-box', borderRadius: '2px' },
  btn: { padding: '0.7rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, background: '#66c0f4', color: '#1b2838', border: 'none', cursor: 'pointer', borderRadius: '2px' },
  btnSecondary: { padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 600, background: 'transparent', color: '#8f98a0', border: '1px solid #3d4450', cursor: 'pointer', borderRadius: '2px' },
  error: { background: '#c94f4f18', border: '1px solid #c94f4f40', padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#c94f4f' },
}

const T = {
  th: { padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#8f98a0', textTransform: 'uppercase', letterSpacing: '0.1em' },
  td: { padding: '0.7rem 1rem', fontSize: '0.85rem', color: '#c6d4df' },
}
