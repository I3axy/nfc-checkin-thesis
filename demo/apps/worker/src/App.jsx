import { useState, useRef } from 'react'

const FUNCTION_URL  = import.meta.env.VITE_WORKER_FUNCTION_URL
const COMPANY_SLUG  = import.meta.env.VITE_COMPANY_SLUG

export default function App() {
  const [state, setState] = useState('idle') // idle | starting | ready | loading | profile | manager | unknown
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [managerData, setManagerData] = useState(null)
  const [nfcError, setNfcError] = useState('')
  const nfcSupported = 'NDEFReader' in window
  const scanning = useRef(false)
  const resumeTimerRef = useRef(null)

  // iOS: check if launched via NDEF URL (?uid=...)
  const urlUid = new URLSearchParams(window.location.search).get('uid')

  async function startScan() {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }

    // iOS fallback: uid in URL param
    if (urlUid && !nfcSupported) {
      await handleCard(urlUid)
      return
    }

    setState('starting')
    setNfcError('')
    try {
      const ndef = new window.NDEFReader()
      ndef.onreading = ({ serialNumber }) => {
        if (!scanning.current) handleCard(serialNumber)
      }
      await ndef.scan()
      setState('ready')
    } catch (err) {
      setNfcError(err.message)
      setState('idle')
    }
  }

  async function handleCard(uid) {
    scanning.current = true
    setState('loading')

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfc_uid: uid, company_slug: COMPANY_SLUG }),
      })

      const data = await res.json()

      if (!res.ok) {
        setNfcError(data.code === 'UNKNOWN_CARD' ? `Unknown card: ${uid}` : (data.error ?? 'Error'))
        setState('unknown')
        scanning.current = false
        return
      }

      setProfile(data.profile)

      if (data.profile.role === 'manager' || data.profile.role === 'admin') {
        setManagerData({ allProfiles: data.allProfiles, recentEvents: data.recentEvents })
        setState('manager')
      } else {
        setEvents(data.events ?? [])
        setState('profile')
      }
    } catch {
      setNfcError('Network error')
      setState('unknown')
      scanning.current = false
    }
  }

  function reset() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      scanning.current = false
      startScan()
    }, 150)
    setState('starting')
    setProfile(null)
    setEvents([])
    setManagerData(null)
    scanning.current = false
  }

  // ---- screens ----

  if (!nfcSupported && !urlUid) return (
    <FullScreen bg="#1b2838" emoji="⚠️" title="NFC not supported"
      sub="Android Chrome required, or open via NFC link on iOS" />
  )

  if (state === 'idle') return (
    <FullScreen bg="#1b2838" emoji="📱" title="Worker App" sub={nfcError || 'Tap to start'}>
      <Btn onClick={startScan} accent>Start Scanning</Btn>
    </FullScreen>
  )

  if (state === 'starting') return <FullScreen bg="#1b2838" emoji="⏳" title="Starting…" />
  if (state === 'ready')    return <FullScreen bg="#1b2838" emoji="📱" title="Tap your card" sub="Hold card to phone" />
  if (state === 'loading')  return <FullScreen bg="#1b2838" emoji="⏳" title="Loading…" />
  if (state === 'unknown')  return <FullScreen bg="#1b2838" emoji="❓" title="Card not registered" sub={nfcError} onReset={reset} />

  if (state === 'manager') {
    const { allProfiles = [], recentEvents = [] } = managerData ?? {}
    const latest = {}
    for (const e of recentEvents) {
      if (!latest[e.user_id]) latest[e.user_id] = e
    }
    const workers = allProfiles.filter(p => p.role === 'worker')
    const inside  = workers.filter(p => latest[p.id]?.type === 'checkin')
    const outside = workers.filter(p => latest[p.id]?.type !== 'checkin')

    return (
      <Page>
        <PageHeader title="Manager View" right={
          <span style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98150', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>
            {inside.length} bentvan
          </span>
        } />

        <Section label={`Bent (${inside.length})`}>
          {inside.length === 0
            ? <Empty>Senki nincs bent</Empty>
            : inside.map(p => <PersonRow key={p.id} person={p} status="in" />)
          }
        </Section>

        <Section label={`Kint (${outside.length})`}>
          {outside.map(p => <PersonRow key={p.id} person={p} status="out" />)}
        </Section>

        <div style={{ padding: '0 1rem 2rem' }}>
          <Btn onClick={reset}>← Vissza</Btn>
        </div>
      </Page>
    )
  }

  // state === 'profile'
  const lastEvent = events[0]
  const isIn = lastEvent?.type === 'checkin'

  const todayStr = new Date().toDateString()
  const todayEvents = events.filter(e => new Date(e.timestamp).toDateString() === todayStr)
  const todayCheckin  = todayEvents.filter(e => e.type === 'checkin').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0]
  const todayCheckout = todayEvents.filter(e => e.type === 'checkout').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]

  const byDay = {}
  for (const e of events) {
    const day = new Date(e.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(e)
  }

  return (
    <Page>
      <div style={{ background: isIn ? '#5ba32b' : '#c94f4f', padding: '1.25rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(1.4rem, 7vw, 2rem)', fontWeight: 800, color: '#c6d4df' }}>{profile.name}</div>
        <div style={{ fontSize: '0.95rem', color: 'rgba(198,212,223,0.85)', marginTop: '0.2rem' }}>
          {lastEvent ? (isIn ? '✅ Bent van' : '🔴 Nincs bent') : 'Még nincs esemény'}
        </div>
      </div>

      <Section label="Mai nap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <StatCell label="Belépés" value={todayCheckin ? fmt(todayCheckin.timestamp) : '—'} color="#5ba32b" />
          <StatCell label="Kilépés" value={todayCheckout ? fmt(todayCheckout.timestamp) : '—'} color="#c94f4f" />
        </div>
      </Section>

      <Section label="Utolsó 7 nap">
        {Object.keys(byDay).length === 0
          ? <Empty>Nincs esemény</Empty>
          : Object.entries(byDay).map(([day, dayEvts]) => (
            <div key={day} style={{ borderBottom: '1px solid #3d4450', padding: '0.6rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#8f98a0', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 700 }}>{day}</div>
              {dayEvts.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.1rem 0' }}>
                  <span style={{ color: e.type === 'checkin' ? '#5ba32b' : '#c94f4f', fontWeight: 600 }}>
                    {e.type === 'checkin' ? '↑ Be' : '↓ Ki'}
                  </span>
                  <span style={{ color: '#8f98a0' }}>{fmt(e.timestamp)}</span>
                </div>
              ))}
            </div>
          ))
        }
      </Section>

      <div style={{ padding: '0 1rem 2rem' }}>
        <Btn onClick={reset}>← Vissza</Btn>
      </div>
    </Page>
  )
}

