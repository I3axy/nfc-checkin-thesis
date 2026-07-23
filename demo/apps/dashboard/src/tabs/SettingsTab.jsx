import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { saveTheme, settingsToCompany } from '../lib/settings'
import { Table, SectionLabel, Badge, SettingsRow } from '../components/ui'

const THEMES = [
  { key: 'blue',  label: 'Kék (Steam)', desc: 'Alapértelmezett, sötétkék' },
  { key: 'dark',  label: 'Sötét',       desc: 'Fekete alapú, kontrasztos' },
  { key: 'light', label: 'Világos',     desc: 'Fehér alapú, nappali' },
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

export function SettingsTab({ settings, companyId, onChange }) {
  const [startHour,     setStartHour]     = useState(settings.startHour)
  const [startMinute,   setStartMinute]   = useState(settings.startMinute)
  const [lateThreshold, setLateThreshold] = useState(settings.lateThresholdMinutes)
  const [autoCheckout,  setAutoCheckout]  = useState(settings.autoCheckoutHour)
  const [photoRequired, setPhotoRequired] = useState(settings.photoRequired ?? false)
  const [pinPhotoRequired, setPinPhotoRequired] = useState(settings.pinPhotoRequired ?? false)
  const [theme,         setTheme]         = useState(settings.theme ?? 'blue')
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
    if (error) { setError(error.message); return }
    if (!data || data.length === 0) { setError('A mentés nem sikerült (jogosultság hiánya). Ellenőrizd, hogy manager/admin szerepkörrel vagy bejelentkezve.'); return }

    saveTheme(theme)
    onChange({
      startHour: Number(startHour), startMinute: Number(startMinute),
      lateThresholdMinutes: Number(lateThreshold), autoCheckoutHour: Number(autoCheckout),
      photoRequired, pinPhotoRequired, theme,
    })
    setSaved(true)
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
      if (!res.ok) setDigestMsg('Hiba: ' + (data.error ?? res.status))
      else if (data.errors?.length) setDigestMsg(`Küldve: ${data.sent}. Resend válasz: ${data.errors[0]}`)
      else setDigestMsg(`✓ Elküldve (${data.sent} email)`)
    } catch (e) {
      setDigestMsg('Hálózati hiba: ' + e.message)
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
      <Table>
        <tbody>
          {THEMES.map(t => (
            <tr key={t.key} onClick={() => setTheme(t.key)} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: theme === t.key ? C.bg2 : C.bg1 }}>
              <td style={{ ...S.td, width: 24 }}>
                <input type="radio" name="theme" value={t.key} checked={theme === t.key} onChange={() => setTheme(t.key)} style={{ accentColor: C.accent }} />
              </td>
              <td style={{ ...S.td, fontWeight: theme === t.key ? 700 : 400, color: theme === t.key ? C.text : C.muted }}>{t.label}</td>
              <td style={{ ...S.td, fontSize: '0.75rem', color: C.muted }}>{t.desc}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                {theme === t.key && <Badge color={C.accent}>aktív</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

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
      {digestMsg && <div style={{ fontSize: '0.78rem', color: digestMsg.startsWith('✓') ? C.green : '#d97706', marginTop: '0.5rem', wordBreak: 'break-word' }}>{digestMsg}</div>}

      <div style={{ height: '1.5rem' }} />
      <SectionLabel color={C.accent}>Fiók</SectionLabel>
      <Table>
        <tbody>
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
