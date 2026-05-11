import { useState, useRef } from 'react'
import { supabase } from './lib/supabase'

const RESET_DELAY = 3000

export default function App() {
  const [screen, setScreen] = useState('idle')   // idle | starting | ready | checkin | checkout | unknown
  const [name, setName] = useState('')
  const [lastUid, setLastUid] = useState('')
  const [error, setError] = useState('')
  const [log, setLog] = useState([])
  const nfcSupported = 'NDEFReader' in window
  const processing = useRef(false)
  const resetTimer = useRef(null)
  const ndefRef = useRef(null)

  async function startScan() {
    setScreen('starting')
    setError('')
    try {
      const ndef = new window.NDEFReader()
      ndefRef.current = ndef
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => handleCard(serialNumber))
      setScreen('ready')
    } catch (err) {
      setError(err.message)
      setScreen('idle')
    }
  }

  async function handleCard(uid) {
    if (processing.current) return
    processing.current = true
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setLastUid(uid)

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('nfc_uid', uid)
      .single()

    if (!profile) {
      addLog(uid, 'unknown')
      flash('unknown', '')
      return
    }

    const { data: lastEvent } = await supabase
      .from('events')
      .select('type')
      .eq('user_id', profile.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextType = !lastEvent || lastEvent.type === 'checkout' ? 'checkin' : 'checkout'
    const { error: insertError } = await supabase.from('events').insert({ user_id: profile.id, type: nextType })

    if (insertError) {
      addLog(uid, 'error', insertError.message)
      flash('unknown', insertError.message)
      return
    }

    addLog(uid, nextType, profile.name)
    flash(nextType, profile.name)
  }

  function addLog(uid, result, personName = '') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog(prev => [{ uid, result, personName, time }, ...prev].slice(0, 10))
  }

  function flash(screenKey, personName) {
    setScreen(screenKey)
    setName(personName)
    resetTimer.current = setTimeout(() => {
      setScreen('ready')
      setName('')
      processing.current = false
    }, RESET_DELAY)
  }

  if (!nfcSupported) return (
    <Screen bg="#060c18">
      <div style={S.emoji}>⚠️</div>
      <div style={S.title}>NFC not supported</div>
      <div style={S.sub}>Use Android Chrome</div>
    </Screen>
  )

  if (screen === 'idle') return (
    <Screen bg="#060c18">
      <div style={S.emoji}>📡</div>
      <div style={S.title}>NFC Scanner</div>
      {error && <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fca5a5', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1rem', borderRadius: '0.5rem', textAlign: 'center', maxWidth: '80%' }}>{error}</div>}
      <button onClick={startScan} style={S.startBtn}>
        Start Scanning
      </button>
    </Screen>
  )

  if (screen === 'starting') return (
    <Screen bg="#060c18">
      <div style={S.emoji}>⏳</div>
      <div style={S.title}>Starting…</div>
    </Screen>
  )

  const bg    = { ready: '#060c18', checkin: '#10b981', checkout: '#ef4444', unknown: '#f59e0b' }[screen] ?? '#060c18'
  const emoji = { ready: '📡',      checkin: '✅',       checkout: '🔴',      unknown: '❓' }[screen]
  const title = { ready: 'Tap your NFC card', checkin: 'CHECKED IN', checkout: 'CHECKED OUT', unknown: 'Card not registered' }[screen]

  return (
    <Screen bg={bg}>
      <div style={S.panel}>
        <div style={S.emoji}>{emoji}</div>
        <div style={S.title}>{title}</div>
      </div>
      {name && <div style={S.name}>{name}</div>}

      {screen === 'unknown' && lastUid && (
        <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', maxWidth: '92vw', wordBreak: 'break-all' }}>
          {lastUid}
        </div>
      )}

      {screen === 'ready' && log.length > 0 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.75rem', background: 'rgba(0,0,0,0.55)', maxHeight: '34dvh', overflowY: 'auto' }}>
          {log.map((entry, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', opacity: i === 0 ? 1 : 0.45, padding: '0.15rem 0', fontFamily: 'monospace' }}>
              <span style={{ color: entry.result === 'checkin' ? '#10b981' : entry.result === 'checkout' ? '#ef4444' : '#f59e0b' }}>
                {entry.result === 'checkin' ? '↑ IN' : entry.result === 'checkout' ? '↓ OUT' : '? UNK'}
                {entry.personName ? ` ${entry.personName}` : ''}
              </span>
              <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.uid}</span>
              <span style={{ color: '#475569', textAlign: 'right' }}>{entry.time}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}

function Screen({ bg, children }) {
  return (
    <div style={{ ...S.fullscreen, background: bg, transition: 'background 0.2s' }}>
      {children}
    </div>
  )
}

const S = {
  fullscreen: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', userSelect: 'none', position: 'relative', color: '#fff', padding: '1rem', boxSizing: 'border-box' },
  panel:    { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' },
  emoji:    { fontSize: 'clamp(4rem, 14vw, 7rem)', lineHeight: 1 },
  title:    { fontSize: 'clamp(1.7rem, 7vw, 3rem)', fontWeight: 800, textAlign: 'center', padding: '0 1rem', maxWidth: 720 },
  name:     { fontSize: 'clamp(1.35rem, 5.5vw, 2.2rem)', fontWeight: 600, opacity: 0.9, textAlign: 'center' },
  sub:      { fontSize: 'clamp(1rem, 3.6vw, 1.2rem)', opacity: 0.7, textAlign: 'center' },
  startBtn: {
    marginTop: '0.5rem', padding: '1rem clamp(1.6rem, 8vw, 3rem)', fontSize: 'clamp(1rem, 4.4vw, 1.3rem)', fontWeight: 800,
    background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '1rem',
    cursor: 'pointer', letterSpacing: '0.02em',
  },
}
