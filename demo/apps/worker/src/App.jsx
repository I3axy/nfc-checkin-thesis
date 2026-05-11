import { useState, useRef } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [state, setState] = useState('idle') // idle | starting | ready | loading | profile | manager | unknown
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [insideAll, setInsideAll] = useState([])
  const [nfcError, setNfcError] = useState('')
  const nfcSupported = 'NDEFReader' in window
  const scanning = useRef(false)
  const ndefRef = useRef(null)
  const resumeTimerRef = useRef(null)

  async function startScan() {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }

    setState('starting')
    setNfcError('')

    try {
      const ndef = new window.NDEFReader()
      ndefRef.current = ndef

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

    const cleanUid = String(uid || '').trim()
    const normalizedUid = normalizeUid(cleanUid)
    const variants = Array.from(new Set([
      cleanUid,
      cleanUid.toUpperCase(),
      cleanUid.toLowerCase(),
      cleanUid.replaceAll(':', ''),
      cleanUid.replaceAll('-', ''),
      normalizedUid,
    ].filter(Boolean)))

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, nfc_uid')
      .in('nfc_uid', variants)

    if (profileError) {
      setNfcError(profileError.message)
      setState('idle')
      scanning.current = false
      return
    }

    const p = (profiles ?? []).find(x => normalizeUid(x.nfc_uid) === normalizedUid)

    if (!p) {
      setNfcError(`Unknown card: ${cleanUid}`)
      setState('unknown')
      scanning.current = false
      return
    }

    const since7days = new Date()
    since7days.setDate(since7days.getDate() - 7)

    const { data: evts } = await supabase
      .from('events')
      .select('type, timestamp')
      .eq('user_id', p.id)
      .gte('timestamp', since7days.toISOString())
      .order('timestamp', { ascending: false })
      .limit(30)

    setProfile(p)
    setEvents(evts || [])
    setState('profile')
  }

  async function openManagerView() {
    setState('loading')
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, role')
      .order('name')

    const { data: allEvents } = await supabase
      .from('events')
      .select('user_id, type, timestamp')
      .order('timestamp', { ascending: false })

    const latest = {}
    for (const e of allEvents ?? []) {
      if (!latest[e.user_id]) latest[e.user_id] = e
    }

    const inside = (profiles ?? []).filter(p => latest[p.id]?.type === 'checkin')
    setInsideAll(inside)
    setState('manager')
  }

  function reset() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      scanning.current = false
      void startScan()
    }, 150)

    setState('starting')
    setProfile(null)
    setEvents([])
    setInsideAll([])
    scanning.current = false
  }

  if (!nfcSupported) return <FullScreen bg="#060c18" emoji="⚠️" title="NFC not supported" sub="Use Android Chrome" />

  if (state === 'idle') return (
    <FullScreen bg="#060c18" emoji="📱" title="Worker App" sub={nfcError || 'Tap below to start'}>
      <button onClick={startScan} style={btnStyle('#1e40af', true)}>Start Scanning</button>
    </FullScreen>
  )

  if (state === 'starting') return <FullScreen bg="#060c18" emoji="⏳" title="Starting…" />
  if (state === 'ready')    return <FullScreen bg="#060c18" emoji="📱" title="Tap your card" sub="Hold card to phone" />
  if (state === 'loading')  return <FullScreen bg="#060c18" emoji="⏳" title="Loading…" />
  if (state === 'unknown')  return <FullScreen bg="#f59e0b" emoji="❓" title="Card not registered" onReset={reset} />

  if (state === 'manager') {
    return (
      <div style={{ minHeight: '100dvh', background: '#060c18', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#0d1524', borderBottom: '1px solid #1a2d4a', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'clamp(1.05rem, 4.4vw, 1.3rem)', fontWeight: 800 }}>Manager View</div>
          <div style={{ fontWeight: 700, background: '#10b98120', color: '#10b981', border: '1px solid #10b98150', padding: '0.3rem 0.9rem', borderRadius: '9999px', fontSize: '0.85rem' }}>
            {insideAll.length} inside
          </div>
        </div>
        <div style={{ padding: '1rem' }}>
          {insideAll.length === 0 && (
            <div style={{ color: '#475569', textAlign: 'center', padding: '2rem' }}>Nobody is inside</div>
          )}
          {insideAll.map(p => (
            <div key={p.id} style={{
              background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: '0.75rem', padding: '1rem 1.25rem',
              marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#475569', textTransform: 'capitalize' }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button onClick={reset} style={btnStyle('#1d4ed8')}>← Back</button>
        </div>
      </div>
    )
  }

  // state === 'profile'
  const lastEvent = events[0]
  const isIn = lastEvent?.type === 'checkin'

  // Today's events
  const todayStr = new Date().toDateString()
  const todayEvents = events.filter(e => new Date(e.timestamp).toDateString() === todayStr)
  const todayCheckin  = todayEvents.filter(e => e.type === 'checkin').sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp))[0]
  const todayCheckout = todayEvents.filter(e => e.type === 'checkout').sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[0]

  // Group by day (last 7 days)
  const byDay = {}
  for (const e of events) {
    const day = new Date(e.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(e)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060c18', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Status header */}
      <div style={{ background: isIn ? '#10b981' : '#ef4444', color: '#fff', padding: '1.15rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(1.45rem, 7vw, 2.25rem)', fontWeight: 800, lineHeight: 1.1, wordBreak: 'break-word' }}>{profile.name}</div>
        <div style={{ fontSize: '1rem', opacity: 0.9, marginTop: '0.25rem' }}>
          {lastEvent ? (isIn ? '✅ Currently INSIDE' : '🔴 Currently OUTSIDE') : 'No events yet'}
        </div>
      </div>

      {/* Today summary */}
      <div style={{ background: '#0d1524', border: '1px solid #1a2d4a', margin: '1rem', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.6rem', color: '#94a3b8' }}>Today</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', fontWeight: 600 }}>Check In</div>
            <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>
              {todayCheckin ? new Date(todayCheckin.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', fontWeight: 600 }}>Check Out</div>
            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.1rem' }}>
              {todayCheckout ? new Date(todayCheckout.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 7-day history */}
      <div style={{ margin: '0 1rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.6rem', color: '#94a3b8' }}>Last 7 days</div>
        {Object.keys(byDay).length === 0 && (
          <div style={{ color: '#475569', padding: '0.5rem 0' }}>No events</div>
        )}
        {Object.entries(byDay).map(([day, dayEvts]) => (
          <div key={day} style={{ background: '#0d1524', border: '1px solid #1a2d4a', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', marginBottom: '0.4rem' }}>{day}</div>
            {dayEvts.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center', padding: '0.2rem 0', fontSize: '0.9rem' }}>
                <span style={{ color: e.type === 'checkin' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {e.type === 'checkin' ? '✅ In' : '🔴 Out'}
                </span>
                <span style={{ color: '#94a3b8' }}>
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1rem 2rem' }}>
        {profile.role === 'manager' && (
          <button onClick={openManagerView} style={btnStyle('#1e40af')}>Manager View →</button>
        )}
        <button onClick={reset} style={btnStyle('#1a2d4a')}>← Back</button>
      </div>
    </div>
  )
}

function FullScreen({ bg, emoji, title, sub, onReset, children }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: bg, color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 'clamp(3.6rem, 18vw, 5rem)', lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 'clamp(1.6rem, 8vw, 2rem)', fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
      {sub && <div style={{ fontSize: 'clamp(1rem, 4.2vw, 1.2rem)', opacity: 0.75, maxWidth: 520 }}>{sub}</div>}
      {children}
      {onReset && <button onClick={onReset} style={btnStyle('rgba(255,255,255,0.25)')}>Try again</button>}
    </div>
  )
}

function btnStyle(bg) {
  return {
    padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700,
    background: bg, color: '#fff', border: 'none',
    borderRadius: '0.75rem', cursor: 'pointer', width: '100%',
  }
}

function normalizeUid(uid) {
  return String(uid || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}
