import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  fmtTime, fmtMins, toYmd, dayLabel, rangeLabel,
  calcDayMins, groupByDay, groupRuns, countWorkdays,
  ABSENCE_LABELS, STATUS_LABELS, STATUS_COLORS, isSameDay,
} from './lib/format'
import { S, Button, SectionLabel, Card, Stat, Empty, Pill, FullScreen } from './components/ui'
import { PinPad } from './components/PinPad'
import { NotificationBell, NotificationsScreen } from './components/Notifications'
import { useSwipe } from './lib/useSwipe'

const FUNCTION_URL = import.meta.env.VITE_WORKER_FUNCTION_URL
const COMPANY_SLUG = import.meta.env.VITE_COMPANY_SLUG

// A képernyő személyes adatot mutat, az eszközt pedig többen használhatják.
// Tétlenség után visszatér a belépőképernyőre — adattakarékossági megfontolás.
const IDLE_TIMEOUT_MS = 120_000

const TABS = [
  { key: 'today',    label: 'Ma'        },
  { key: 'log',      label: 'Napló'     },
  { key: 'absences', label: 'Hiányzás'  },
]

export default function App() {
  // login → loading → profile | manager | error
  const [screen, setScreen] = useState('login')
  const [tab, setTab] = useState('today')
  const [data, setData] = useState(null)
  const [managerData, setManagerData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  // A munkamenet azonosítója: a további kérések (kérelem, visszavonás) ezzel
  // azonosítanak. Csak a memóriában él — kilépéskor és újratöltéskor elveszik.
  const [credential, setCredential] = useState(null)   // { pin } | { nfc_uid }

  const nfcSupported = 'NDEFReader' in window
  const urlUid = useMemo(() => new URLSearchParams(window.location.search).get('uid'), [])
  const idleTimer = useRef(null)
  const scanStarted = useRef(false)

  // ─── Belépés ───────────────────────────────────────────────────────────────

  const login = useCallback(async (cred) => {
    setScreen('loading')
    setErrorMsg('')
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cred, company_slug: COMPANY_SLUG }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(
          body.code === 'BAD_PIN'      ? 'Hibás PIN kód. Próbáld újra.' :
          body.code === 'UNKNOWN_CARD' ? 'Ez a kártya nincs nyilvántartva.' :
          (body.error ?? 'A belépés nem sikerült.')
        )
        setScreen('login')
        return
      }
      setCredential(cred)
      if (body.profile.role === 'manager' || body.profile.role === 'admin') {
        setManagerData({ profile: body.profile, allProfiles: body.allProfiles ?? [], recentEvents: body.recentEvents ?? [] })
        setScreen('manager')
      } else {
        setData({
          profile: body.profile,
          events: body.events ?? [],
          absences: body.absences ?? [],
          notifications: body.notifications ?? [],
        })
        setTab('today')
        setScreen('profile')
      }
    } catch {
      setErrorMsg('Nincs hálózati kapcsolat.')
      setScreen('login')
    }
  }, [])

  const logout = useCallback(() => {
    setData(null); setManagerData(null); setCredential(null)
    setErrorMsg(''); setTab('today')
    setScreen('login')
  }, [])

  // ─── Kártyás belépés (helyszíni kényelmi lehetőség) ────────────────────────
  // A beléptetés NEM itt történik — ez csak azonosítás, esemény nem jön létre.
  useEffect(() => {
    if (screen !== 'login' || scanStarted.current) return
    if (urlUid) { scanStarted.current = true; login({ nfc_uid: urlUid }); return }
    if (!nfcSupported) return

    scanStarted.current = true
    try {
      const ndef = new window.NDEFReader()
      ndef.onreading = ({ serialNumber }) => login({ nfc_uid: serialNumber })
      ndef.scan().catch(() => {})   // engedély megtagadva: marad a PIN
    } catch { /* nincs olvasó — a PIN önmagában elegendő */ }
  }, [screen, urlUid, nfcSupported, login])

  // ─── Tétlenségi kiléptetés ─────────────────────────────────────────────────
  const showsPersonalData = screen === 'profile' || screen === 'manager'

  useEffect(() => {
    if (!showsPersonalData) return
    const arm = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(logout, IDLE_TIMEOUT_MS)
    }
    arm()
    const evts = ['pointerdown', 'keydown', 'touchstart']
    evts.forEach(e => window.addEventListener(e, arm, { passive: true }))
    return () => {
      clearTimeout(idleTimer.current)
      evts.forEach(e => window.removeEventListener(e, arm))
    }
  }, [showsPersonalData, logout])

  // ─── Képernyők ─────────────────────────────────────────────────────────────

  if (screen === 'loading') return <FullScreen title="Belépés…" />

  if (screen === 'login') return (
    <LoginScreen onSubmit={pin => login({ pin })} error={errorMsg} nfcHint={nfcSupported && !urlUid} />
  )

  if (screen === 'manager') return <ManagerScreen {...managerData} onLogout={logout} />

  return (
    <WorkerScreen
      data={data} setData={setData} tab={tab} setTab={setTab}
      credential={credential} onLogout={logout}
    />
  )
}

