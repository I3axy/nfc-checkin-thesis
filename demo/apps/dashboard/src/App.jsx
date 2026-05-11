import { useState, useEffect, useCallback, useMemo } from 'react'
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
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c18' }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.2rem', color: '#334155', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Initializing…</div>
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
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060c18', position: 'relative', overflow: 'hidden',
      padding: '1rem', boxSizing: 'border-box',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(#0d1e3520 1px, transparent 1px), linear-gradient(90deg, #0d1e3520 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, #1d4ed812 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', width: 'min(400px, 100%)',
        background: '#0d1524', border: '1px solid #1a2d4a',
        borderRadius: 16, padding: 'clamp(1.3rem, 5vw, 2.5rem)',
        boxShadow: '0 24px 80px #000a, 0 0 0 1px #ffffff06',
        animation: 'slide-up 0.4s ease',
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', letterSpacing: '0.25em', color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.5rem' }}>InnoHub</div>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>Control Center</h1>
          <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.4rem' }}>Manager access only</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={F.label}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={F.input} placeholder="you@example.com" />
          </div>
          <div>
            <label style={F.label}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={F.input} placeholder="••••••••" />
          </div>
          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem', color: '#fca5a5' }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            marginTop: '0.4rem', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
            fontFamily: 'Outfit, sans-serif', letterSpacing: '0.02em',
            background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'default' : 'pointer',
            transition: 'opacity 0.2s',
          }}>
            {loading ? 'Authenticating…' : 'Sign In →'}
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
  const [sortDir, setSortDir] = useState('desc')

  const loadData = useCallback(async () => {
    const [{ data: profiles }, { data: allEvents }] = await Promise.all([
      supabase.from('profiles').select('id, name, role').order('name'),
      supabase.from('events').select('id, user_id, type, timestamp').order('timestamp', { ascending: false }).limit(500),
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

  const checkedIn   = employees.filter(e => e.lastEvent?.type === 'checkin').length
  const checkedOut  = employees.length - checkedIn
  const todayStr    = new Date().toDateString()
  const todayEvents = events.filter(e => new Date(e.timestamp).toDateString() === todayStr)
  const todayCI     = todayEvents.filter(e => e.type === 'checkin').length
  const uniqueW     = new Set(todayEvents.map(e => e.user_id)).size
  const totalMins   = employees.reduce((s, e) => s + e.todayMinutes, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#060c18', color: '#e2e8f0' }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#0d1e3510 1px, transparent 1px), linear-gradient(90deg, #0d1e3510 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#060c18ee', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #0d1e35',
        padding: '0.65rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.8rem', minHeight: 56, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e2e8f0' }}>
            Inno<span style={{ color: '#2563eb' }}>Hub</span>
          </div>
          <div style={{ width: 1, height: 18, background: '#1a2d4a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="live-dot" />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: '#10b981', letterSpacing: '0.1em' }}>LIVE</span>
            {lastUpdate && (
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: '#334155' }}>{lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip color="green">{checkedIn} IN</Chip>
          <Chip color="red">{checkedOut} OUT</Chip>
          <button onClick={() => supabase.auth.signOut()} style={{
            padding: '0.3rem 0.8rem', background: 'transparent', border: '1px solid #1a2d4a',
            borderRadius: 6, color: '#475569', cursor: 'pointer', fontSize: '0.8rem',
            fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.2s, color 0.2s',
          }}>Sign out</button>
        </div>
      </header>

      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Currently Inside',   value: checkedIn,          accent: '#10b981' },
            { label: 'Total Employees',    value: employees.length,   accent: '#f59e0b' },
            { label: "Today's Check-ins",  value: todayCI,            accent: '#3b82f6' },
            { label: 'Total Time Today',   value: fmtMins(totalMins), accent: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12,
              padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.accent, opacity: 0.7 }} />
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1, color: s.accent }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.3rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 10, padding: '0.25rem', width: '100%', overflowX: 'auto' }}>
          {[['status', 'Status'], ['insights', 'Insights'], ['log', 'Event Log'], ['register', '+ Register']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.5rem 1rem', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.02em',
              background: tab === key ? '#1a2d4a' : 'transparent',
              color: tab === key ? '#e2e8f0' : '#475569',
              transition: 'all 0.15s', whiteSpace: 'nowrap', flex: '1 0 auto',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'status'   && <StatusTab employees={employees} onSaved={loadData} />}
        {tab === 'insights' && <InsightsTab employees={employees} />}
        {tab === 'log'      && <LogTab events={events} sortDir={sortDir} setSortDir={setSortDir} />}
        {tab === 'register' && <RegisterTab onSaved={loadData} />}
      </div>
    </div>
  )
}

// ─── Status Tab ───────────────────────────────────────────────────────────────

function StatusTab({ employees, onSaved }) {
  const [editing, setEditing] = useState(null)

  if (employees.length === 0) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#334155' }}>No employees found</div>
  )

  const inside  = employees.filter(e => e.lastEvent?.type === 'checkin')
  const outside = employees.filter(e => e.lastEvent?.type !== 'checkin')

  return (
    <>
      {inside.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: '#10b981', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Inside now — {inside.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {inside.map(emp => <EmpCard key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)}
          </div>
        </section>
      )}

      {outside.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569', display: 'inline-block' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Outside — {outside.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {outside.map(emp => <EmpCard key={emp.id} emp={emp} onEdit={() => setEditing(emp)} />)}
          </div>
        </section>
      )}

      {editing && (
        <EditModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onSaved() }}
        />
      )}
    </>
  )
}

