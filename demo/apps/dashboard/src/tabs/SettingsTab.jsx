import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, R } from '../lib/theme'
import { saveTheme, loadTheme, settingsToCompany } from '../lib/settings'
import { toast } from '../components/toast'
import { Table, SectionLabel, Badge, SettingsRow } from '../components/ui'

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

export function SettingsTab({ settings, companyId, me, onChange }) {
  const [startHour,     setStartHour]     = useState(settings.startHour)
  const [startMinute,   setStartMinute]   = useState(settings.startMinute)
  const [lateThreshold, setLateThreshold] = useState(settings.lateThresholdMinutes)
  const [autoCheckout,  setAutoCheckout]  = useState(settings.autoCheckoutHour)
  const [photoRequired, setPhotoRequired] = useState(settings.photoRequired ?? false)
  const [pinPhotoRequired, setPinPhotoRequired] = useState(settings.pinPhotoRequired ?? false)
  // Read the theme from its real source (localStorage) — the App-level settings
  // state isn't updated by the instant theme switch, so it can go stale.
  const [theme,         setTheme]         = useState(() => loadTheme())
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState('')
  const [pwSent,        setPwSent]        = useState(false)
  const [sending,       setSending]       = useState(false)
  const [digestMsg,     setDigestMsg]     = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!companyId) { setError('A cég azonosító még töltődik, próbáld újra egy pillanat múlva'); return }
    setSaving(true); setError('')

    const next = {
      startHour, startMinute, lateThresholdMinutes: lateThreshold,
      autoCheckoutHour: autoCheckout, photoRequired, pinPhotoRequired, theme,
    }
    const { data, error } = await supabase.from('companies').update(settingsToCompany(next)).eq('id', companyId).select()
    setSaving(false)
    if (error) { setError(error.message); toast('A beállítások mentése nem sikerült', 'error'); return }
    if (!data || data.length === 0) { setError('A mentés nem sikerült (jogosultság hiánya). Ellenőrizd, hogy manager/admin szerepkörrel vagy bejelentkezve.'); toast('A beállítások mentése nem sikerült', 'error'); return }

    saveTheme(theme)
    onChange({
      startHour: Number(startHour), startMinute: Number(startMinute),
      lateThresholdMinutes: Number(lateThreshold), autoCheckoutHour: Number(autoCheckout),
      photoRequired, pinPhotoRequired, theme,
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
    await supabase.auth.resetPasswordForEmail(user.email)
    setPwSent(true)
    setTimeout(() => setPwSent(false), 5000)
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
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
          <SettingsRow label="Auto checkout" hint="ennél később senki sem maradhat bent">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="number" min="18" max="23" value={autoCheckout} onChange={e => setAutoCheckout(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ fontSize: '0.8rem', color: C.muted }}>:00</span>
            </div>
          </SettingsRow>
        </tbody>
      </Table>

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
                <div style={{ background: t.pv.surface, border: `1px solid ${t.pv.border}`, borderRadius: 8, padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.pv.accent, flexShrink: 0 }} />
                  <span style={{ height: 6, width: '55%', borderRadius: 3, background: t.pv.border }} />
                </div>
                <div style={{ height: 6, width: '70%', borderRadius: 3, background: t.pv.border, marginTop: '0.5rem' }} />
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

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Értesítések</SectionLabel>
      <Table>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ ...S.td, color: C.muted }}>Napi összesítő</td>
            <td style={{ ...S.td, fontSize: '0.78rem', color: C.muted }}>Jelenléti riport a menedzserek email-címére</td>
            <td style={{ ...S.td, textAlign: 'right' }}>
              <button type="button" onClick={handleSendDigest} disabled={sending} style={S.btnSecondary}>{sending ? 'Küldés…' : 'Küldés most →'}</button>
            </td>
          </tr>
        </tbody>
      </Table>
      {digestMsg && <div style={{ fontSize: '0.78rem', color: digestMsg.startsWith('✓') ? C.green : C.warn, marginTop: '0.5rem', wordBreak: 'break-word' }}>{digestMsg}</div>}

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
            <td style={{ ...S.td, color: C.muted }}>Jelszó</td>
            <td style={{ ...S.td, fontSize: '0.78rem', color: C.muted }}>Küldünk egy linket a fiókhoz tartozó email-re</td>
            <td style={{ ...S.td, textAlign: 'right' }}>
              {pwSent
                ? <span style={{ fontSize: '0.78rem', color: C.green }}>✓ Email elküldve</span>
                : <button type="button" onClick={handlePasswordReset} style={S.btnSecondary}>Változtatás →</button>
              }
            </td>
          </tr>
        </tbody>
      </Table>

      {error && <div style={{ ...S.errorBox, marginTop: '1rem' }}>{error}</div>}

      <div style={{ marginTop: '1.25rem' }}>
        <button type="submit" disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1, background: saved ? C.green : C.accent }}>
          {saving ? 'Mentés…' : saved ? '✓ Mentve' : 'Beállítások mentése'}
        </button>
      </div>
    </form>
  )
}
