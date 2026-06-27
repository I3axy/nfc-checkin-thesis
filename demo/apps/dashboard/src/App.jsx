import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { C, S } from './lib/theme'
import { DEFAULT_SETTINGS, loadTheme, companyToSettings } from './lib/settings'
import { getDaySummary, calcRangeMinutes, countRangeEvents } from './lib/utils'
import { Field } from './components/ui'
import { WorkersTab }  from './tabs/WorkersTab'
import { StatusTab }   from './tabs/StatusTab'
import { LogTab }      from './tabs/LogTab'
import { InsightsTab } from './tabs/InsightsTab'
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
  { key: 'status',   label: 'Státusz',      short: 'S'  },
  { key: 'workers',  label: 'Munkások',     short: 'M'  },
  { key: 'log',      label: 'Napló',        short: 'N'  },
  { key: 'insights', label: 'Statisztika',  short: 'St' },
  { key: 'register', label: 'Regisztráció', short: 'R'  },
  { key: 'settings', label: 'Beállítások',  short: 'B'  },
]

function Dashboard() {
  const [employees, setEmployees]   = useState([])
  const [events, setEvents]         = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [tab, setTab]               = useState('status')
  const [settings, setSettings]     = useState(() => ({ ...DEFAULT_SETTINGS, theme: loadTheme() }))
  const [me, setMe]                 = useState(null)
  const [collapsed, setCollapsed]   = useState(() => localStorage.getItem('nfc_nav_collapsed') === '1')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('id, company_id, role, name').eq('auth_user_id', user.id).maybeSingle()
        .then(({ data: profile }) => {
          setMe(profile)
          if (!profile?.company_id) return
          supabase.from('companies').select('*').eq('id', profile.company_id).maybeSingle()
            .then(({ data: company }) => { if (company) setSettings(s => ({ ...s, ...companyToSettings(company) })) })
        })
    })
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      localStorage.setItem('nfc_nav_collapsed', prev ? '0' : '1')
      return !prev
    })
  }

  useEffect(() => {
    if (tab === 'workers') {
      setCollapsed(true)
      localStorage.setItem('nfc_nav_collapsed', '1')
    }
  }, [tab])

  const loadData = useCallback(async () => {
    const [{ data: profiles }, { data: allEvents }] = await Promise.all([
      supabase.from('profiles').select('id, company_id, name, role, department, nfc_uid').order('name'),
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

  return (
    <div style={{ height: '100dvh', display: 'flex', background: C.bg0, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <aside style={{
        width: collapsed ? 48 : 220,
        flexShrink: 0,
        background: C.bg1,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.18s ease',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {collapsed ? (
            <button onClick={toggleCollapsed} style={{ width: 48, height: 48, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              »
            </button>
          ) : (
            <div style={{ padding: '1.1rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>NFC <span style={{ color: C.accent }}>Check-in</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                  <span style={{ fontSize: '0.65rem', color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
                  {lastUpdate && <span style={{ fontSize: '0.6rem', color: C.muted }}>{lastUpdate.toLocaleTimeString()}</span>}
                </div>
              </div>
              <button onClick={toggleCollapsed} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.9rem', padding: '0.1rem 0.2rem', marginTop: '0.1rem', flexShrink: 0 }}>
                «
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.4rem 0', overflowY: 'hidden' }}>
          {NAV_ITEMS.map(n => {
            const active = tab === n.key
            return collapsed ? (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                title={n.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 48, height: 36,
                  border: 'none', cursor: 'pointer',
                  background: 'transparent',
                  color: active ? C.accent : C.muted,
                  fontSize: '0.72rem', fontWeight: active ? 800 : 500,
                  boxSizing: 'border-box',
                }}
              >
                {n.short}
              </button>
            ) : (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.55rem 1rem', border: 'none', cursor: 'pointer',
                  background: active ? C.bg2 : 'transparent',
                  color: active ? C.text : C.muted,
                  fontSize: '0.85rem', fontWeight: active ? 700 : 400,
                  borderLeft: active ? `3px solid ${C.accent}` : '3px solid transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.label}
              </button>
            )
          })}
        </nav>

        {/* Kilépés */}
        <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {collapsed ? (
            <button
              onClick={() => supabase.auth.signOut()}
              title="Kilépés"
              style={{ width: 48, height: 40, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ↪
            </button>
          ) : (
            <div style={{ padding: '0.75rem 1rem' }}>
              <button onClick={() => supabase.auth.signOut()} style={{ ...S.btnSecondary, width: '100%', fontSize: '0.78rem' }}>
                Kilépés
              </button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
          {tab === 'status'   && <StatusTab   employees={employees} onSaved={loadData} settings={settings} />}
          {tab === 'workers'  && <WorkersTab  employees={employees} settings={settings} onSaved={loadData} />}
          {tab === 'log'      && <LogTab      events={events} onSaved={loadData} />}
          {tab === 'insights' && <InsightsTab employees={employees} events={events} />}
          {tab === 'register' && <RegisterTab companyId={me?.company_id} onSaved={loadData} />}
          {tab === 'settings' && <SettingsTab settings={settings} companyId={me?.company_id} onChange={setSettings} />}
        </div>
      </main>
    </div>
  )
}