function EmpCard({ emp, onEdit }) {
  const isIn = emp.lastEvent?.type === 'checkin'
  const has  = !!emp.lastEvent
  const todayWorked = emp.todayMinutes > 0

  return (
    <div style={{
      background: '#0d1524',
      border: `1px solid ${isIn ? '#10b98130' : '#1a2d4a'}`,
      borderRadius: 12, padding: '1.1rem 1.25rem',
      position: 'relative', overflow: 'hidden',
    }}>
      {isIn && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #10b981, #059669)' }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: '#334155', textTransform: 'uppercase', marginTop: 2 }}>{emp.role}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
          <div style={{
            padding: '0.2rem 0.55rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
            fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em',
            background: has ? (isIn ? '#10b98120' : '#ef444420') : '#1a2d4a',
            color:      has ? (isIn ? '#10b981'   : '#ef4444')   : '#334155',
            border: `1px solid ${has ? (isIn ? '#10b98140' : '#ef444440') : '#1e3a5f'}`,
          }}>
            {has ? (isIn ? 'IN' : 'OUT') : '—'}
          </div>
          <button onClick={onEdit} style={{
            background: 'transparent', border: '1px solid #1a2d4a', borderRadius: 6,
            color: '#475569', cursor: 'pointer', padding: '0.2rem 0.45rem',
            fontSize: '0.72rem', fontFamily: 'Outfit, sans-serif', lineHeight: 1,
          }}>✎</button>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
        {emp.lastEvent && (
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {isIn ? 'Since' : 'Last event'}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: isIn ? '#10b98199' : '#475569', marginTop: 2 }}>
              {new Date(emp.lastEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isIn && (
                <span style={{ color: '#10b98166', marginLeft: '0.35rem' }}>
                  ({fmtMins(Math.floor((Date.now() - new Date(emp.lastEvent.timestamp)) / 60000))})
                </span>
              )}
            </div>
          </div>
        )}
        {todayWorked && (
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: '#8b5cf6', marginTop: 2 }}>{fmtMins(emp.todayMinutes)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ employee, onClose, onSaved }) {
  const [name, setName]   = useState(employee.name)
  const [role, setRole]   = useState(employee.role)
  const [uid, setUid]     = useState(employee.nfc_uid ?? '')
  const [scanning, setScanning] = useState(false)
  const [nfcSupported]    = useState(() => 'NDEFReader' in window)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function scanCard() {
    setScanning(true)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => {
        setUid(serialNumber)
        setScanning(false)
      }, { once: true })
    } catch (err) {
      setScanning(false)
      setError('NFC scan failed: ' + err.message)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), role, nfc_uid: uid.trim() || null })
      .eq('id', employee.id)
    if (error) { setError(error.message); setSaving(false) }
    else onSaved()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000000bb', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 14,
        padding: '1.75rem', width: '100%', maxWidth: 440,
        boxShadow: '0 32px 80px #000c',
        animation: 'slide-up 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
            Edit Worker
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={F.label}>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required style={F.input} />
          </div>
          <div>
            <label style={F.label}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={F.input}>
              <option value="worker">Worker</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label style={F.label}>NFC Card UID</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                value={uid}
                onChange={e => setUid(e.target.value)}
                placeholder={scanning ? 'Waiting for card…' : 'UID or tap Scan'}
                style={{ ...F.input, flex: 1, fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', background: uid ? '#0a1f10' : '#060c18', color: uid ? '#10b981' : '#334155' }}
              />
              {nfcSupported && (
                <button type="button" onClick={scanCard} disabled={scanning} style={{
                  padding: '0 1rem', background: scanning ? '#1a2d4a' : '#1d4ed8', border: 'none',
                  borderRadius: 8, color: '#fff', fontWeight: 600, cursor: scanning ? 'default' : 'pointer',
                  fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', opacity: scanning ? 0.6 : 1,
                }}>
                  {scanning ? '📡…' : '📡'}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem', color: '#fca5a5' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid #1a2d4a',
              borderRadius: 8, color: '#475569', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              flex: 2, padding: '0.75rem', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontWeight: 600, opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab({ events, sortDir, setSortDir }) {
  const [nameFilter, setNameFilter] = useState('all')
  const names = ['all', ...Array.from(new Set(events.map(e => e.name))).sort()]

  const sorted = [...events]
    .filter(e => nameFilter === 'all' || e.name === nameFilter)
    .sort((a, b) => sortDir === 'desc'
      ? new Date(b.timestamp) - new Date(a.timestamp)
      : new Date(a.timestamp) - new Date(b.timestamp)
    )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nameFilter} onChange={e => setNameFilter(e.target.value)} style={{
          ...F.input, width: 'auto', padding: '0.4rem 0.7rem', fontSize: '0.82rem', cursor: 'pointer',
        }}>
          {names.map(n => <option key={n} value={n}>{n === 'all' ? 'All employees' : n}</option>)}
        </select>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: '#334155' }}>
          {sorted.length} events
        </span>
      </div>

      <div style={{ background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a2d4a' }}>
              <th style={T.th}>Employee</th>
              <th style={T.th}>Type</th>
              <th style={{ ...T.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                Time <span style={{ opacity: 0.5 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #0d1e35' }}>
                <td style={T.td}><span style={{ fontWeight: 600 }}>{e.name}</span></td>
                <td style={T.td}>
                  <span style={{
                    fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', fontWeight: 500,
                    padding: '0.2rem 0.6rem', borderRadius: 5,
                    background: e.type === 'checkin' ? '#10b98120' : '#ef444420',
                    color:      e.type === 'checkin' ? '#10b981'   : '#ef4444',
                    border: `1px solid ${e.type === 'checkin' ? '#10b98140' : '#ef444440'}`,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {e.type === 'checkin' ? '↑ IN' : '↓ OUT'}
                  </span>
                </td>
                <td style={{ ...T.td, fontFamily: 'DM Mono, monospace', fontSize: '0.78rem' }}>
                  <span style={{ color: '#e2e8f0' }}>
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#334155', marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                    {new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ color: '#1e3a5f', marginLeft: '0.5rem', fontSize: '0.68rem' }}>
                    {relTime(e.timestamp)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#334155', fontFamily: 'DM Mono, monospace', fontSize: '0.85rem' }}>NO EVENTS YET</div>
        )}
      </div>
    </div>
  )
}

function InsightsTab({ employees }) {
  const [selectedId, setSelectedId] = useState('')
  const [workerQuery, setWorkerQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (employees.length === 0) {
      setSelectedId('')
      setWorkerQuery('')
      return
    }
    if (!selectedId || !employees.some(e => e.id === selectedId)) {
      setSelectedId(employees[0].id)
    }
  }, [employees, selectedId])

  useEffect(() => {
    const selected = employees.find(e => e.id === selectedId)
    if (!selected) return
    setWorkerQuery(workerLabel(selected))
  }, [employees, selectedId])

  if (employees.length === 0) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>No workers to analyze</div>
  }

  const selected = employees.find(e => e.id === selectedId) ?? employees[0]
  const avgShift = selected.todayCheckins > 0 ? Math.floor(selected.todayMinutes / selected.todayCheckins) : 0
  const options = employees.map(emp => ({ id: emp.id, label: workerLabel(emp) }))
  const filteredOptions = useMemo(() => {
    const q = workerQuery.trim().toLowerCase()
    if (!q) return options.slice(0, 3)
    return options.filter(o => o.label.toLowerCase().includes(q)).slice(0, 3)
  }, [options, workerQuery])

  const cards = [
    { label: 'Today total', value: fmtMins(selected.todayMinutes), accent: '#10b981' },
    { label: 'Today sessions', value: String(selected.todayCheckins ?? 0), accent: '#3b82f6' },
    { label: 'Last 7 days', value: fmtMins(selected.weekMinutes ?? 0), accent: '#8b5cf6' },
    { label: 'Avg session', value: fmtMins(avgShift), accent: '#f59e0b' },
  ]

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12, padding: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.5rem', position: 'relative' }}>
          <label style={F.label}>Worker</label>
          <input
            value={workerQuery}
            onChange={e => {
              setWorkerQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            placeholder="Start typing worker name..."
            style={F.input}
          />
          {showSuggestions && filteredOptions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              marginTop: '0.25rem', background: '#060c18', border: '1px solid #1a2d4a',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {filteredOptions.map((o, idx) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setSelectedId(o.id)
                    setWorkerQuery(o.label)
                    setShowSuggestions(false)
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.6rem 0.8rem', background: 'transparent',
                    border: 'none', borderBottom: idx < filteredOptions.length - 1 ? '1px solid #0d1e35' : 'none', color: '#cbd5e1', cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {cards.map(card => (
          <div key={card.label} style={{
            background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12,
            padding: '0.95rem', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.accent, opacity: 0.8 }} />
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, color: card.accent }}>{card.value}</div>
            <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12, padding: '1rem' }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '1.02rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.8rem' }}>
          Shift details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <Metric label="Current status" value={selected.lastEvent?.type === 'checkin' ? 'Inside' : 'Outside'} tone={selected.lastEvent?.type === 'checkin' ? '#10b981' : '#ef4444'} />
          <Metric label="First check-in today" value={selected.firstInToday ? fmtClock(selected.firstInToday) : '—'} />
          <Metric label="Last check-out today" value={selected.lastOutToday ? fmtClock(selected.lastOutToday) : '—'} />
          <Metric label="Events last 7 days" value={String(selected.weekEvents ?? 0)} />
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, tone = '#e2e8f0' }) {
  return (
    <div style={{ background: '#060c18', border: '1px solid #1a2d4a', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
      <div style={{ fontSize: '0.68rem', color: '#334155', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.92rem', color: tone }}>{value}</div>
    </div>
  )
}

// ─── Register Tab ─────────────────────────────────────────────────────────────

function RegisterTab({ onSaved }) {
  const [uid, setUid] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('worker')
  const [scanning, setScanning] = useState(false)
  const [nfcSupported] = useState(() => 'NDEFReader' in window)
  const [status, setStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function scanCard() {
    setScanning(true)
    setStatus(null)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => {
        setUid(serialNumber)
        setScanning(false)
      }, { once: true })
    } catch (err) {
      setScanning(false)
      setErrorMsg('NFC scan failed: ' + err.message)
      setStatus('error')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!uid) { setErrorMsg('Scan a card first'); setStatus('error'); return }
    setStatus('saving')
    setErrorMsg('')
    const { error } = await supabase.from('profiles').insert({ id: crypto.randomUUID(), nfc_uid: uid, name: name.trim(), role })
    if (error) { setErrorMsg(error.message); setStatus('error') }
    else { setStatus('ok'); setUid(''); setName(''); setRole('worker'); onSaved() }
  }

  if (status === 'ok') return (
    <div style={{ background: '#0d1524', border: '1px solid #10b98140', borderRadius: 12, padding: '2.2rem 1.3rem', textAlign: 'center', maxWidth: 480, width: '100%' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>Worker Registered</div>
      <button onClick={() => setStatus(null)} style={{ marginTop: '1.5rem', padding: '0.7rem 2rem', background: '#1a2d4a', border: 'none', borderRadius: 8, color: '#e2e8f0', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
        Register Another
      </button>
    </div>
  )

  return (
    <div style={{ background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: 12, padding: '1.1rem', maxWidth: 520, width: '100%' }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.5rem', color: '#94a3b8' }}>Register New Worker</div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={F.label}>NFC Card UID</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input readOnly value={uid} placeholder={scanning ? 'Waiting for card tap…' : 'Press Scan, then tap card'}
            style={{ ...F.input, flex: 1, fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', background: uid ? '#0a1f10' : '#0a1220', color: uid ? '#10b981' : '#334155' }} />
          {nfcSupported ? (
            <button type="button" onClick={scanCard} disabled={scanning} style={{
              padding: '0 1.1rem', background: scanning ? '#1a2d4a' : '#1d4ed8', border: 'none',
              borderRadius: 8, color: '#fff', fontWeight: 600, cursor: scanning ? 'default' : 'pointer',
              fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', whiteSpace: 'nowrap',
              opacity: scanning ? 0.6 : 1,
            }}>
              {scanning ? '📡 Scanning…' : '📡 Scan'}
            </button>
          ) : (
            <input value={uid} onChange={e => setUid(e.target.value)} placeholder="Enter UID manually"
              style={{ ...F.input, flex: 1, fontFamily: 'DM Mono, monospace' }} />
          )}
        </div>
        {!nfcSupported && <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem' }}>NFC unavailable — Android Chrome required</div>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={F.label}>Full Name</label>
          <input type="text" placeholder="e.g. Kovács Péter" value={name} onChange={e => setName(e.target.value)} required style={F.input} />
        </div>
        <div>
          <label style={F.label}>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={F.input}>
            <option value="worker">Worker</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        {status === 'error' && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem', color: '#fca5a5' }}>{errorMsg}</div>
        )}
        <button type="submit" disabled={status === 'saving'} style={{
          padding: '0.85rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
          background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', border: 'none',
          borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: '0.95rem',
          opacity: status === 'saving' ? 0.6 : 1,
        }}>
          {status === 'saving' ? 'Registering…' : 'Register Worker →'}
        </button>
      </form>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Chip({ color, children }) {
  const c = { green: ['#10b98120', '#10b98150', '#10b981'], red: ['#ef444420', '#ef444450', '#ef4444'] }[color]
  return (
    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.08em',
      background: c[0], border: `1px solid ${c[1]}`, color: c[2], padding: '0.2rem 0.6rem', borderRadius: 6 }}>
      {children}
    </span>
  )
}

// ─── Utility functions ────────────────────────────────────────────────────────

function calcTodayMinutes(userEvents) {
  const today = new Date().toDateString()
  const sorted = userEvents
    .filter(e => new Date(e.timestamp).toDateString() === today)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let mins = 0
  let lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') {
      lastIn = new Date(e.timestamp)
    } else if (e.type === 'checkout' && lastIn) {
      mins += (new Date(e.timestamp) - lastIn) / 60000
      lastIn = null
    }
  }
  if (lastIn) mins += (Date.now() - lastIn) / 60000
  return Math.floor(mins)
}

function getDaySummary(userEvents) {
  const today = new Date().toDateString()
  const sorted = userEvents
    .filter(e => new Date(e.timestamp).toDateString() === today)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  let totalMinutes = 0
  let checkins = 0
  let lastIn = null
  let firstIn = null
  let lastOut = null

  for (const e of sorted) {
    if (e.type === 'checkin') {
      checkins += 1
      const at = new Date(e.timestamp)
      if (!firstIn) firstIn = at
      lastIn = at
    } else if (e.type === 'checkout') {
      const at = new Date(e.timestamp)
      lastOut = at
      if (lastIn) {
        totalMinutes += (at - lastIn) / 60000
        lastIn = null
      }
    }
  }

  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000

  return {
    totalMinutes: Math.floor(totalMinutes),
    checkins,
    firstIn,
    lastOut,
  }
}

function calcRangeMinutes(userEvents, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const sorted = userEvents
    .filter(e => new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  let totalMinutes = 0
  let lastIn = null

  for (const e of sorted) {
    if (e.type === 'checkin') {
      lastIn = new Date(e.timestamp)
    } else if (e.type === 'checkout' && lastIn) {
      totalMinutes += (new Date(e.timestamp) - lastIn) / 60000
      lastIn = null
    }
  }

  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000
  return Math.max(0, Math.floor(totalMinutes))
}

function countRangeEvents(userEvents, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return userEvents.filter(e => new Date(e.timestamp).getTime() >= cutoff).length
}

function fmtMins(m) {
  if (m < 1) return '—'
  const h = Math.floor(m / 60)
  const min = Math.floor(m % 60)
  if (h === 0) return `${min}m`
  return min === 0 ? `${h}h` : `${h}h ${min}m`
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function workerLabel(emp) {
  return `${emp.name} (${emp.role})`
}

function relTime(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const F = {
  label: { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.1em' },
  input: {
    width: '100%', padding: '0.7rem 0.9rem', fontSize: '0.9rem',
    background: '#060c18', border: '1px solid #1a2d4a', borderRadius: 8,
    color: '#e2e8f0', fontFamily: 'Outfit, sans-serif', outline: 'none',
    boxSizing: 'border-box',
  },
}

const T = {
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Outfit, sans-serif' },
  td: { padding: '0.8rem 1rem', fontSize: '0.88rem', color: '#94a3b8' },
}
