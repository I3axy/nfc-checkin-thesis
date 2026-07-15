import { useState, useRef } from 'react'

const RESET_DELAY = 3000
const CAMERA_TIMEOUT = 20000
const FUNCTION_URL = import.meta.env.VITE_CHECKIN_FUNCTION_URL
const COMPANY_SLUG = import.meta.env.VITE_COMPANY_SLUG

export default function App() {
  const [screen, setScreen] = useState('idle')   // idle | starting | ready | checkin | checkout | unknown | camera | uploading
  const [name, setName] = useState('')
  const [lastUid, setLastUid] = useState('')
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [log, setLog] = useState([])
  const nfcSupported = 'NDEFReader' in window
  const processing = useRef(false)
  const resetTimer = useRef(null)
  const pendingUid = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cameraTimeout = useRef(null)

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

  async function callCheckin(uid, photoBase64) {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfc_uid: uid, company_slug: COMPANY_SLUG, ...(photoBase64 ? { photo_base64: photoBase64 } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, code: data.code, error: data.error }
      if (data.needs_photo) return { ok: true, needsPhoto: true, user: data.user }
      return { ok: true, event: data.event, user: data.user }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }

  async function handleCard(uid) {
    if (processing.current) return
    processing.current = true
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setLastUid(uid)
    pendingUid.current = uid

    const result = await callCheckin(uid, null)
    if (result.ok && result.needsPhoto) {
      openCamera()
      return
    }
    finishResult(result)
  }

  function finishResult(result) {
    if (!result.ok) {
      if (result.code === 'UNKNOWN_CARD') {
        addLog(pendingUid.current, 'unknown', '')
        flash('unknown', '')
      } else {
        addLog(pendingUid.current, 'error', result.error ?? 'Error')
        flash('unknown', '')
      }
      return
    }
    addLog(pendingUid.current, result.event.type, result.user.name)
    flash(result.event.type, result.user.name)
  }

  async function openCamera() {
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
      setCameraError(err.message || 'Camera unavailable')
    }
  }

  function stopCameraStream() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (cameraTimeout.current) { clearTimeout(cameraTimeout.current); cameraTimeout.current = null }
  }

  function cancelCamera(reason) {
    stopCameraStream()
    addLog(pendingUid.current, 'error', reason || 'Photo cancelled')
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
    setScreen('uploading')
    const result = await callCheckin(pendingUid.current, dataUrl)
    finishResult(result)
  }

  function addLog(uid, result, personName) {
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
      {error && (
        <div style={S.errorBox}>{error}</div>
      )}
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

  if (screen === 'camera') return (
    <Screen bg="#060c18">
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
    <Screen bg="#060c18">
      <div style={S.emoji}>⏳</div>
      <div style={S.title}>Uploading…</div>
    </Screen>
  )

  const bg    = { ready: '#060c18', checkin: '#10b981', checkout: '#ef4444', unknown: '#f59e0b' }[screen] ?? '#060c18'
  const emoji = { ready: '📡', checkin: '✅', checkout: '🔴', unknown: '❓' }[screen]
  const title = { ready: 'Tap your NFC card', checkin: 'CHECKED IN', checkout: 'CHECKED OUT', unknown: 'Card not registered' }[screen]

  return (
    <Screen bg={bg}>
      <div style={S.panel}>
        <div style={S.emoji}>{emoji}</div>
        <div style={S.title}>{title}</div>
      </div>
      {name && <div style={S.name}>{name}</div>}

      {screen === 'unknown' && lastUid && (
        <div style={S.uidBox}>{lastUid}</div>
      )}

      {screen === 'ready' && log.length > 0 && (
        <div style={S.logPanel}>
          {log.map((entry, i) => (
            <div key={i} style={{ ...S.logRow, opacity: i === 0 ? 1 : 0.45 }}>
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
    <div style={{ ...S.fullscreen, background: bg }}>
      {children}
    </div>
  )
}

const S = {
  fullscreen: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', userSelect: 'none', position: 'relative', color: '#fff', padding: '1rem', boxSizing: 'border-box', transition: 'background 0.2s' },
  panel:      { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' },
  emoji:      { fontSize: 'clamp(4rem, 14vw, 7rem)', lineHeight: 1 },
  title:      { fontSize: 'clamp(1.7rem, 7vw, 3rem)', fontWeight: 800, textAlign: 'center', padding: '0 1rem', maxWidth: 720 },
  name:       { fontSize: 'clamp(1.35rem, 5.5vw, 2.2rem)', fontWeight: 600, opacity: 0.9, textAlign: 'center' },
  sub:        { fontSize: 'clamp(1rem, 3.6vw, 1.2rem)', opacity: 0.7, textAlign: 'center' },
  startBtn:   { marginTop: '0.5rem', padding: '1rem clamp(1.6rem, 8vw, 3rem)', fontSize: 'clamp(1rem, 4.4vw, 1.3rem)', fontWeight: 800, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.02em' },
  cancelBtn:  { marginTop: '0.5rem', padding: '1rem clamp(1.6rem, 8vw, 3rem)', fontSize: 'clamp(1rem, 4.4vw, 1.3rem)', fontWeight: 700, background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.35)', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.02em' },
  errorBox:   { fontFamily: 'monospace', fontSize: '0.85rem', color: '#fca5a5', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1rem', borderRadius: '4px', textAlign: 'center', maxWidth: '80%' },
  uidBox:     { fontFamily: 'monospace', fontSize: '0.95rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', maxWidth: '92vw', wordBreak: 'break-all' },
  logPanel:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.75rem', background: 'rgba(0,0,0,0.55)', maxHeight: '34dvh', overflowY: 'auto' },
  logRow:     { display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', padding: '0.15rem 0', fontFamily: 'monospace' },
  cameraVideo:{ width: 'min(92vw, 480px)', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: '8px', background: '#000', transform: 'scaleX(-1)' },
}
