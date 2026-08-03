import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S } from '../lib/theme'
import { toast } from './toast'

// A SAJÁT jelszó megváltoztatása. A tényleges módosítást a védett manage-user
// Edge Function végzi, amely kizárólag a hívó saját fiókjára engedi — más
// vezető jelszavához a felületen sincs út, és a szerver is elutasítaná.
export function SelfPasswordChange() {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (pw1.length < 6) { setErr('A jelszó legalább 6 karakter legyen'); return }
    if (pw1 !== pw2) { setErr('A két jelszó nem egyezik'); return }
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'set_password', password: pw1 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(`${data.error ?? 'Hiba'}${data.code ? ` (${data.code})` : ''}`)
        toast('A jelszó módosítása nem sikerült', 'error')
      } else {
        setPw1(''); setPw2('')
        toast('Jelszó megváltoztatva')
      }
    } catch (e) {
      setErr('Hálózati hiba: ' + e.message)
      toast('A jelszó módosítása nem sikerült', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder="Új jelszó (min. 6 karakter)" autoComplete="new-password" style={S.input} />
      <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Új jelszó mégegyszer" autoComplete="new-password" style={S.input} />
      {err && <div style={S.errorBox}>{err}</div>}
      <button type="button" onClick={submit} disabled={busy || !pw1} style={{ ...S.btnSecondary, opacity: busy || !pw1 ? 0.55 : 1 }}>
        {busy ? 'Módosítás…' : 'Jelszó megváltoztatása'}
      </button>
    </div>
  )
}
