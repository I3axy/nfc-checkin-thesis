import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, R, tint } from '../lib/theme'
import { saveTheme, loadTheme, settingsToCompany } from '../lib/settings'
import { toast } from '../components/toast'
import { Table, SectionLabel, Badge, SettingsRow, Modal } from '../components/ui'

// Preview swatches are literal colors so each card always shows its own theme,
// regardless of which theme is currently active.
const THEMES = [
  { key: 'dark',  label: 'Sötét',   desc: 'Alapértelmezett — sötét felület',  pv: { bg: '#0b0b0d', surface: '#131316', border: '#26262c', accent: '#818cf8' } },
  { key: 'light', label: 'Világos', desc: 'Fehér alapú, nappali használatra', pv: { bg: '#f7f7f8', surface: '#ffffff', border: '#e4e4e9', accent: '#4f46e5' } },
]

function Toggle({ on, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0,
      background: on ? C.green : C.border, position: 'relative', transition: 'background 0.15s', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
    </button>
  )
}

const ROLE_LABELS = { manager: 'Manager', admin: 'Admin', worker: 'Worker', guest: 'Vendég' }

export function SettingsTab({ settings, companyId, me, employees = [], onChange }) {
  const [startHour,     setStartHour]     = useState(settings.startHour)
  const [startMinute,   setStartMinute]   = useState(settings.startMinute)
  const [lateThreshold, setLateThreshold] = useState(settings.lateThresholdMinutes)
  const [autoCheckout,  setAutoCheckout]  = useState(settings.autoCheckoutHour)
  const [shiftHours,    setShiftHours]    = useState(() => settings.autoCheckoutByShift ?? {})

  // A ténylegesen használatban lévő műszakok. Kiegészítjük azokkal, amikre már
  // van mentett felülírás — különben egy időközben kiürült műszak beállítása
  // láthatatlanul, de érvényben maradna.
  const shifts = useMemo(() => {
    const used = employees.filter(e => e.role !== 'guest').map(e => e.department).filter(Boolean)
    return [...new Set([...used, ...Object.keys(settings.autoCheckoutByShift ?? {})])].sort()
  }, [employees, settings.autoCheckoutByShift])
  const [photoRequired, setPhotoRequired] = useState(settings.photoRequired ?? false)
  const [pinPhotoRequired, setPinPhotoRequired] = useState(settings.pinPhotoRequired ?? false)
  const [cardSelfEnroll, setCardSelfEnroll] = useState(settings.cardSelfEnroll ?? true)
  // Read the theme from its real source (localStorage) — the App-level settings
  // state isn't updated by the instant theme switch, so it can go stale.
  const [theme,         setTheme]         = useState(() => loadTheme())
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState('')
  const [pwSent,        setPwSent]        = useState(false)
  const [sending,       setSending]       = useState(false)
  const [digestMsg,     setDigestMsg]     = useState('')
  // A napi összesítő címzettjei. `choices` a választható címek (a cég vezetői
  // fiókjai), `picked` a kiválasztottak — a null itt azt jelenti, hogy még nem
  // töltődött be, az üres tömb pedig azt, hogy senkinek nem megy levél.
  const [choices,       setChoices]       = useState(null)
  const [picked,        setPicked]        = useState(null)
  const [savingRcpt,    setSavingRcpt]    = useState(false)
  const [rcptOpen,      setRcptOpen]      = useState(false)
  const [rcptBusy,      setRcptBusy]      = useState(false)
  const [rcptError,     setRcptError]     = useState('')

  // A címzettlista betöltése. Az e-mail címek csak szerveroldalon érhetők el
  // (a hitelesítési fiókok adatai), ezért a küldő függvény adja vissza őket.
  const loadRecipients = useCallback(async () => {
    if (!companyId) return
    setRcptBusy(true); setRcptError('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, action: 'diagnose' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!Array.isArray(d.valaszthato)) {
        setRcptError('A send-alerts függvény régi változata fut. Telepítsd újra: supabase functions deploy send-alerts --no-verify-jwt')
        return
      }
      setChoices(d.valaszthato)
      // A null a szerveren azt jelenti: mindenki. A felületen ezt minden
      // jelölőnégyzet bejelölése mutatja, így a két állapot nem keveredik.
      setPicked(d.kivalasztott === null
        ? d.valaszthato.map(v => v.email)
        : d.kivalasztott)
      // A vezetői profilok akkor is érdekesek, ha nem lett belőlük címzett:
      // ebből derül ki, hogy a profil rendben van, és a hitelesítési oldalon
      // akadt el a keresés.
      if (d.valaszthato.length === 0) {
        const m = d.manager_vagy_admin ?? []
        setRcptError(
          m.length === 0
            ? 'Nincs manager vagy admin szerepkörű profil ebben a cégben.'
            : `${m.length} vezetői profil van (${m.map(x => `${x.nev} — ${x.van_fiokja ? 'van fiókja' : 'nincs fiókja'}`).join('; ')}), ` +
              `de egyikhez sem sikerült e-mail címet találni.` +
              (d.auth_lista_hiba ? ` Hiba: ${d.auth_lista_hiba}` : ''),
        )
      }
    } catch (e) {
      setRcptError('Hálózati hiba: ' + e.message)
    } finally { setRcptBusy(false) }
  }, [companyId])

  useEffect(() => { loadRecipients() }, [loadRecipients])

  async function saveRecipients(next) {
    setPicked(next)
    setSavingRcpt(true)
    const { error } = await supabase
      .from('companies')
      .update({ digest_recipients: next })
      .eq('id', companyId)
    setSavingRcpt(false)
    if (error) { toast('A címzettek mentése nem sikerült', 'error'); loadRecipients(); return }
    toast(next.length ? `Címzettek mentve (${next.length})` : 'A napi összesítő kikapcsolva')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!companyId) { setError('A cég azonosító még töltődik, próbáld újra egy pillanat múlva'); return }
    setSaving(true); setError('')

    const next = {
      startHour, startMinute, lateThresholdMinutes: lateThreshold,
      autoCheckoutHour: autoCheckout, autoCheckoutByShift: shiftHours,
      photoRequired, pinPhotoRequired, cardSelfEnroll, theme,
    }
    const { data, error } = await supabase.from('companies').update(settingsToCompany(next)).eq('id', companyId).select()
    setSaving(false)
    if (error) { setError(error.message); toast('A beállítások mentése nem sikerült', 'error'); return }
    if (!data || data.length === 0) { setError('A mentés nem sikerült (jogosultság hiánya). Ellenőrizd, hogy manager/admin szerepkörrel vagy bejelentkezve.'); toast('A beállítások mentése nem sikerült', 'error'); return }

    saveTheme(theme)
    // A szerverre ténylegesen kiment, megtisztított leképezést vesszük át,
    // hogy a felület ne mutasson mást, mint ami elmentésre került.
    const savedShifts = data[0]?.auto_checkout_by_shift ?? {}
    setShiftHours(savedShifts)
    onChange({
      startHour: Number(startHour), startMinute: Number(startMinute),
      lateThresholdMinutes: Number(lateThreshold), autoCheckoutHour: Number(autoCheckout),
      autoCheckoutByShift: savedShifts,
      photoRequired, pinPhotoRequired, cardSelfEnroll, theme,
    })
    setSaved(true)
    toast('Beállítások elmentve')
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSendDigest() {
    if (!companyId) { setDigestMsg('A cég azonosító még töltődik, próbáld újra'); return }
    setSending(true); setDigestMsg('')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setDigestMsg('Hiba: ' + (data.error ?? res.status)); toast('Az email küldése nem sikerült', 'error') }
      else if (data.errors?.length) { setDigestMsg(`Küldve: ${data.sent}. Resend válasz: ${data.errors[0]}`); toast('Az email küldése részben sikertelen', 'error') }
      // A nulla elküldött levél nem siker. Korábban zöld visszajelzést kapott,
      // holott a levélnek nem volt címzettje — a szerver most megmondja, miért.
      else if (!data.sent) {
        setDigestMsg(data.skipped?.[0] ?? 'Nem ment ki levél: nincs címzett.')
        toast('Nem ment ki levél', 'error')
      }
      else { setDigestMsg(`✓ Elküldve (${data.sent} email)`); toast(`Napi összesítő elküldve (${data.sent} email)`) }
    } catch (e) {
      setDigestMsg('Hálózati hiba: ' + e.message)
      toast('Hálózati hiba az email küldésekor', 'error')
    } finally {
      setSending(false)
    }
  }

  async function handlePasswordReset() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return
    // A visszairányítás nélkül a szolgáltatás a projekt alapcímére küld, ahol
    // a hivatkozás csak beléptet — a jelszóbeállító képernyő így soha nem
    // jelenne meg. Ez volt a korábbi hiba oka.
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    })
    setPwSent(true)
    setTimeout(() => setPwSent(false), 8000)
  }

  return (
    // Two columns: editable company settings on the left, read-only /
    // one-off actions (notifications, account) on the right.
    <form onSubmit={handleSave} className="stack-phone" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '2rem', alignItems: 'start', maxWidth: 1200 }}>
      <div>
      <SectionLabel color={C.accent}>Munkaidő szabályok</SectionLabel>
      <Table>
        <tbody>
          <SettingsRow label="Munkaidő kezdete">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="number" min="0" max="23" value={startHour} onChange={e => setStartHour(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ color: C.muted }}>:</span>
              <input type="number" min="0" max="59" step="5" value={startMinute} onChange={e => setStartMinute(e.target.value)} style={{ ...S.input, width: 70 }} />
            </div>
          </SettingsRow>
          <SettingsRow label="Késés küszöb" hint="ennyi perccel a kezdés után számít késésnek">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="number" min="0" max="120" value={lateThreshold} onChange={e => setLateThreshold(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ fontSize: '0.8rem', color: C.muted }}>perc</span>
            </div>
          </SettingsRow>
          <SettingsRow label="Auto checkout" hint="alapértelmezés — ennél később senki sem maradhat bent">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="number" min="0" max="23" value={autoCheckout} onChange={e => setAutoCheckout(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ fontSize: '0.8rem', color: C.muted }}>:00</span>
            </div>
          </SettingsRow>
        </tbody>
      </Table>

      {/* Műszakonkénti felülírás. Az éjszakás műszak reggel végez, a nappali
          délután — egyetlen közös órával az egyik mindig rosszul zárulna. */}
      {shifts.length > 0 && (
        <>
          <div style={{ height: '1.5rem' }} />
          <SectionLabel color={C.accent}>Auto checkout műszakonként</SectionLabel>
          <div style={{ fontSize: '0.75rem', color: C.muted, margin: '0 0 0.6rem', lineHeight: 1.5 }}>
            Üresen hagyva a fenti alapértelmezés ({String(autoCheckout).padStart(2, '0')}:00) érvényes.
            Az éjszakás műszaknál reggeli óra is megadható — a rendszer a belépéstől
            számított 24 órán belül zárja le a nyitva maradt napot.
          </div>
          <Table>
            <tbody>
              {shifts.map(shift => {
                const val = shiftHours[shift] ?? ''
                const overridden = val !== '' && val !== null && val !== undefined
                return (
                  <SettingsRow key={shift} label={shift}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number" min="0" max="23"
                        value={val}
                        placeholder={String(autoCheckout).padStart(2, '0')}
                        onChange={e => setShiftHours(prev => {
                          const next = { ...prev }
                          if (e.target.value === '') delete next[shift]
                          else next[shift] = Number(e.target.value)
                          return next
                        })}
                        style={{ ...S.input, width: 70, borderColor: overridden ? tint(C.accent, 45) : C.border }}
                      />
                      <span style={{ fontSize: '0.8rem', color: C.muted }}>:00</span>
                      {overridden && (
                        <button type="button" onClick={() => setShiftHours(prev => { const n = { ...prev }; delete n[shift]; return n })}
                          style={{ ...S.btnIcon, fontSize: '0.7rem', color: C.muted }} title="Vissza az alapértelmezésre">
                          ↺
                        </button>
                      )}
                    </div>
                  </SettingsRow>
                )
              })}
            </tbody>
          </Table>
        </>
      )}

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Fotó check-in</SectionLabel>
      <Table>
        <tbody>
          <SettingsRow label="Fotó kötelező" hint="a scanner check-in előtt szelfit kér (anti-fraud)">
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.78rem', color: photoRequired ? C.green : C.muted, minWidth: 24 }}>{photoRequired ? 'Be' : 'Ki'}</span>
              <Toggle on={photoRequired} onClick={() => setPhotoRequired(v => !v)} />
            </div>
          </SettingsRow>
          <SettingsRow label="PIN-nél fotó kötelező" hint="a PIN megosztható, ezért PIN-belépésnél külön kérhető fotó">
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.78rem', color: pinPhotoRequired ? C.green : C.muted, minWidth: 24 }}>{pinPhotoRequired ? 'Be' : 'Ki'}</span>
              <Toggle on={pinPhotoRequired} onClick={() => setPinPhotoRequired(v => !v)} />
            </div>
          </SettingsRow>
        </tbody>
      </Table>

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Kártya párosítása</SectionLabel>
      <Table>
        <tbody>
          <SettingsRow
            label="Dolgozó párosíthatja a kártyáját"
            hint="PIN-es belépés után a scanner felajánlja a kártya hozzárendelését, ha a dolgozónak még nincs. Meglévő kártyát nem írhat felül."
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.78rem', color: cardSelfEnroll ? C.green : C.muted, minWidth: 24 }}>{cardSelfEnroll ? 'Be' : 'Ki'}</span>
              <Toggle on={cardSelfEnroll} onClick={() => setCardSelfEnroll(v => !v)} />
            </div>
          </SettingsRow>
        </tbody>
      </Table>

      </div>

      {/* ── Right column ─────────────────────────────────────────────── */}
      <div>
      <SectionLabel color={C.accent}>Értesítések</SectionLabel>
      <Table>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted }}>
              Napi összesítő
              {/* Telefonon a magyarázó oszlop kimarad, ezért a címzettek száma
                  ide is kikerül — enélkül a beállítás állapota csak az ablak
                  megnyitásával volna ellenőrizhető. */}
              {picked !== null && (
                <div className="only-phone" style={{ fontSize: '0.72rem', marginTop: '0.15rem', color: picked.length === 0 ? C.warn : C.muted }}>
                  {picked.length === 0 ? 'nincs címzett' : `${picked.length} címzett`}
                </div>
              )}
            </td>
            <td className="col-secondary" style={{ ...S.td, fontSize: '0.78rem', color: C.muted }}>
              Jelenléti riport
              {picked !== null && (
                <span style={{ color: picked.length === 0 ? C.warn : C.muted }}>
                  {' · '}{picked.length === 0 ? 'nincs címzett' : `${picked.length} címzett`}
                </span>
              )}
            </td>
            {/* A két gomb telefonon egymás alá kerül, különben kiszorítanák
                egymást a sorból. */}
            <td style={{ ...S.td, textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setRcptOpen(true)} style={S.btnSecondary}>Címzettek</button>
                <button type="button" onClick={handleSendDigest} disabled={sending || picked?.length === 0} style={{ ...S.btnSecondary, opacity: picked?.length === 0 ? 0.5 : 1 }}>
                  {sending ? 'Küldés…' : 'Küldés most →'}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>

      {digestMsg && <div style={{ fontSize: '0.78rem', color: digestMsg.startsWith('✓') ? C.green : C.warn, marginTop: '0.5rem', wordBreak: 'break-word' }}>{digestMsg}</div>}

      {/* Címzettek. Csak a cég vezetői fiókjaihoz tartozó címek választhatók:
          a küldő végpont hitelesítés nélkül hívható, ezért szabadon megadható
          cím esetén a rendszer levéltovábbítóként volna felhasználható. */}
      {rcptOpen && (
        <Modal
          title="Napi összesítő — címzettek"
          onClose={() => setRcptOpen(false)}
          headerRight={
            <button
              type="button"
              onClick={loadRecipients}
              disabled={rcptBusy}
              title="Lista frissítése"
              style={{
                background: 'none', border: 'none', cursor: rcptBusy ? 'default' : 'pointer',
                color: C.muted, fontSize: '1rem', lineHeight: 1, padding: '0.2rem 0.35rem',
                borderRadius: R.sm,
                // Forgás töltés közben — enélkül nem volna látható, hogy a
                // kattintás egyáltalán elindított valamit.
                animation: rcptBusy ? 'nfc-spin 0.8s linear infinite' : 'none',
                display: 'inline-block',
              }}
            >
              ⟳
            </button>
          }
        >
          {rcptBusy && choices === null ? (
            <div style={{ color: C.muted, fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>Betöltés…</div>
          ) : (
            <>
              <div style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.55, marginBottom: '0.9rem' }}>
                A lista a cég vezetői fiókjait tartalmazza. Más cím nem adható meg: a levelet küldő
                végpont hitelesítés nélkül hívható, ezért csak ismert fiókokhoz tartozó címre küld.
              </div>

              {rcptError && (
                <div style={{ ...S.errorBox, marginBottom: '0.9rem', whiteSpace: 'pre-wrap' }}>{rcptError}</div>
              )}

              {(choices ?? []).length === 0 ? (
                !rcptError && <div style={{ fontSize: '0.85rem', color: C.muted }}>Nincs megjeleníthető fiók.</div>
              ) : (
                <>
                  {choices.map(c => {
                    const on = picked?.includes(c.email)
                    const self = me?.email && c.email?.toLowerCase() === me.email.toLowerCase()
                    return (
                      <label key={c.email} style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem 0.7rem', cursor: savingRcpt ? 'default' : 'pointer',
                        border: `1px solid ${on ? tint(C.accent, 35) : C.border}`,
                        background: on ? tint(C.accent, 7) : 'transparent',
                        marginBottom: '0.4rem',
                      }}>
                        <input
                          type="checkbox"
                          checked={!!on}
                          disabled={savingRcpt}
                          onChange={() => saveRecipients(
                            on ? picked.filter(e => e !== c.email) : [...(picked ?? []), c.email],
                          )}
                          style={{ accentColor: C.accent, width: 16, height: 16, flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '0.85rem', color: C.text, minWidth: 0, wordBreak: 'break-word' }}>
                          {c.email}
                          {c.nev && <span style={{ color: C.muted }}> · {c.nev}</span>}
                          {/* A saját cím megjelölése: ez az, amit a vezető biztosan olvas */}
                          {self && <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', color: C.accent, border: `1px solid ${tint(C.accent, 30)}`, padding: '0.05rem 0.3rem', fontWeight: 700, whiteSpace: 'nowrap' }}>SAJÁT</span>}
                        </span>
                      </label>
                    )
                  })}

                  <div style={{ fontSize: '0.75rem', color: picked?.length === 0 ? C.warn : C.muted, marginTop: '0.8rem', lineHeight: 1.5 }}>
                    {picked?.length === 0
                      ? 'Nincs kiválasztva senki — a napi összesítő így nem megy ki. Ezzel kikapcsolható a napi levél.'
                      : `A napi levél ${picked.length} címre megy ki. A módosítás azonnal mentésre kerül.`}
                  </div>
                </>
              )}
            </>
          )}
        </Modal>
      )}

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Fiók</SectionLabel>
      <Table>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted }}>Bejelentkezve</td>
            <td style={{ ...S.td, fontWeight: 700 }} colSpan={2}>
              {me?.email ?? '…'}
              {me?.name && <span style={{ fontWeight: 400, color: C.muted }}> · {me.name}</span>}
            </td>
          </tr>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted }}>Szerepkör</td>
            <td style={{ ...S.td }} colSpan={2}>
              {me?.role
                ? <Badge color={me.role === 'admin' ? C.accent : C.green}>{ROLE_LABELS[me.role] ?? me.role}</Badge>
                : <span style={{ color: C.muted, fontSize: '0.78rem' }}>nincs profil hozzárendelve ehhez a fiókhoz</span>}
            </td>
          </tr>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted }}>Cég</td>
            <td style={{ ...S.td }} colSpan={2}>
              {me?.companyName ?? '…'}
              {me?.companySlug && <span style={{ color: C.muted, fontSize: '0.78rem', fontFamily: 'monospace' }}> · {me.companySlug}</span>}
            </td>
          </tr>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted, verticalAlign: 'top' }}>Jelszó</td>
            <td style={{ ...S.td }} colSpan={2}>
              {/* A jelszó itt nem írható át közvetlenül. A csere a fiókhoz
                  tartozó címre küldött, egyszer felhasználható hivatkozáson
                  keresztül történik — így a postafiókhoz való hozzáférés is
                  igazolja, hogy a fiók gazdája kéri a módosítást. Egy őrizetlen,
                  bejelentkezve hagyott gépnél ez a különbség számít. */}
              {pwSent
                ? <span style={{ color: C.green, fontSize: '0.82rem' }}>✓ A visszaállító hivatkozás elküldve a fenti címre</span>
                : <button type="button" onClick={handlePasswordReset} style={S.btnSecondary}>
                    Jelszó megváltoztatása →
                  </button>
              }
              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: C.muted, lineHeight: 1.55 }}>
                A hivatkozás a fiókhoz tartozó e-mail címre érkezik, és egy jelszóbeállító oldalra vezet.
              </div>
            </td>
          </tr>
        </tbody>
      </Table>

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Megjelenés</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {THEMES.map(t => {
          const active = theme === t.key
          return (
            // Theme is a per-device preference — applies and persists instantly
            <button key={t.key} type="button" onClick={() => { setTheme(t.key); saveTheme(t.key) }} style={{
              textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden',
              background: C.bg1, border: `2px solid ${active ? C.accent : C.border}`, borderRadius: R.lg,
            }}>
              {/* Mini theme preview */}
              <div style={{ background: t.pv.bg, padding: '0.85rem', borderBottom: `1px solid ${t.pv.border}` }}>
                <div style={{ background: t.pv.surface, border: `1px solid ${t.pv.border}`, padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 10, height: 10, background: t.pv.accent, flexShrink: 0 }} />
                  <span style={{ height: 6, width: '55%', background: t.pv.border }} />
                </div>
                <div style={{ height: 6, width: '70%', background: t.pv.border, marginTop: '0.5rem' }} />
              </div>
              <div style={{ padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>{t.label}</div>
                  <div style={{ fontSize: '0.7rem', color: C.muted }}>{t.desc}</div>
                </div>
                {active && <Badge color={C.accent}>aktív</Badge>}
              </div>
            </button>
          )
        })}
      </div>
      {/* A téma azonnal érvényre jut és eszközönként tárolódik, ezért nem
          függ a mentés gombtól — ezt jelezni kell, mert most egymás alatt van. */}
      

      {error && <div style={{ ...S.errorBox, marginTop: '1rem' }}>{error}</div>}

      {/* A gomb a teljes űrlapot menti (bal oszlop is) — egyetlen form van. */}
      <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: `1px solid ${C.border}` }}>
        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, background: saved ? C.green : C.accent }}>
          {saving ? 'Mentés…' : saved ? '✓ Mentve' : 'Beállítások mentése'}
        </button>
      </div>
      </div>
    </form>
  )
}
