import { useState, useRef } from 'react'

const FUNCTION_URL  = import.meta.env.VITE_WORKER_FUNCTION_URL
const COMPANY_SLUG  = import.meta.env.VITE_COMPANY_SLUG

export default function App() {
  const [state, setState] = useState('idle') // idle | starting | ready | loading | profile | manager | unknown
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [absences, setAbsences] = useState([])
  const [managerData, setManagerData] = useState(null)
  const [nfcError, setNfcError] = useState('')
  const [lastUid, setLastUid] = useState('')
  const [absOpen, setAbsOpen] = useState(false)
  const [absDate, setAbsDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [absType, setAbsType] = useState('vacation')
  const [absNote, setAbsNote] = useState('')
  const [absStatus, setAbsStatus] = useState(null) // null | saving | ok | error
  const [absError, setAbsError] = useState('')
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
    setLastUid(uid)
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
        setAbsences(data.absences ?? [])
        setState('profile')
      }
    } catch {
      setNfcError('Network error')
      setState('unknown')
      scanning.current = false
    }
  }

  async function submitAbsence() {
    setAbsStatus('saving'); setAbsError('')
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: lastUid,
          company_slug: COMPANY_SLUG,
          action: 'submit_absence',
          absence: { date: absDate, type: absType, note: absNote.trim() || null },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAbsError(data.error ?? 'Hiba történt'); setAbsStatus('error'); return }
      setAbsStatus('ok'); setAbsOpen(false)
      setAbsences(prev => [{ id: 'tmp-' + Date.now(), date: absDate, type: absType, note: absNote.trim() || null }, ...prev])
      setAbsNote('')
    } catch {
      setAbsError('Hálózati hiba'); setAbsStatus('error')
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
    setAbsences([])
    setManagerData(null)
    setAbsOpen(false); setAbsStatus(null); setAbsError('')
    scanning.current = false
  }

  // ---- screens ----

  if (!nfcSupported && !urlUid) return (
    <FullScreen bg="var(--bg)" emoji="⚠️" title="NFC not supported"
      sub="Android Chrome required, or open via NFC link on iOS" />
  )

  if (state === 'idle') return (
    <FullScreen bg="var(--bg)" emoji="📱" title="Worker App" sub={nfcError || 'Tap to start'}>
      <Btn onClick={startScan} accent>Start Scanning</Btn>
    </FullScreen>
  )

  if (state === 'starting') return <FullScreen bg="var(--bg)" emoji="⏳" title="Starting…" />
  if (state === 'ready')    return <FullScreen bg="var(--bg)" emoji="📱" title="Tap your card" sub="Hold card to phone" />
  if (state === 'loading')  return <FullScreen bg="var(--bg)" emoji="⏳" title="Loading…" />
  if (state === 'unknown')  return <FullScreen bg="var(--bg)" emoji="❓" title="Card not registered" sub={nfcError} onReset={reset} />

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
          <span style={{ background: 'color-mix(in srgb, var(--green) 13%, transparent)', color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: 999 }}>
            {inside.length} bent van
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
  const todayMins = calcDayMins(todayEvents)

  // group last 7 days
  const byDay = {}
  for (const e of events) {
    const key = new Date(e.timestamp).toDateString()
    if (!byDay[key]) byDay[key] = { label: new Date(e.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), evts: [] }
    byDay[key].evts.push(e)
  }
  const days = Object.values(byDay)
  const weekMins = days.reduce((s, d) => s + calcDayMins(d.evts), 0)
  const workDays = days.filter(d => calcDayMins(d.evts) > 0).length

  return (
    <Page>
      {/* Status banner — vivid green/red in both themes, white text */}
      <div style={{ background: isIn ? '#10b981' : '#ef4444', padding: '1.4rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(1.4rem, 7vw, 2rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{profile.name}</div>
        <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', marginTop: '0.2rem', fontWeight: 500 }}>
          {lastEvent ? (isIn ? '✅ Bent van' : '🔴 Nincs bent') : 'Még nincs esemény'}
        </div>
      </div>

      <Section label="Mai nap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <StatCell label="Belépés" value={todayCheckin ? fmt(todayCheckin.timestamp) : '—'} color="var(--green)" />
          <StatCell label="Kilépés" value={todayCheckout ? fmt(todayCheckout.timestamp) : '—'} color="var(--red)" />
          <StatCell label="Ledolgozva" value={fmtMins(todayMins)} color="var(--accent)" last />
        </div>
      </Section>

      <Section label="Heti összesítő">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <StatCell label="Ledolgozott idő" value={fmtMins(weekMins)} color="var(--accent)" />
          <StatCell label="Munkanapok" value={String(workDays)} color="var(--text)" last />
        </div>
      </Section>

      <Section label="Utolsó 7 nap">
        {days.length === 0
          ? <Empty>Nincs esemény</Empty>
          : days.map((d, di) => {
            const mins = calcDayMins(d.evts)
            return (
              <div key={di} style={{ borderBottom: '1px solid var(--border)', padding: '0.6rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{d.label}</span>
                  {mins > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700 }}>{fmtMins(mins)}</span>}
                </div>
                {d.evts.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.1rem 0' }}>
                    <span style={{ color: e.type === 'checkin' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {e.type === 'checkin' ? '↑ Be' : '↓ Ki'}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{fmt(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            )
          })
        }
      </Section>

      <Section label="Hiányzások">
        {absences.length === 0
          ? <Empty>Nincs rögzített hiányzás</Empty>
          : absences.map(a => {
            const isPast = new Date(a.date + 'T23:59:59') < new Date()
            return (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)', opacity: isPast ? 0.6 : 1 }}>
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text)' }}>{a.date}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: a.type === 'unjustified' ? 'var(--red)' : 'var(--cal-justified)' }}>{ABSENCE_LABELS[a.type] ?? a.type}</span>
              </div>
            )
          })
        }
        {absStatus === 'ok' && (
          <div style={{ padding: '0.6rem 1rem', color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>✓ Rögzítve — a vezető látni fogja.</div>
        )}
        {!absOpen ? (
          <div style={{ padding: '0.75rem 1rem' }}>
            <Btn onClick={() => { setAbsOpen(true); setAbsStatus(null); setAbsError('') }} accent>+ Új hiányzás</Btn>
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={LBL}>Dátum</label>
            <input type="date" value={absDate} onChange={e => setAbsDate(e.target.value)} style={INP} />
            <label style={LBL}>Típus</label>
            <select value={absType} onChange={e => setAbsType(e.target.value)} style={INP}>
              <option value="vacation">Szabadság</option>
              <option value="sick">Betegszabadság</option>
              <option value="other">Egyéb</option>
            </select>
            <label style={LBL}>Megjegyzés (opcionális)</label>
            <input value={absNote} onChange={e => setAbsNote(e.target.value)} placeholder="pl. Orvosi vizsgálat" style={INP} />
            {absStatus === 'error' && <div style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{absError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
              <Btn onClick={() => setAbsOpen(false)}>Mégse</Btn>
              <Btn onClick={submitAbsence} accent>{absStatus === 'saving' ? 'Küldés…' : 'Beküldés'}</Btn>
            </div>
          </div>
        )}
      </Section>

      <div style={{ padding: '1rem 1rem 2rem' }}>
        <Btn onClick={reset}>← Vissza</Btn>
      </div>
    </Page>
  )
}

// ---- helpers ----

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function calcDayMins(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let total = 0, lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') lastIn = new Date(e.timestamp)
    else if (e.type === 'checkout' && lastIn) { total += (new Date(e.timestamp) - lastIn) / 60000; lastIn = null }
  }
  if (lastIn && new Date().toDateString() === lastIn.toDateString()) total += (Date.now() - lastIn) / 60000
  return Math.floor(total)
}

function fmtMins(m) {
  if (m < 1) return '—'
  const h = Math.floor(m / 60), min = Math.floor(m % 60)
  return h === 0 ? `${min}p` : min === 0 ? `${h}ó` : `${h}ó ${min}p`
}

const ABSENCE_LABELS = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }
const LBL = { fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }
const INP = { width: '100%', padding: '0.6rem 0.7rem', fontSize: '0.9rem', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box', borderRadius: 10, outline: 'none' }

function Page({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  )
}

function PageHeader({ title, right }) {
  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{title}</span>
      {right}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginTop: '1rem', padding: '0 0.85rem' }}>
      <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '0.6rem', marginBottom: '0.45rem', fontWeight: 700, fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function StatCell({ label, value, color, last }) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderRight: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color }}>{value}</div>
    </div>
  )
}

function PersonRow({ person, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'in' ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{person.name}</div>
        {person.department && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{person.department}</div>}
      </div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ color: 'var(--muted)', padding: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{children}</div>
}

function FullScreen({ bg, emoji, title, sub, onReset, children }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: bg, color: 'var(--text)', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 'clamp(3rem, 16vw, 5rem)', lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 'clamp(1.5rem, 7vw, 2rem)', fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      {sub && <div style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 420 }}>{sub}</div>}
      {children}
      {onReset && <Btn onClick={onReset}>Újra</Btn>}
    </div>
  )
}

function Btn({ onClick, accent, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.8rem 1.5rem', fontSize: '0.95rem', fontWeight: 600,
      background: accent ? 'var(--accent)' : 'var(--surface-2)',
      color: accent ? 'var(--accent-contrast)' : 'var(--text)',
      border: '1px solid ' + (accent ? 'var(--accent)' : 'var(--border)'),
      borderRadius: 10, cursor: 'pointer', width: '100%',
    }}>
      {children}
    </button>
  )
}
