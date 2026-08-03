import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =============================================================================
// manage-user — profil- és fióklétrehozás, jelszókezelés
// =============================================================================
// FONTOS: ezt a függvényt BEKAPCSOLT JWT-ellenőrzéssel kell deployolni
// (ellentétben a checkin / worker-data függvényekkel). A hívó személyazonossága
// a saját JWT-jéből derül ki, és minden művelet előtt ellenőrizzük, hogy
// manager vagy admin szerepkörű-e AZ ADOTT CÉGNÉL.
//
// Miért nem a böngészőből?
//   - a supabase.auth.signUp() kiléptetné az éppen belépett vezetőt,
//   - a jelszó beállításához admin jogosultság kell, ami sosem kerülhet
//     kliensoldalra.
//
// Műveletek:
//   action: 'create'        -> profil (+ manager/admin esetén auth-fiók)
//   action: 'set_password'  -> jelszóváltás, KIZÁRÓLAG a saját fiókra
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const normalizeUid = (raw: string) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function hashPin(companyId: string, pin: string) {
  const data = new TextEncoder().encode(`${companyId}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Hiányzó hitelesítés', code: 'NO_AUTH' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // A hívó azonosítása a saját tokenjével
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await caller.auth.getUser()
    if (userErr || !user) return json({ error: 'Érvénytelen munkamenet', code: 'INVALID_SESSION' }, 401)

    // A hívó profilja adja a jogosultságot és a céghatárt
    const { data: me } = await service
      .from('profiles')
      .select('id, company_id, role, auth_user_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!me) return json({ error: 'A fiókhoz nem tartozik profil', code: 'NO_PROFILE' }, 403)
    if (!['manager', 'admin'].includes(me.role)) {
      return json({ error: 'Nincs jogosultság a művelethez', code: 'FORBIDDEN' }, 403)
    }

    const body = await req.json()
    const action = body?.action

    // ── Jelszóváltás — kizárólag a saját fiókra ──────────────────────────────
    if (action === 'set_password') {
      const { password, profile_id } = body
      // Ha a kérés más profilra vonatkozik, elutasítjuk. A felületen sincs rá
      // gomb, de a védelem nem múlhat a felületen.
      if (profile_id && profile_id !== me.id) {
        return json({ error: 'Más felhasználó jelszava nem módosítható', code: 'NOT_SELF' }, 403)
      }
      if (!password || String(password).length < 6) {
        return json({ error: 'A jelszó legalább 6 karakter legyen', code: 'WEAK_PASSWORD' }, 400)
      }
      const { error } = await service.auth.admin.updateUserById(user.id, { password: String(password) })
      if (error) return json({ error: error.message, code: 'UPDATE_FAILED' }, 400)
      return json({ ok: true })
    }

    // ── Profil (és szükség esetén fiók) létrehozása ──────────────────────────
    if (action === 'create') {
      const p = body.profile ?? {}
      const role = p.role
      if (!['worker', 'manager', 'admin', 'guest'].includes(role)) {
        return json({ error: 'Érvénytelen szerepkör', code: 'BAD_ROLE' }, 400)
      }
      // Admin szerepkört csak admin oszthat ki
      if (role === 'admin' && me.role !== 'admin') {
        return json({ error: 'Admin szerepkört csak admin hozhat létre', code: 'FORBIDDEN_ROLE' }, 403)
      }

      const firstName = String(p.first_name ?? '').trim()
      const lastName = String(p.last_name ?? '').trim()
      if (!firstName || !lastName) {
        return json({ error: 'A vezeték- és keresztnév kötelező', code: 'NAME_REQUIRED' }, 400)
      }

      const needsAccount = role === 'manager' || role === 'admin'
      const email = String(p.email ?? '').trim().toLowerCase()
      if (needsAccount) {
        if (!email) return json({ error: 'Vezetőknél az e-mail cím kötelező', code: 'EMAIL_REQUIRED' }, 400)
        if (!p.password || String(p.password).length < 6) {
          return json({ error: 'A jelszó legalább 6 karakter legyen', code: 'WEAK_PASSWORD' }, 400)
        }
      }
      if (role === 'worker' && !p.pin) {
        return json({ error: 'Dolgozónál a PIN kötelező', code: 'PIN_REQUIRED' }, 400)
      }
      if (p.pin && !/^\d{4,6}$/.test(String(p.pin))) {
        return json({ error: 'A PIN 4–6 számjegy legyen', code: 'BAD_PIN' }, 400)
      }

      // A cég MINDIG a hívó cége — kliensről érkező company_id-t nem fogadunk el
      const companyId = me.company_id

      let authUserId: string | null = null
      if (needsAccount) {
        const { data: created, error: authErr } = await service.auth.admin.createUser({
          email,
          password: String(p.password),
          email_confirm: true,           // vezetőt a rendszergazda vesz fel, nincs külön megerősítés
        })
        if (authErr) {
          const taken = /already|exists|registered/i.test(authErr.message)
          return json(
            { error: taken ? 'Ezzel az e-mail címmel már létezik fiók' : authErr.message, code: taken ? 'EMAIL_TAKEN' : 'AUTH_CREATE_FAILED' },
            400
          )
        }
        authUserId = created.user?.id ?? null
      }

      const { data: profile, error: insErr } = await service.from('profiles').insert({
        company_id: companyId,
        auth_user_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        role,
        email: email || null,
        phone: p.phone ? String(p.phone).trim() : null,
        department: role === 'guest' ? null : (p.department ? String(p.department).trim() : null),
        nfc_uid: p.nfc_uid ? normalizeUid(p.nfc_uid) : null,
        pin: p.pin ? await hashPin(companyId, String(p.pin)) : null,
        guest_expires_at: role === 'guest' && p.guest_expires_at ? p.guest_expires_at : null,
      }).select('id, name, role').single()

      if (insErr) {
        // Az auth-fiók ne maradjon árván, ha a profil beszúrása elbukott
        if (authUserId) await service.auth.admin.deleteUser(authUserId)
        const dup = insErr.code === '23505'
        const which = /pin/i.test(insErr.message) ? 'Ez a PIN már foglalt a cégben'
          : /nfc_uid/i.test(insErr.message) ? 'Ez a kártya már regisztrálva van'
          : 'Az adat ütközik egy meglévő bejegyzéssel'
        return json({ error: dup ? which : insErr.message, code: dup ? 'DUPLICATE' : 'INSERT_FAILED' }, 400)
      }

      return json({ ok: true, profile })
    }

    return json({ error: 'Ismeretlen művelet', code: 'BAD_ACTION' }, 400)
  } catch (err) {
    return json({ error: 'Belső hiba', code: 'INTERNAL' }, 500)
  }
})