// ─── Belépőképernyő ──────────────────────────────────────────────────────────

function LoginScreen({ onSubmit, error, nfcHint }) {
  return (
    <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: 'min(340px, 100%)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Dolgozói alkalmazás</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Add meg a PIN kódodat a saját adataid megtekintéséhez.
          </div>
        </div>

        <PinPad onSubmit={onSubmit} error={error} />

        {/* A kártya itt csak azonosít — be- és kiléptetni a beléptető
            alkalmazásnál lehet. Ezt ki kell mondani, különben az érintés
            jelenlét-rögzítésnek tűnhet. */}
        {nfcHint && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            A kártyád érintésével is beléphetsz.<br />
            <span style={{ opacity: 0.75 }}>A be- és kiléptetés a beléptető terminálon történik.</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dolgozói nézet ──────────────────────────────────────────────────────────

function WorkerScreen({ data, setData, tab, setTab, credential, onLogout }) {
  const { profile, events, absences, notifications } = data
  const isIn = events[0]?.type === 'checkin'
  const [notifOpen, setNotifOpen] = useState(false)

  // Lapozás a fülek között. A sorrend a fülsávét követi, és nem körkörös:
  // a szélső fülön túl nincs hova lapozni, ez adja vissza, hol tartunk.
  const tabIndex = TABS.findIndex(t => t.key === tab)
  const swipe = useSwipe({
    onLeft:  () => { if (tabIndex < TABS.length - 1) setTab(TABS[tabIndex + 1].key) },
    onRight: () => { if (tabIndex > 0)               setTab(TABS[tabIndex - 1].key) },
  })

  const days = useMemo(() => groupByDay(events), [events])
  const today = days.find(d => isSameDay(d.date, new Date()))
  const pendingCount = useMemo(
    () => groupRuns((absences ?? []).filter(a => a.status === 'pending')).length,
    [absences]
  )
  const unread = (notifications ?? []).filter(n => !n.read_at).length

  // A panel megnyitása olvasottnak jelöli az addigi értesítéseket. A jelölés
  // azonnal látszik a felületen; ha a hálózati hívás elbukik, a következő
  // belépéskor újra olvasatlanként jön vissza — ez a biztonságos irány.
  async function openNotifications() {
    setNotifOpen(true)
    if (unread === 0) return
    setData(d => ({
      ...d,
      notifications: d.notifications.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }),
    }))
    try {
      await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, company_slug: COMPANY_SLUG, action: 'mark_notifications_read' }),
      })
    } catch { /* a következő belépéskor újra olvasatlan lesz */ }
  }

  // Az értesítések teljes képernyőt kapnak: telefonon egy lenyíló doboz szűk
  // az indoklásoknak, és a görgetése ütközne a mögötte lévő tartalommal.
  if (notifOpen) {
    return <NotificationsScreen notifications={notifications ?? []} onBack={() => setNotifOpen(false)} />
  }

  return (
    <div style={S.page}>
      <Header
        profile={profile} isIn={isIn} onLogout={onLogout}
        unread={unread} onOpenNotif={openNotifications}
      />

      <nav style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '0.85rem 0.5rem', fontSize: '0.85rem', fontFamily: 'inherit',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--accent)' : 'var(--muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, minHeight: 48,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
            }}>
              {t.label}
              {/* Függő kérelmek jelzése — a dolgozó lássa, hogy van nyitott ügye */}
              {t.key === 'absences' && pendingCount > 0 && (
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, minWidth: 16, padding: '0.1rem 0.25rem',
                  background: 'var(--warn)', color: 'var(--bg)',
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <main {...swipe} style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {tab === 'today'    && <TodayTab today={today} days={days} />}
        {tab === 'log'      && <LogTab days={days} />}
        {tab === 'absences' && (
          <AbsencesTab
            absences={absences}
            credential={credential}
            onAdded={rows => setData(d => ({ ...d, absences: [...rows, ...d.absences] }))}
            onRemoved={ids => setData(d => ({ ...d, absences: d.absences.filter(a => !ids.includes(a.id)) }))}
          />
        )}
      </main>
    </div>
  )
}