// ---- helpers ----

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function Page({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#1b2838', color: '#c6d4df', fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  )
}

function PageHeader({ title, right }) {
  return (
    <div style={{ background: '#16202d', borderBottom: '1px solid #3d4450', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{title}</span>
      {right}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ borderLeft: '3px solid #66c0f4', paddingLeft: '0.75rem', marginLeft: '1rem', marginBottom: '0.4rem', fontWeight: 700, fontSize: '0.8rem', color: '#8f98a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ background: '#16202d', border: '1px solid #3d4450' }}>
        {children}
      </div>
    </div>
  )
}

function StatCell({ label, value, color }) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid #3d4450' }}>
      <div style={{ fontSize: '0.7rem', color: '#8f98a0', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color }}>{value}</div>
    </div>
  )
}

function PersonRow({ person, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid #3d4450' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'in' ? '#5ba32b' : '#3d4450', flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{person.name}</div>
        {person.department && <div style={{ fontSize: '0.75rem', color: '#8f98a0' }}>{person.department}</div>}
      </div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ color: '#8f98a0', padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{children}</div>
}

function FullScreen({ bg, emoji, title, sub, onReset, children }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: bg, color: '#c6d4df', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 'clamp(3rem, 16vw, 5rem)', lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 'clamp(1.5rem, 7vw, 2rem)', fontWeight: 800, color: '#c6d4df' }}>{title}</div>
      {sub && <div style={{ fontSize: '0.95rem', color: '#8f98a0', maxWidth: 420 }}>{sub}</div>}
      {children}
      {onReset && <Btn onClick={onReset}>Újra</Btn>}
    </div>
  )
}

function Btn({ onClick, accent, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.8rem 1.5rem', fontSize: '0.95rem', fontWeight: 700,
      background: accent ? '#66c0f4' : '#2a475e',
      color: accent ? '#1b2838' : '#c6d4df',
      border: '1px solid ' + (accent ? '#66c0f4' : '#3d4450'),
      borderRadius: '2px', cursor: 'pointer', width: '100%',
    }}>
      {children}
    </button>
  )
}
