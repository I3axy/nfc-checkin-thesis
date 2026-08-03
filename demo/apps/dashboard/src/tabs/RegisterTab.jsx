import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, S, R, tint } from '../lib/theme'
import { Field, SectionLabel } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { toast } from '../components/toast'

// datetime-local string: `hours` added to `current` (or to now if empty), local time
function addHours(current, hours) {
  const base = current ? new Date(current) : new Date()
  const d = new Date(base.getTime() + hours * 3600000)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ROLES = [
  { key: 'worker', label: 'Dolgozó' },
  { key: 'manager', label: 'Manager' },
  { key: 'guest', label: 'Vendég' },
]

// A kötelező mezők szerepkörfüggők: a dolgozóknak nincs belépési fiókjuk
// (az NFC-kártya az identitásuk), a vendégeknek pedig se PIN, se fiók nem kell.
const RULES = {
  worker:  { pin: true,  email: false, password: false, expiry: false },
  manager: { pin: false, email: true,  password: true,  expiry: false },
  guest:   { pin: false, email: false, password: false, expiry: true },
}

export function RegisterTab({ onSaved }) {
  const [role, setRole] = useState('worker')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(null)
  const [uid, setUid] = useState('')
  const [pin, setPin] = useState('')
  const [dept, setDept] = useState('')
  const [expiresAt, setExpiresAt] = useState(() => addHours(null, 4))
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState(null)
  const [okInfo, setOkInfo] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const nfcSupported = 'NDEFReader' in window
  const rules = RULES[role]

  async function scanCard() {
    setScanning(true); setStatus(null)
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      ndef.addEventListener('reading', ({ serialNumber }) => { setUid(serialNumber); setScanning(false) }, { once: true })
    } catch (err) { setScanning(false); setErrorMsg('NFC olvasás sikertelen: ' + err.message); setStatus('error') }
  }

  function reset() {
    setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setPhone(null)
    setUid(''); setPin(''); setDept(''); setRole('worker'); setExpiresAt(addHours(null, 4))
  }

  function validate() {
    if (!lastName.trim() || !firstName.trim()) return 'A vezeték- és keresztnév kötelező'
    if (rules.email && !email.trim()) return 'Vezetőnél az e-mail cím kötelező'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Az e-mail cím formátuma hibás'
    if (rules.password && password.length < 6) return 'A jelszó legalább 6 karakter legyen'
    if (rules.pin && !pin) return 'Dolgozónál a PIN kötelező'
    if (pin && !/^\d{4,6}$/.test(pin)) return 'A PIN 4–6 számjegy legyen'
    if (rules.expiry && !expiresAt) return 'Adj meg egy érvényességi időt a vendégnek'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) { setErrorMsg(problem); setStatus('error'); return }
    setStatus('saving'); setErrorMsg('')

    // A létrehozás védett Edge Functionön keresztül megy: a jelszavas fiók
    // létrehozásához admin jogosultság kell, ami sosem kerülhet a böngészőbe.
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'create',
          profile: {
            role,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim() || null,
            password: rules.password ? password : undefined,
            phone,
            nfc_uid: uid || null,
            pin: pin || null,
            department: dept.trim() || null,
            guest_expires_at: rules.expiry ? new Date(expiresAt).toISOString() : null,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(`${data.error ?? 'Ismeretlen hiba'}${data.code ? ` (${data.code})` : ''}`)
        setStatus('error')
        toast('A regisztráció nem sikerült', 'error')
        return
      }
      setOkInfo({ name: data.profile?.name ?? `${lastName} ${firstName}`, role })
      setStatus('ok')
      toast(`${ROLES.find(r => r.key === role)?.label ?? 'Profil'} regisztrálva: ${data.profile?.name ?? ''}`)
      reset()
      onSaved()
    } catch (err) {
      setErrorMsg('Hálózati hiba: ' + err.message)
      setStatus('error')
      toast('A regisztráció nem sikerült', 'error')
    }
  }

  if (status === 'ok') return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 420, margin: '2.5rem auto 0', borderRadius: R.lg }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: tint(C.green, 15), color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>✓</div>
      <div style={{ fontWeight: 700, color: C.text, fontSize: '1.05rem' }}>
        {ROLES.find(r => r.key === okInfo?.role)?.label ?? 'Profil'} regisztrálva
      </div>
      {okInfo?.name && <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: '0.25rem' }}>{okInfo.name}</div>}
      <button onClick={() => setStatus(null)} style={{ ...S.btnPrimary, marginTop: '1.25rem', width: 'auto', padding: '0.55rem 1.5rem' }}>Újabb regisztráció</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '2.5rem auto 0' }}>
      <SectionLabel color={C.accent}>Új személy regisztrálása</SectionLabel>
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '1.5rem' }}>

        {/* Szerepkör — az aktívat csak a betűvastagság és a szín jelöli */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem' }}>
          {ROLES.map(r => (
            <button key={r.key} type="button" onClick={() => setRole(r.key)} style={{
              padding: 0, fontSize: '0.86rem',
              fontWeight: role === r.key ? 700 : 500,
              background: 'transparent',
              color: role === r.key ? C.text : C.muted,
              border: 'none', cursor: 'pointer',
            }}>{r.label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Vezetéknév *">
              <input value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Kovács" style={S.input} />
            </Field>
            <Field label="Keresztnév *">
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Péter" style={S.input} />
            </Field>
          </div>

          <Field label={`E-mail${rules.email ? ' *' : ' (opcionális)'}`}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required={rules.email}
              placeholder={rules.email ? 'belépéshez használt cím' : 'kapcsolattartáshoz'} style={S.input} />
          </Field>

          {rules.password && (
            <Field label="Jelszó *">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="legalább 6 karakter" autoComplete="new-password" style={S.input} />
              <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.3rem' }}>
                Ezzel a címmel és jelszóval fog belépni a vezetői felületre. Később csak ő maga tudja megváltoztatni.
              </div>
            </Field>
          )}

          <Field label="Telefonszám (opcionális)">
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>

          <Field label="NFC kártya UID">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly={nfcSupported} value={uid} onChange={e => setUid(e.target.value)}
                placeholder={nfcSupported ? (scanning ? 'Tartsd a kártyát…' : 'Nyomj 📡-t, aztán tartsd a kártyát') : 'Kézi UID'}
                style={{ ...S.input, flex: 1, fontFamily: "'JetBrains Mono', monospace" }} />
              {nfcSupported && (
                <button type="button" onClick={scanCard} disabled={scanning} style={{ ...S.btnPrimary, padding: '0 1rem', opacity: scanning ? 0.6 : 1 }}>📡</button>
              )}
            </div>
          </Field>

          {role !== 'guest' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label={`PIN${rules.pin ? ' *' : ' (opcionális)'}`}>
                <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
                  required={rules.pin} placeholder="4–6 számjegy"
                  style={{ ...S.input, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.2em' }} />
              </Field>
              <Field label="Műszak / Részleg">
                <input value={dept} onChange={e => setDept(e.target.value)} placeholder="pl. A műszak" style={S.input} />
              </Field>
            </div>
          )}

          {role === 'guest' && (
            <div style={{ background: tint(C.accent, 7), border: `1px solid ${tint(C.accent, 22)}`, borderRadius: R.md, padding: '0.9rem 1rem' }}>
              <Field label="Érvényesség vége *">
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[['+2 óra', 2], ['+4 óra', 4], ['+8 óra', 8], ['+1 nap', 24]].map(([label, h]) => (
                    <button key={h} type="button" onClick={() => setExpiresAt(c => addHours(c, h))} style={{ ...S.btnSecondary, fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}>{label}</button>
                  ))}
                  <button type="button" onClick={() => setExpiresAt(addHours(null, 0))} style={{ ...S.btnIcon, fontSize: '0.72rem' }}>Most</button>
                </div>
                <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required style={S.input} />
                <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.35rem' }}>
                  A gombok hozzáadják az időt a fenti értékhez. Lejárat után a kártya nem működik a scanneren.
                </div>
              </Field>
            </div>
          )}

          {status === 'error' && <div style={S.errorBox}>{errorMsg}</div>}

          <button type="submit" disabled={status === 'saving'} style={{ ...S.btnPrimary, opacity: status === 'saving' ? 0.6 : 1 }}>
            {status === 'saving' ? 'Regisztrálás…' : 'Regisztrálás →'}
          </button>
          <div style={{ fontSize: '0.7rem', color: C.muted, textAlign: 'center' }}>A * jelölt mezők kitöltése kötelező.</div>
        </form>
      </div>
    </div>
  )
}