function Header({ profile, isIn, onLogout, unread, onOpenNotif }) {
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '1rem', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
            {profile.department || 'Nincs műszak megadva'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <NotificationBell unread={unread} onOpen={onOpenNotif} />
          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)',
            padding: '0.5rem 0.8rem', fontSize: '0.78rem', fontFamily: 'inherit',
            cursor: 'pointer', borderRadius: 0, minHeight: 44,
          }}>
            Kijelentkezés
          </button>
        </div>
      </div>
      {/* Az állapotot a szín ÉS a szöveg is hordozza — színvakság mellett is olvasható */}
      <div style={{
        marginTop: '0.85rem', padding: '0.6rem 0.85rem',
        border: `1px solid color-mix(in srgb, ${isIn ? 'var(--green)' : 'var(--muted)'} 40%, transparent)`,
        background: `color-mix(in srgb, ${isIn ? 'var(--green)' : 'var(--muted)'} 10%, transparent)`,
        color: isIn ? 'var(--green)' : 'var(--muted)',
        fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.02em',
      }}>
        {isIn ? 'Jelenleg bent vagy' : 'Jelenleg nem vagy bent'}
      </div>
    </header>
  )
}

function TodayTab({ today, days }) {
  const evts = today?.events ?? []
  const firstIn = evts.find(e => e.type === 'checkin')
  const lastOut = [...evts].reverse().find(e => e.type === 'checkout')

  // Heti összesítő a betöltött (7 napos) ablakból
  const weekMins = days.reduce((s, d) => s + d.minutes, 0)
  const workDays = days.filter(d => d.minutes > 0).length

  return (
    <>
      <SectionLabel>Mai nap</SectionLabel>
      <Card>
        <div style={{ display: 'flex' }}>
          <Stat label="Érkezés" value={firstIn ? fmtTime(firstIn.timestamp) : '—'} accent="var(--green)" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <Stat label="Távozás" value={lastOut ? fmtTime(lastOut.timestamp) : '—'} accent="var(--red)" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <Stat label="Ledolgozva" value={fmtMins(today?.minutes ?? 0)} accent="var(--accent)" />
        </div>
      </Card>

      <SectionLabel right="az elmúlt 7 nap">Összesítő</SectionLabel>
      <Card>
        <div style={{ display: 'flex' }}>
          <Stat label="Ledolgozott idő" value={fmtMins(weekMins)} accent="var(--accent)" />
          <div style={{ width: 1, background: 'var(--border)' }} />
          <Stat label="Munkanap" value={String(workDays)} />
        </div>
      </Card>

      {evts.length > 0 && (
        <>
          <SectionLabel>Mai események</SectionLabel>
          <Card>
            {evts.map(e => <EventRow key={e.id} event={e} />)}
          </Card>
        </>
      )}
    </>
  )
}

