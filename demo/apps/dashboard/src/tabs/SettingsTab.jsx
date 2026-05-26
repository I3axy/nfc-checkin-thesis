import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S } from '../lib/theme'
import { Table, SectionLabel, Badge, SettingsRow, Divider } from '../components/ui'

const THEMES = [
  { key: 'blue',  label: 'Kék (Steam)', desc: 'Alapértelmezett, sötétkék' },
  { key: 'dark',  label: 'Sötét',       desc: 'Fekete alapú, kontrasztos' },
  { key: 'light', label: 'Világos',     desc: 'Fehér alapú, nappali' },
]

export function SettingsTab({ settings, onSave }) {
  const [startHour,     setStartHour]     = useState(settings.startHour)
  const [startMinute,   setStartMinute]   = useState(settings.startMinute)
  const [lateThreshold, setLateThreshold] = useState(settings.lateThresholdMinutes)
  const [autoCheckout,  setAutoCheckout]  = useState(settings.autoCheckoutHour)
  const [theme,         setTheme]         = useState(settings.theme ?? 'blue')
  const [saved,         setSaved]         = useState(false)
  const [pwSent,        setPwSent]        = useState(false)

  function handleSave(e) {
    e.preventDefault()
    onSave({ startHour: Number(startHour), startMinute: Number(startMinute), lateThresholdMinutes: Number(lateThreshold), autoCheckoutHour: Number(autoCheckout), theme })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

      <div style={{ marginTop: '1.25rem' }}>
        <button type="submit" style={{ ...S.btnPrimary, background: saved ? C.green : C.accent }}>
          {saved ? '✓ Mentve' : 'Beállítások mentése'}
        </button>
      </div>
    </form>
  )
}
