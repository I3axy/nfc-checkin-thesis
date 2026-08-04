import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Cégre sózott, determinisztikus PIN-hash. Betű szerint ugyanaz a képlet fut a
// checkin függvényben és a vezetői felületen — ha bármelyik eltérne, a PIN itt
// nem találna profilt. A nyers PIN sehol nem kerül tárolásra.
async function hashPin(companyId: string, pin: string) {
  const data = new TextEncoder().encode(`${companyId}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Hiányzás-tartomány ──────────────────────────────────────────────────────
// Az absences táblában naponként egy sor áll (egyediségi megkötés a napra),
// ezért a tartományt napokra kell bontani. Ugyanaz a szabály, mint a vezetői
// felületen: a hétvége alapértelmezés szerint kimarad.
const MAX_RANGE_DAYS = 366

const isYmd = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

function expandRange(from: string, to: string, skipWeekends: boolean): string[] {
  const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const out: string[] = []
  const end = parse(to)
  for (const d = parse(from); d <= end; d.setDate(d.getDate() + 1)) {
    if (skipWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue
    out.push(fmt(d))
    if (out.length > MAX_RANGE_DAYS) break   // védelem a végtelen tartomány ellen
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nfc_uid, pin, company_slug, action, absence, absence_ids } = await req.json()

    if (!company_slug || (!nfc_uid && !pin)) {
      return json({ error: 'Azonosító szükséges', code: 'NO_IDENTITY' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('slug', company_slug)
      .single()

    if (!company) {
      return json({ error: 'A cég nem található', code: 'NO_COMPANY' }, 404)
    }

    // ── Azonosítás ──────────────────────────────────────────────────────────
    // Kétféle úton lehet belépni. A kártya a helyszíni használat maradványa,
    // a PIN teszi lehetővé a távoli (otthoni) elérést. A PIN itt KIZÁRÓLAG
    // azonosításra szolgál — jelenléti eseményt nem hoz létre, azt csak a
    // beléptető alkalmazás rögzíthet.
    let profile: { id: string; name: string; role: string; department: string | null } | null = null

    if (pin) {
      const raw = String(pin).trim()
      if (!/^\d{4,6}$/.test(raw)) {
        return json({ error: 'A PIN 4–6 számjegy', code: 'BAD_PIN' }, 400)
      }
      // Ugyanaz a cégre sózott, determinisztikus hash, mint a beléptetésnél —
      // enélkül a PIN nem volna érték szerint visszakereshető.
      const pinHash = await hashPin(company.id, raw)
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role, department')
        .eq('company_id', company.id)
        .eq('pin', pinHash)
        .maybeSingle()
      profile = data
      if (!profile) {
        return json({ error: 'Hibás PIN kód', code: 'BAD_PIN' }, 401)
      }
    } else {
      const uid = String(nfc_uid).toUpperCase().replace(/[^A-Z0-9]/g, '')
      const variants = [uid, uid.replace(/(.{2})/g, '$1:').slice(0, -1)]
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role, department')
        .eq('company_id', company.id)
        .in('nfc_uid', variants)
        .maybeSingle()
      profile = data
      if (!profile) {
        return json({ error: 'Ismeretlen kártya', code: 'UNKNOWN_CARD' }, 404)
      }
    }

    // ── Kérelem visszavonása ────────────────────────────────────────────────
    // Csak a SAJÁT, még el nem bírált kérelem vonható vissza. A jóváhagyott
    // hiányzás törlése vezetői döntés — a szűrés ezért a szerveren van.
    if (action === 'cancel_absence') {
      const ids = Array.isArray(absence_ids) ? absence_ids.filter(i => typeof i === 'string') : []
      if (ids.length === 0) {
        return json({ error: 'Nincs megadva visszavonandó kérelem', code: 'BAD_INPUT' }, 400)
      }
      const { data: removed, error: delErr } = await supabase
        .from('absences')
        .delete()
        .in('id', ids)
        .eq('user_id', profile.id)      // más dolgozóé nem törölhető
        .eq('status', 'pending')        // elbírált kérelem nem
        .select('id')

      if (delErr) return json({ error: 'A visszavonás nem sikerült', code: 'DELETE_FAILED' }, 500)
      if (!removed || removed.length === 0) {
        return json({ error: 'Ez a kérelem már el lett bírálva, nem vonható vissza', code: 'NOT_PENDING' }, 409)
      }
      return json({ ok: true, removed: removed.map(r => r.id) })
    }

    // Worker self-service: submit an absence request
    // A tartomány a SZERVEREN kerül napokra bontva — a napok számát nem a
    // kliens dönti el, és így egy kérésből lesz az egész időszak.
    if (action === 'submit_absence') {
      const { date, date_from, date_to, type, note, skip_weekends } = absence ?? {}
      const allowed = ['vacation', 'sick', 'other']

      // A `date` a régi, egynapos alak — visszafelé kompatibilis marad.
      const from = date_from ?? date
      const to   = date_to   ?? date_from ?? date

      if (!isYmd(from) || !isYmd(to) || !allowed.includes(type)) {
        return json({ error: 'Érvényes dátum és típus szükséges', code: 'BAD_ABSENCE' }, 400)
      }
      if (to < from) {
        return json({ error: 'A záró dátum nem lehet korábbi a kezdőnél', code: 'BAD_RANGE' }, 400)
      }

      const days = expandRange(from, to, skip_weekends !== false)
      if (days.length === 0) {
        return json({ error: 'A megadott időszakban nincs munkanap', code: 'EMPTY_RANGE' }, 400)
      }
      if (days.length > MAX_RANGE_DAYS) {
        return json({ error: `Egyszerre legfeljebb ${MAX_RANGE_DAYS} nap rögzíthető`, code: 'RANGE_TOO_LONG' }, 400)
      }

      // A dolgozó kérelmet nyújt be, nem tényt rögzít — a vezető dönt róla.
      const rows = days.map((d) => ({
        company_id: company.id,
        user_id: profile.id,
        date: d,
        type,
        note: note ? String(note).slice(0, 500) : null,
        status: 'pending',
      }))

      // A már rögzített napokat átugorjuk ütközés helyett: egy részben átfedő
      // időszak beküldése így nem hiúsul meg teljesen.
      const { data: inserted, error: insErr } = await supabase
        .from('absences')
        .upsert(rows, { onConflict: 'company_id,user_id,date', ignoreDuplicates: true })
        .select('id, date, type, note, status, decision_note')

      if (insErr) {
        return json({ error: 'Nem sikerült rögzíteni', code: 'INSERT_FAILED' }, 500)
      }
      const created = inserted ?? []
      if (created.length === 0) {
        return json({ error: 'Ezekre a napokra már van rögzített hiányzás', code: 'DUPLICATE_ABSENCE' }, 409)
      }
      return json({
        ok: true,
        created: created.length,
        skipped: days.length - created.length,
        absences: created,
      })
    }

    // A dolgozói alkalmazás naplója két nézetet kínál (egy hét / egy hónap),
    // ezért egy hónapnyi eseményt küldünk — a szűrés a kliensen történik, így
    // a nézetváltás nem igényel újabb kérést.
    const sevenDaysAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()

    if (profile.role === 'manager' || profile.role === 'admin') {
      // Manager view: all workers + current status
      const [{ data: allProfiles }, { data: recentEvents }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, role, department')
          .eq('company_id', company.id)
          .order('name'),
        supabase
          .from('events')
          .select('id, user_id, type, timestamp')
          .eq('company_id', company.id)
          .gte('timestamp', sevenDaysAgo)
          .order('timestamp', { ascending: false })
          .limit(500),
      ])

      return new Response(
        JSON.stringify({ profile, company, allProfiles, recentEvents }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Worker view: own events (last 31 days) + own absences
    const [{ data: events }, { data: absences }] = await Promise.all([
      supabase
        .from('events')
        .select('id, type, timestamp')
        .eq('user_id', profile.id)
        .gte('timestamp', thirtyDaysAgo)
        .order('timestamp', { ascending: false })
        .limit(300),
      supabase
        .from('absences')
        .select('id, date, type, note, status, decision_note')
        .eq('user_id', profile.id)
        // Naponként egy sor: egy kéthetes szabadság már 10 sor. A felület
        // egybefüggő tételekké vonja össze őket, ezért kell bővebb keret.
        .order('date', { ascending: false })
        .limit(120),
    ])

    return json({ profile, company, events, absences })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