const LOG_RANGES = [
  { key: 7,  label: '1 hét'   },
  { key: 30, label: '1 hónap' },
]

function LogTab({ days }) {
  const [range, setRange] = useState(7)

  // A szerver egy hónapnyi eseményt küld, ezért a nézetváltás nem igényel
  // újabb kérést — offline is működik, ha az adat már betöltődött.
  const cutoff = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (range - 1))
    return d
  }, [range])
  const shown = days.filter(d => d.date >= cutoff)

  const totalMins = shown.reduce((s, d) => s + d.minutes, 0)

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1rem 0' }}>
        {LOG_RANGES.map(r => {
          const active = range === r.key
          return (
            <button key={r.key} onClick={() => setRange(r.key)} style={{
              flex: 1, padding: '0.6rem', fontSize: '0.82rem', fontFamily: 'inherit',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--accent)' : 'var(--muted)',
              background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--border)'}`,
              borderRadius: 0, cursor: 'pointer', minHeight: 44,
            }}>
              {r.label}
            </button>
          )
        })}
      </div>

      {shown.length === 0
        ? <Empty>Ebben az időszakban nincs rögzített esemény.</Empty>
        : <LogList days={shown} totalMins={totalMins} />
      }
    </>
  )
}

function LogList({ days, totalMins }) {
  return (
    <>
      <SectionLabel right={`összesen ${fmtMins(totalMins)}`}>Napló</SectionLabel>
      {days.map(d => (
        <div key={d.key} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.4rem 1rem' }}>
            <span style={{ ...S.label, color: 'var(--text)' }}>{dayLabel(d.date)}</span>
            <span style={{ ...S.mono, fontSize: '0.8rem', color: d.minutes > 0 ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>
              {fmtMins(d.minutes)}
            </span>
          </div>
          <Card>
            {d.events.map(e => <EventRow key={e.id} event={e} />)}
          </Card>
        </div>
      ))}
    </>
  )
}

function EventRow({ event }) {
  const isIn = event.type === 'checkin'
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.75rem',
    }}>
      <span style={{ color: isIn ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: '0.88rem' }}>
        {isIn ? 'Belépés' : 'Kilépés'}
      </span>
      <span style={{ ...S.mono, color: 'var(--muted)', fontSize: '0.88rem' }}>{fmtTime(event.timestamp)}</span>
    </div>
  )
}

// ─── Hiányzások ──────────────────────────────────────────────────────────────

