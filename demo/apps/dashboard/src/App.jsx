import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { C, S, R, tint } from './lib/theme'
import { DEFAULT_SETTINGS, loadTheme, companyToSettings } from './lib/settings'
import './responsive.css'
import { getDaySummary, calcRangeMinutes, countRangeEvents } from './lib/utils'
import { Field } from './components/ui'
import { ToastHost } from './components/toast'
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
      <div style={{ width: 'min(380px, 100%)' }}>
        <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, background: C.accent, color: C.accentContrast, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.75rem' }}>N</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>NFC Check-in</div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginTop: '0.25rem' }}>Manager Dashboard</div>
        </div>
        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, boxShadow: C.shadow }}>
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
  const [tab, setTab]               = useState('status')
  const [settings, setSettings]     = useState(() => ({ ...DEFAULT_SETTINGS, theme: loadTheme() }))
  const [me, setMe]                 = useState(null)
  const [collapsed, setCollapsed]   = useState(() => localStorage.getItem('nfc_nav_collapsed') === '1')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('id, company_id, role, name').eq('auth_user_id', user.id).maybeSingle()
        .then(({ data: profile }) => {
          // Keep the login email even if no profile row is linked yet
          setMe({ ...(profile ?? {}), email: user.email })
          if (!profile?.company_id) return
          supabase.from('companies').select('*').eq('id', profile.company_id).maybeSingle()
            .then(({ data: company }) => {
              if (!company) return
              setSettings(s => ({ ...s, ...companyToSettings(company) }))
              setMe(m => ({ ...m, companyName: company.name, companySlug: company.slug }))
            })
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
      supabase.from('profiles').select('id, company_id, name, first_name, last_name, email, phone, role, department, nfc_uid, pin, guest_expires_at, created_at').order('last_name'),
      supabase.from('events').select('id, user_id, type, timestamp, is_manual, note, photo_url').order('timestamp', { ascending: false }).limit(500),
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
    setEvents((allEvents ?? []).map(e => ({
      ...e,
      name: profileMap[e.user_id]?.name ?? 'Ismeretlen',
      department: profileMap[e.user_id]?.department ?? null,
    })))
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  return (
    <div style={{ height: '100dvh', display: 'flex', background: C.bg0, color: C.text, position: 'relative' }}>
      {/* Az `is-open` csak ÁLLAPOTOT jelöl; hogy ez lebegő megjelenítést
          jelent-e, azt a stíluslap dönti el a képernyőméret alapján. */}
      <aside className={collapsed ? 'app-nav' : 'app-nav is-open'} style={{
        width: collapsed ? 52 : 224,
        flexShrink: 0,
        background: C.bg1,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.18s ease',
        overflow: 'hidden',
        boxShadow: collapsed ? 'none' : C.shadow,
      }}>

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {collapsed ? (
            <button onClick={toggleCollapsed} title="Menü kinyitása" style={{ width: 52, height: 52, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              »
            </button>
          ) : (
            <div style={{ padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>NFC Check-in</div>
              <button onClick={toggleCollapsed} title="Menü becsukása" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.9rem', padding: '0.2rem 0.3rem', flexShrink: 0, borderRadius: R.sm }}>
                «
              </button>
            </div>
          )}
        </div>

        {/* Nav — overflow hidden on BOTH axes: a horizontal scrollbar would
            otherwise show up as a stray strip above the sign-out button */}
        <nav style={{ flex: 1, padding: collapsed ? '0.4rem 0' : '0.5rem 0.55rem', overflow: 'hidden' }}>
          {NAV_ITEMS.map(n => {
            const active = tab === n.key
            return collapsed ? (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                title={n.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 34, margin: '0.1rem 8px',
                  border: 'none', cursor: 'pointer',
                  background: active ? tint(C.accent, 14) : 'transparent',
                  color: active ? C.accent : C.muted,
                  fontSize: '0.72rem', fontWeight: active ? 700 : 500,
                  boxSizing: 'border-box', borderRadius: R.md,
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
                  padding: '0.5rem 0.75rem', margin: '0.1rem 0',
                  border: 'none', cursor: 'pointer',
                  background: active ? tint(C.accent, 12) : 'transparent',
                  color: active ? C.accent : C.muted,
                  fontSize: '0.84rem', fontWeight: active ? 600 : 500,
                  whiteSpace: 'nowrap', borderRadius: R.md,
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
              style={{ width: 52, height: 40, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ↪
            </button>
          ) : (
            <div style={{ padding: '0.75rem 1rem' }}>
              {/* Which account is actually logged in — easy to lose track of */}
              <div style={{ marginBottom: '0.6rem', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {me?.name ?? 'Bejelentkezve'}
                </div>
                <div style={{ fontSize: '0.7rem', color: C.muted, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={me?.email ?? ''}>
                  {me?.email ?? '…'}
                </div>
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ ...S.btnSecondary, width: '100%', fontSize: '0.78rem' }}>
                Kilépés
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Elsötétítő réteg a lebegő menü mögé — csak telefonon jelenik meg */}
      {!collapsed && (
        <div className="app-nav-scrim only-phone" onClick={toggleCollapsed} />
      )}

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="app-main">
          {tab === 'status'   && <StatusTab   employees={employees} onSaved={loadData} settings={settings} />}
          {tab === 'workers'  && <WorkersTab  employees={employees} settings={settings} me={me} onSaved={loadData} />}
          {tab === 'log'      && <LogTab      events={events} employees={employees} onSaved={loadData} />}
          {tab === 'insights' && <InsightsTab employees={employees} events={events} settings={settings} />}
          {/* A cég a szerveren, a hívó profiljából derül ki — nem kliensről érkezik */}
          {tab === 'register' && <RegisterTab onSaved={loadData} />}
          {tab === 'settings' && <SettingsTab settings={settings} companyId={me?.company_id} me={me} employees={employees} onChange={setSettings} />}
        </div>
      </main>

      <ToastHost />
    </div>
  )
}
