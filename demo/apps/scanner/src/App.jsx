import { useState, useRef, useEffect } from 'react'
import {
  normalizeUid, cacheRoster, lookupCard, getState, setState,
  enqueue, queueCount, getMeta,
} from './db.js'
import { syncQueue } from './sync.js'

const RESET_DELAY = 3000
const CAMERA_TIMEOUT = 20000
const SYNC_INTERVAL = 20000
const FUNCTION_URL = import.meta.env.VITE_CHECKIN_FUNCTION_URL
const COMPANY_SLUG = import.meta.env.VITE_COMPANY_SLUG

export default function App() {
  const [screen, setScreen] = useState('idle')   // idle | starting | ready | checkin | checkout | unknown | expired | camera | uploading
  const [name, setName] = useState('')
  const [lastUid, setLastUid] = useState('')
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [log, setLog] = useState([])
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)
  const [syncingUi, setSyncingUi] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const nfcSupported = 'NDEFReader' in window
  const processing = useRef(false)
  const resetTimer = useRef(null)
  const pendingUid = useRef(null)
  const pendingIdentity = useRef(null)   // { nfc_uid } | { pin } for the photo follow-up
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cameraTimeout = useRef(null)
  const captureMode = useRef('online')   // 'online' | 'offline'
  const offlineCtx = useRef(null)        // { uid, name, type } during offline photo capture
  const syncing = useRef(false)

  // --- background: roster refresh + queue sync --------------------------------
  useEffect(() => {
    refreshPending()
    if (navigator.onLine) syncAndRefresh()

    const onOnline = () => { setOnline(true); syncAndRefresh() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const iv = setInterval(() => { if (navigator.onLine) syncAndRefresh() }, SYNC_INTERVAL)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(iv)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshPending() {
    setPending(await queueCount())
  }

  async function refreshRoster() {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_slug: COMPANY_SLUG, action: 'roster' }),
      })
      if (!res.ok) return
      const data = await res.json()
      await cacheRoster(data)
    } catch { /* offline — keep the last cached roster */ }
  }

  async function syncAndRefresh() {
    if (syncing.current) return
    syncing.current = true
    setSyncingUi(true)
    try {
      await syncQueue({ functionUrl: FUNCTION_URL, companySlug: COMPANY_SLUG, onProgress: refreshPending })
      await refreshRoster()
    } finally {
      await refreshPending()
      syncing.current = false
      setSyncingUi(false)
    }
  }

  // --- NFC --------------------------------------------------------------------
  async function startScan() {
    setScreen('starting')
    setError('')
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => handleCard(serialNumber))
      setScreen('ready')
    } catch (err) {
      setError(err.message)
      setScreen('idle')
    }
  }

  // identity is { nfc_uid } for a card or { pin } for keypad entry
  async function callCheckin(identity, photoBase64) {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identity, company_slug: COMPANY_SLUG, ...(photoBase64 ? { photo_base64: photoBase64 } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, code: data.code, error: data.error, user: data.user }
      if (data.needs_photo) return { ok: true, needsPhoto: true, user: data.user }
      return { ok: true, event: data.event, user: data.user }
    } catch {
      return { ok: false, offline: true }   // network failure — fall back to offline
    }
  }

  async function handleCard(rawUid) {
    if (processing.current) return
    processing.current = true
    if (resetTimer.current) clearTimeout(resetTimer.current)
    const uid = normalizeUid(rawUid)
    setLastUid(uid)
    pendingUid.current = uid
    pendingIdentity.current = { nfc_uid: uid }

    // Straight to offline if the browser knows it's offline.
    if (!navigator.onLine) { await recordOffline(uid); return }

    const result = await callCheckin({ nfc_uid: uid }, null)
    if (result.offline) { await recordOffline(uid); return }   // died mid-request
    if (result.ok && result.needsPhoto) { openCamera('online'); return }
    finishResult(result)
  }

  // --- PIN keypad (online only; a PIN can't be verified offline) --------------
  function openPinPad() {
    if (processing.current) return
    processing.current = true            // block card taps while typing a PIN
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setPinInput('')
    setScreen('pin')
  }

  function cancelPin() {
    setPinInput('')
    setScreen('ready')
    processing.current = false
  }

  async function submitPin() {
    if (pinInput.length < 4) return
    const value = pinInput
    setPinInput('')
    pendingUid.current = null
    pendingIdentity.current = { pin: value }
    setLastUid('')

    if (!navigator.onLine) { flash('noconn', ''); return }
    const result = await callCheckin({ pin: value }, null)
    if (result.offline) { flash('noconn', ''); return }
    if (result.ok && result.needsPhoto) { openCamera('online'); return }
    finishResult(result)
  }

  // --- offline path -----------------------------------------------------------
  async function recordOffline(uid) {
    const card = await lookupCard(uid)
    if (!card) { flash('unknown', ''); return }                // never synced this card
    if (card.role === 'guest' && card.guest_expires_at && new Date(card.guest_expires_at) < new Date()) {
      flash('expired', card.name); return
    }
    const cur = await getState(uid)
    const type = cur === 'checkin' ? 'checkout' : 'checkin'

    if (await getMeta('photo_required')) {
      offlineCtx.current = { uid, name: card.name, type }
      openCamera('offline')
      return
    }
    await commitOffline({ uid, name: card.name, type, photoBase64: null })
  }

  async function commitOffline({ uid, name, type, photoBase64 }) {
    await enqueue({
      uid,
      name,
      type,
      timestamp: new Date().toISOString(),
      client_event_id: crypto.randomUUID(),
      photo_base64: photoBase64 || null,
    })
    await setState(uid, type)
    await refreshPending()
    flash(type, name, { offline: true })
    if (navigator.onLine) syncAndRefresh()
  }

  function finishResult(result) {
    if (!result.ok) {
      if (result.code === 'UNKNOWN_CARD') { flash('unknown', '') }
      else if (result.code === 'UNKNOWN_PIN') { flash('badpin', '') }
      else if (result.code === 'GUEST_EXPIRED') { flash('expired', result.user?.name ?? '') }
      else { flash('unknown', '') }
      return
    }
    flash(result.event.type, result.user.name)
  }

  // --- camera -----------------------------------------------------------------
  async function openCamera(mode) {
    captureMode.current = mode
    setCameraError('')
    setScreen('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      cameraTimeout.current = setTimeout(() => cancelCamera('Photo timed out'), CAMERA_TIMEOUT)
    } catch (err) {
      // Offline: don't lose the attendance record just because the camera failed.
      if (mode === 'offline' && offlineCtx.current) {
        stopCameraStream()
        await commitOffline({ ...offlineCtx.current, photoBase64: null })
        return
      }
      setCameraError(err.message || 'Camera unavailable')
    }
  }

  function stopCameraStream() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (cameraTimeout.current) { clearTimeout(cameraTimeout.current); cameraTimeout.current = null }
  }

  async function cancelCamera(reason) {
    stopCameraStream()
    // Offline capture cancelled/timed out → still record the event (no photo).
    if (captureMode.current === 'offline' && offlineCtx.current) {
      await commitOffline({ ...offlineCtx.current, photoBase64: null })
      return
    }
    flash('unknown', '')
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 640
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    stopCameraStream()

    if (captureMode.current === 'offline') {
      await commitOffline({ ...offlineCtx.current, photoBase64: dataUrl })
      return
    }

    setScreen('uploading')
    const result = await callCheckin(pendingIdentity.current, dataUrl)
    if (result.offline) {
      // PIN entries can't be recorded offline (no way to verify) — just report.
      if (pendingIdentity.current?.pin) { flash('noconn', ''); return }
      // Card: net died between capture and upload — keep the photo, record offline.
      const card = await lookupCard(pendingUid.current)
      const cur = await getState(pendingUid.current)
      const type = cur === 'checkin' ? 'checkout' : 'checkin'
      await commitOffline({ uid: pendingUid.current, name: card?.name ?? '', type, photoBase64: dataUrl })
      return
    }
    finishResult(result)
  }

  // --- feedback ---------------------------------------------------------------
  function flash(screenKey, personName, opts = {}) {
    if (!['camera', 'uploading', 'noconn'].includes(screenKey)) {
      addLog(pendingUid.current, screenKey, personName, opts.offline)
    }
    setSavedOffline(!!opts.offline)
    setScreen(screenKey)
    setName(personName)
    resetTimer.current = setTimeout(() => {
      setScreen('ready')
      setName('')
      setSavedOffline(false)
      processing.current = false
    }, RESET_DELAY)
  }

  function addLog(uid, result, personName, offline) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog(prev => [{ uid, result, personName, time, offline }, ...prev].slice(0, 10))
  }

  // --- render -----------------------------------------------------------------
  if (!nfcSupported) return (
    <Screen bg="var(--bg)">
      <div style={S.emoji}>⚠️</div>
      <div style={S.title}>NFC not supported</div>
      <div style={S.sub}>Use Android Chrome</div>
    </Screen>
  )

  if (screen === 'idle') return (
    <Screen bg="var(--bg)">
      <StatusBadge online={online} pending={pending} syncing={syncingUi} />
      <div style={S.emoji}>📡</div>
      <div style={S.title}>NFC Scanner</div>
      {error && <div style={S.errorBox}>{error}</div>}
      <button onClick={startScan} style={S.startBtn}>Start Scanning</button>
    </Screen>
  )

  if (screen === 'starting') return (
    <Screen bg="var(--bg)">
      <div style={S.emoji}>⏳</div>
      <div style={S.title}>Starting…</div>
    </Screen>
  )

  if (screen === 'camera') return (
    <Screen bg="var(--bg)">
      <StatusBadge online={online} pending={pending} syncing={syncingUi} />
      <div style={S.panel}>
        <div style={S.title}>Take a check-in photo</div>
        {cameraError ? (
          <>
            <div style={S.errorBox}>{cameraError}</div>
            <button onClick={() => cancelCamera('Camera unavailable')} style={S.startBtn}>Cancel</button>
          </>
        ) : (
          <>
            <video ref={videoRef} playsInline muted style={S.cameraVideo} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => cancelCamera('Photo cancelled')} style={S.cancelBtn}>Cancel</button>
              <button onClick={capturePhoto} style={S.startBtn}>📸 Capture</button>
            </div>
          </>
        )}
      </div>
    </Screen>
  )

  if (screen === 'uploading') return (
    <Screen bg="var(--bg)">
      <div style={S.emoji}>⏳</div>
      <div style={S.title}>Uploading…</div>
    </Screen>
  )

  if (screen === 'pin') return (
    <Screen bg="var(--bg)">
      <StatusBadge online={online} pending={pending} syncing={syncingUi} />
      <div style={S.panel}>
        <div style={S.title}>Enter PIN</div>
        <div style={S.pinDots}>{pinInput ? '•'.repeat(pinInput.length) : '—'}</div>
        <div style={S.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => setPinInput(p => (p.length < 6 ? p + d : p))} style={S.key}>{d}</button>
          ))}
          <button onClick={() => setPinInput(p => p.slice(0, -1))} style={S.key}>⌫</button>
          <button onClick={() => setPinInput(p => (p.length < 6 ? p + '0' : p))} style={S.key}>0</button>
          <button onClick={submitPin} disabled={pinInput.length < 4} style={{ ...S.key, ...S.keyOk, opacity: pinInput.length < 4 ? 0.4 : 1 }}>✓</button>
        </div>
        <button onClick={cancelPin} style={S.cancelBtn}>Cancel</button>
      </div>
    </Screen>
  )

  const bg    = { ready: 'var(--bg)', checkin: '#10b981', checkout: '#ef4444', unknown: '#f59e0b', expired: '#b45309', badpin: '#f59e0b', noconn: '#3f3f46' }[screen] ?? 'var(--bg)'
  const emoji = { ready: '📡', checkin: '✅', checkout: '🔴', unknown: '❓', expired: '⏰', badpin: '🔒', noconn: '📵' }[screen]
  const title = { ready: 'Tap your NFC card', checkin: 'CHECKED IN', checkout: 'CHECKED OUT', unknown: 'Card not registered', expired: 'Guest pass expired', badpin: 'Wrong PIN', noconn: 'No connection' }[screen]

  return (
    <Screen bg={bg}>
      <StatusBadge online={online} pending={pending} syncing={syncingUi} />
      <div style={S.panel}>
        <div style={S.emoji}>{emoji}</div>
        <div style={S.title}>{title}</div>
      </div>
      {name && <div style={S.name}>{name}</div>}

      {savedOffline && (screen === 'checkin' || screen === 'checkout') && (
        <div style={S.offlineNote}>💾 Elmentve offline · szinkron később</div>
      )}

      {screen === 'ready' && online && (
        <button onClick={openPinPad} style={S.pinBtn}>🔢 PIN</button>
      )}

      {screen === 'unknown' && lastUid && <div style={S.uidBox}>{lastUid}</div>}

      {screen === 'ready' && log.length > 0 && (
        <div style={S.logPanel}>
          {log.map((entry, i) => (
            <div key={i} style={{ ...S.logRow, opacity: i === 0 ? 1 : 0.45 }}>
              <span style={{ color: entry.result === 'checkin' ? '#10b981' : entry.result === 'checkout' ? '#ef4444' : '#f59e0b' }}>
                {entry.result === 'checkin' ? '↑ IN' : entry.result === 'checkout' ? '↓ OUT' : entry.result === 'expired' ? '⏰ EXP' : '? UNK'}
                {entry.personName ? ` ${entry.personName}` : ''}
                {entry.offline ? ' 💾' : ''}
              </span>
              <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.uid}</span>
              <span style={{ color: '#5b5b66', textAlign: 'right' }}>{entry.time}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}

function StatusBadge({ online, pending, syncing }) {
  return (
    <div style={S.badge}>
      <span style={{ ...S.badgeDot, background: online ? '#10b981' : '#f59e0b' }} />
      <span>{online ? 'Online' : 'Offline'}</span>
      {pending > 0 && (
        <span style={S.badgePending}>{syncing ? '⟳' : '•'} {pending} vár</span>
      )}
    </div>
  )
}

function Screen({ bg, children }) {
  return <div style={{ ...S.fullscreen, background: bg }}>{children}</div>
}

const MONO = "'JetBrains Mono', ui-monospace, monospace"

const S = {
  fullscreen: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', userSelect: 'none', position: 'relative', color: '#fff', padding: '1rem', boxSizing: 'border-box', transition: 'background 0.2s' },
  panel:      { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' },
  emoji:      { fontSize: 'clamp(4rem, 14vw, 7rem)', lineHeight: 1 },
  title:      { fontSize: 'clamp(1.7rem, 7vw, 3rem)', fontWeight: 800, textAlign: 'center', padding: '0 1rem', maxWidth: 720, letterSpacing: '-0.02em' },
  name:       { fontSize: 'clamp(1.35rem, 5.5vw, 2.2rem)', fontWeight: 600, opacity: 0.92, textAlign: 'center' },
  sub:        { fontSize: 'clamp(1rem, 3.6vw, 1.2rem)', opacity: 0.7, textAlign: 'center' },
  offlineNote:{ fontSize: 'clamp(0.85rem, 3.4vw, 1.05rem)', fontWeight: 600, background: 'rgba(0,0,0,0.3)', padding: '0.45rem 1rem', borderRadius: 999 },
  startBtn:   { marginTop: '0.5rem', padding: '1rem clamp(1.6rem, 8vw, 3rem)', fontSize: 'clamp(1rem, 4.4vw, 1.3rem)', fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-contrast)', border: 'none', borderRadius: 12, cursor: 'pointer', letterSpacing: '0.01em' },
  cancelBtn:  { marginTop: '0.5rem', padding: '1rem clamp(1.6rem, 8vw, 3rem)', fontSize: 'clamp(1rem, 4.4vw, 1.3rem)', fontWeight: 600, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, cursor: 'pointer' },
  errorBox:   { fontFamily: MONO, fontSize: '0.85rem', color: 'var(--red)', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1rem', borderRadius: 8, textAlign: 'center', maxWidth: '80%' },
  uidBox:     { fontFamily: MONO, fontSize: '0.95rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: 8, maxWidth: '92vw', wordBreak: 'break-all' },
  logPanel:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.75rem', background: 'rgba(8,8,10,0.72)', borderTop: '1px solid var(--border)', maxHeight: '34dvh', overflowY: 'auto', backdropFilter: 'blur(6px)' },
  logRow:     { display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', padding: '0.15rem 0', fontFamily: MONO },
  cameraVideo:{ width: 'min(92vw, 480px)', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 16, background: '#000', transform: 'scaleX(-1)', border: '1px solid var(--border)' },
  badge:      { position: 'absolute', top: '0.75rem', left: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(8,8,10,0.55)', border: '1px solid rgba(255,255,255,0.12)', padding: '0.35rem 0.75rem', borderRadius: 999, letterSpacing: '0.01em', backdropFilter: 'blur(6px)' },
  badgeDot:   { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  badgePending: { color: 'var(--warn)' },
  pinBtn:     { marginTop: '0.5rem', padding: '0.7rem 1.6rem', fontSize: 'clamp(0.95rem, 4vw, 1.15rem)', fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 999, cursor: 'pointer' },
  pinDots:    { fontSize: '2.4rem', letterSpacing: '0.4rem', minHeight: '3rem', fontWeight: 700, color: 'var(--text)', fontFamily: MONO },
  keypad:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', width: 'min(86vw, 320px)' },
  key:        { padding: '1rem 0', fontSize: '1.4rem', fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontFamily: MONO },
  keyOk:      { background: '#10b981', border: 'none', color: '#052e22' },
}