function AbsencesTab({ absences, credential, onAdded, onRemoved }) {
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(null)   // a visszavonás alatt álló tétel ids-e
  const [from, setFrom] = useState(() => toYmd(new Date()))
  const [to, setTo] = useState(() => toYmd(new Date()))
  const [type, setType] = useState('vacation')
  const [note, setNote] = useState('')
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [status, setStatus] = useState(null)   // null | 'saving' | 'ok'
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const runs = useMemo(() => groupRuns(absences), [absences])
  const previewDays = countWorkdays(from, to, skipWeekends)
  const invalidRange = !from || !to || to < from

  // A záró dátum követi a kezdőt, ha az elé csúszna — így nem lehet
  // véletlenül érvénytelen tartományt beküldeni.
  function changeFrom(v) {
    setFrom(v)
    if (to < v) setTo(v)
  }

  async function submit() {
    setStatus('saving'); setError('')
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credential,
          company_slug: COMPANY_SLUG,
          action: 'submit_absence',
          absence: { date_from: from, date_to: to, type, note: note.trim() || null, skip_weekends: skipWeekends },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? 'Nem sikerült beküldeni.'); setStatus(null); return }

      onAdded(body.absences ?? [])
      setOkMsg(body.skipped > 0
        ? `${body.created} nap beküldve, ${body.skipped} nap kimaradt (már volt rá bejegyzés). A vezetőd fog dönteni róla.`
        : `${body.created} nap beküldve. A vezetőd fog dönteni róla.`)
      setStatus('ok'); setOpen(false); setNote('')
    } catch {
      setError('Nincs hálózati kapcsolat.'); setStatus(null)
    }
  }

  // Csak a még el nem bírált kérelem vonható vissza. A szerver ezt külön
  // ellenőrzi — a felületi elrejtés önmagában nem védelem.
  async function cancelRun(run) {
    setCancelling(run.ids); setError(''); setStatus(null)
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credential,
          company_slug: COMPANY_SLUG,
          action: 'cancel_absence',
          absence_ids: run.ids,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? 'A visszavonás nem sikerült.'); setCancelling(null); return }
      onRemoved(body.removed ?? run.ids)
      setOkMsg('A kérelem visszavonva.')
      setStatus('ok')
    } catch {
      setError('Nincs hálózati kapcsolat.')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <>
      <SectionLabel>Hiányzásaim</SectionLabel>
      <Card>
        {runs.length === 0
          ? <Empty>Nincs rögzített hiányzásod.</Empty>
          : runs.map((r, i) => (
              <AbsenceRow
                key={i} run={r}
                onCancel={() => cancelRun(r)}
                busy={cancelling === r.ids}
              />
            ))
        }
      </Card>

      {error && !open && (
        <div style={{ margin: '0.85rem 1rem 0', color: 'var(--red)', fontSize: '0.82rem' }}>{error}</div>
      )}

      {status === 'ok' && (
        <div style={{ margin: '0.85rem 1rem 0', padding: '0.7rem 0.85rem', border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)', background: 'color-mix(in srgb, var(--green) 10%, transparent)', color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>
          {okMsg}
        </div>
      )}

      <div style={{ padding: '1rem' }}>
        {!open
          ? <Button variant="primary" onClick={() => { setOpen(true); setStatus(null); setError('') }}>Hiányzás bejelentése</Button>
          : (
            <Card style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <label style={{ display: 'block', minWidth: 0 }}>
                  <span style={S.label}>Kezdete</span>
                  <input type="date" value={from} onChange={e => changeFrom(e.target.value)} style={{ ...S.input, marginTop: '0.3rem' }} />
                </label>
                <label style={{ display: 'block', minWidth: 0 }}>
                  <span style={S.label}>Vége</span>
                  <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={{ ...S.input, marginTop: '0.3rem' }} />
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
                Hétvégék kihagyása
              </label>

              <label style={{ display: 'block' }}>
                <span style={S.label}>Típus</span>
                <select value={type} onChange={e => setType(e.target.value)} style={{ ...S.input, marginTop: '0.3rem' }}>
                  <option value="vacation">Szabadság</option>
                  <option value="sick">Betegszabadság</option>
                  <option value="other">Egyéb</option>
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <span style={S.label}>Megjegyzés (nem kötelező)</span>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="például: orvosi vizsgálat" style={{ ...S.input, marginTop: '0.3rem' }} />
              </label>

              {/* Előnézet: a dolgozó a beküldés ELŐTT lássa, hány napot jelent be */}
              <div style={{ fontSize: '0.82rem', color: invalidRange ? 'var(--red)' : 'var(--muted)' }}>
                {invalidRange
                  ? 'A záró dátum nem lehet korábbi a kezdőnél.'
                  : <>Bejelentendő: <strong style={{ color: 'var(--accent)' }}>{previewDays} nap</strong>{skipWeekends ? ' (hétvégék nélkül)' : ''}</>
                }
              </div>

              {error && <div style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{error}</div>}

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Button onClick={() => { setOpen(false); setError('') }}>Mégse</Button>
                <Button variant="primary" onClick={submit} disabled={status === 'saving' || invalidRange || previewDays === 0}>
                  {status === 'saving' ? 'Küldés…' : 'Beküldés'}
                </Button>
              </div>
            </Card>
          )
        }
      </div>
    </>
  )
}

