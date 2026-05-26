import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { C, S } from './lib/theme'
import { loadSettings, saveSettings } from './lib/settings'
import { getDaySummary, calcRangeMinutes, countRangeEvents, fmtMins } from './lib/utils'
import { Field } from './components/ui'
import { StatusTab }   from './tabs/StatusTab'
import { LogTab }      from './tabs/LogTab'
import { InsightsTab } from './tabs/InsightsTab'
import { AbsencesTab } from './tabs/AbsencesTab'
import { RegisterTab } from './tabs/RegisterTab'
import { SettingsTab } from './tabs/SettingsTab'

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

function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text }}>NFC <span style={{ color: C.accent }}>Check-in</span></div>
          <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '0.3rem' }}>Manager Dashboard</div>
        </div>
        <div style={{ background: C.bg1, border: `1px solid ${C.border}` }}>
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

const NAV_ITEMS = [
  { key: 'status',   label: 'Státusz' },
  { key: 'log',      label: 'Napló' },
  { key: 'insights', label: 'Statisztika' },
  { key: 'absences', label: 'Hiányzások' },
  { key: 'register', label: 'Regisztráció' },
  { key: 'settings', label: 'Beállítások' },
]

function Dashboard() {
  const [employees, setEmployees]   = useState([])
  const [events, setEvents]         = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [tab, setTab]               = useState('status')
  const [settings, setSettings]     = useState(loadSettings)

  const loadData = useCallback(async () => {
    const [{ data: profiles }, { data: allEvents }] = await Promise.all([
      supabase.from('profiles').select('id, name, role, department, nfc_uid').order('name'),
      supabase.from('events').select('id, user_id, type, timestamp, is_manual, note').order('timestamp', { ascending: false }).limit(500),
    ])
    const latestEvent  = {}
    const eventsByUser = {}
    for (const e of allEvents ?? []) {
      if (!latestEvent[e.user_id]) latestEvent[e.user_id] = e
      if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
      eventsByUser[e.user_id].push(e)
    }
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setEmployees((profiles ?? []).map(p => {
      const ue    = eventsByUser[p.id] ?? []
      const today = getDaySummary(ue)
      return { ...p, lastEvent: latestEvent[p.id] ?? null, todayMinutes: today.totalMinutes, todayCheckins: today.checkins, firstInToday: today.firstIn, lastOutToday: today.lastOut, weekMinutes: calcRangeMinutes(ue, 7), weekEvents: countRangeEvents(ue, 7) }
    }))
    setEvents((allEvents ?? []).map(e => ({ ...e, name: profileMap[e.user_id]?.name ?? 'Ismeretlen' })))
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => { loadData(); setLastUpdate(new Date()) })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const checkedIn = employees.filter(e => e.lastEvent?.type === 'checkin').length
  const todayCI   = events.filter(e => new Date(e.timestamp).toDateString() === new Date().toDateString() && e.type === 'checkin').length
  const totalMins = employees.reduce((s, e) => s + e.todayMinutes, 0)

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: C.bg0, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{ width: 220, flexShrink: 0, background: C.bg1, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.1rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text }}>NFC <span style={{ color: C.accent }}>Check-in</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
            <span style={{ fontSize: '0.65rem', color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
            {lastUpdate && <span style={{ fontSize: '0.6rem', color: C.muted }}>{lastUpdate.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          {[
            ['Bent most',      String(checkedIn),        C.green],
            ['Összes dolgozó', String(employees.length), C.text],
            ['Mai belépések',  String(todayCI),          C.accent],
            ['Mai összes idő', fmtMins(totalMins),       C.text],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', color: C.muted }}>{label}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>

        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {NAV_ITEMS.map(n => (
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

        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => supabase.auth.signOut()} style={{ ...S.btnSecondary, width: '100%', fontSize: '0.78rem' }}>
            Kilépés
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 3, height: 16, background: C.accent }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{NAV_ITEMS.find(n => n.key === tab)?.label}</span>
        </div>

        <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
          {tab === 'status'   && <StatusTab   employees={employees} onSaved={loadData} settings={settings} />}
          {tab === 'log'      && <LogTab      events={events} onSaved={loadData} />}
          {tab === 'insights' && <InsightsTab employees={employees} events={events} />}
          {tab === 'absences' && <AbsencesTab employees={employees} />}
          {tab === 'register' && <RegisterTab onSaved={loadData} />}
          {tab === 'settings' && <SettingsTab settings={settings} onSave={s => { saveSettings(s); setSettings(s) }} />}
        </div>
      </main>
    </div>
  )
}