function AbsenceRow({ run, onCancel, busy }) {
  const past = new Date(run.to + 'T23:59:59') < new Date()
  const isPending = run.status === 'pending'
  // Az elbírált, múltbeli tételek halványabbak; a függő kérelem mindig
  // teljes erősséggel látszik, mert még teendő van vele.
  const dim = past && !isPending

  return (
    <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', opacity: dim ? 0.55 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{rangeLabel(run.from, run.to)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {ABSENCE_LABELS[run.type] ?? run.type} · {run.days} nap{run.note ? ` · ${run.note}` : ''}
          </div>
        </div>
        <Pill color={STATUS_COLORS[run.status] ?? 'var(--muted)'}>
          {STATUS_LABELS[run.status] ?? run.status}
        </Pill>
      </div>

      {/* A vezető indoklása elutasításkor — enélkül a döntés érthetetlen */}
      {run.status === 'rejected' && run.decisionNote && (
        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.6rem', fontSize: '0.78rem', color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)', lineHeight: 1.5 }}>
          Indoklás: {run.decisionNote}
        </div>
      )}

      {isPending && (
        <button onClick={onCancel} disabled={busy} style={{
          marginTop: '0.6rem', width: '100%', padding: '0.55rem',
          fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600,
          background: 'transparent', color: 'var(--red)',
          border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
          borderRadius: 0, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, minHeight: 40,
        }}>
          {busy ? 'Visszavonás…' : 'Kérelem visszavonása'}
        </button>
      )}
    </div>
  )
}

// ─── Vezetői gyorsnézet ──────────────────────────────────────────────────────
// Nem a vezetői felület helyettesítése: csak az a kérdés, hogy ebben a
// pillanatban ki van bent. Bármi több a dashboardra tartozik.

function ManagerScreen({ profile, allProfiles, recentEvents, onLogout }) {
  const latest = {}
  for (const e of recentEvents) if (!latest[e.user_id]) latest[e.user_id] = e

  const workers = allProfiles.filter(p => p.role === 'worker')
  const inside  = workers.filter(p => latest[p.id]?.type === 'checkin')
  const outside = workers.filter(p => latest[p.id]?.type !== 'checkin')

  return (
    <div style={S.page}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Jelenlét</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{profile.name}</div>
        </div>
        <Pill color="var(--green)">{inside.length} / {workers.length} bent</Pill>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
        <SectionLabel right={`${inside.length} fő`}>Bent</SectionLabel>
        <Card>
          {inside.length === 0
            ? <Empty>Jelenleg senki nincs bent.</Empty>
            : inside.map(p => <PersonRow key={p.id} person={p} inside event={latest[p.id]} />)
          }
        </Card>

        <SectionLabel right={`${outside.length} fő`}>Kint</SectionLabel>
        <Card>
          {outside.length === 0
            ? <Empty>Mindenki bent van.</Empty>
            : outside.map(p => <PersonRow key={p.id} person={p} event={latest[p.id]} />)
          }
        </Card>
      </main>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <Button onClick={onLogout}>Kijelentkezés</Button>
      </div>
    </div>
  )
}

function PersonRow({ person, inside, event }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 6, height: 32, background: inside ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
        {person.department && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{person.department}</div>}
      </div>
      {event && (
        <span style={{ ...S.mono, fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>
          {isSameDay(new Date(event.timestamp), new Date()) ? fmtTime(event.timestamp) : dayLabel(new Date(event.timestamp))}
        </span>
      )}
    </div>
  )
}
