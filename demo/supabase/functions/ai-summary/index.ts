import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =============================================================================
// ai-summary — természetes nyelvű jelenléti összefoglaló (Google Gemini)
// =============================================================================
// FONTOS: BEKAPCSOLT JWT-ellenőrzéssel deployolandó. A hívónak manager vagy
// admin szerepkörrel kell rendelkeznie — enélkül bárki fogyaszthatná a
// szolgáltatás (korlátos) ingyenes keretét.
//
// Adatvédelem: a modellnek KIZÁRÓLAG aggregált számok mennek — se név, se
// e-mail, se kártyaazonosító. A dolgozó nevét a felület írja a panel fejlécébe,
// a generált szöveg "a dolgozó" alakot használ. Így a szolgáltatóhoz nem kerül
// azonosításra alkalmas személyes adat (adattakarékosság elve).
//
// A szolgáltató szándékosan ebben az egy fájlban van elszigetelve: cseréjéhez
// sem a felülethez, sem a hibakezeléshez nem kell hozzányúlni.
//
// Szükséges secretek:
//   GEMINI_API_KEY  — kötelező (Google AI Studio)
//   GEMINI_MODEL    — opcionális; alapértelmezés: gemini-3.5-flash-lite
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// A modellnevek időnként változnak, és nem minden modellhez tartozik ingyenes
// kvóta. A Flash Lite a legbővebb ingyenes kerettel rendelkező szöveges modell
// (15 kérés/perc, 500 kérés/nap), egy néhány mondatos összefoglalóhoz pedig
// bőven elegendő — nagyobb modellre itt nincs szükség.
// Ha a Google kivezeti ezt a nevet, elég a GEMINI_MODEL secretet átállítani.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

const SYSTEM_PROMPT = `Egy munkaidő-nyilvántartó rendszer elemző modulja vagy.
A megadott aggregált jelenléti adatokból írj rövid, tárgyilagos értékelést magyarul,
egy vezető számára.

Szabályok:
- 3-5 mondat, folyó szöveg, felsorolás és cím nélkül.
- A dolgozót "a dolgozó" alakban említsd; nevet nem kapsz és ne is találj ki.
- Kizárólag a kapott számokra támaszkodj. Ne becsülj, ne egészíts ki, ne
  következtess olyasmire, ami az adatokból nem derül ki.
- Az időtartamokat olvasható alakban add meg (például "42 óra 39 perc").
- Zárd egy rövid, indokolt összegző értékeléssel.
- Ha nincs érdemi adat, azt írd meg egyetlen mondatban.
- Csak magát az értékelést add vissza, bevezető és záró megjegyzés nélkül.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({ error: 'Az MI szolgáltatás nincs beállítva', code: 'NO_API_KEY' }, 500)
    }

    // ── Jogosultság: csak bejelentkezett manager/admin hívhatja ──────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Hiányzó hitelesítés', code: 'NO_AUTH' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await caller.auth.getUser()
    if (userErr || !user) return json({ error: 'Érvénytelen munkamenet', code: 'INVALID_SESSION' }, 401)

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: me } = await service
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!me || !['manager', 'admin'].includes(me.role)) {
      return json({ error: 'Nincs jogosultság a művelethez', code: 'FORBIDDEN' }, 403)
    }

    // ── Bemenet ─────────────────────────────────────────────────────────────
    const { period, stats, trend_pct, action } = await req.json()

    // Diagnosztika: mely modelleket éri el ez a kulcs, és melyik támogatja a
    // szöveggenerálást. 429-es hibák okának felderítéséhez.
    if (action === 'diagnose') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': apiKey },
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        return json({ error: 'A modell-lista lekérése nem sikerült', code: String(r.status), detail: JSON.stringify(body).slice(0, 800) }, 502)
      }
      const usable = (body.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: { name: string }) => m.name.replace(/^models\//, ''))
      return json({ configured_model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL, usable_models: usable })
    }

    if (!stats || typeof stats !== 'object') {
      return json({ error: 'Hiányzó statisztika', code: 'BAD_INPUT' }, 400)
    }

    // Csak a szükséges mezők mennek tovább — semmi azonosító
    const payload = {
      idoszak: String(period ?? 'a vizsgált időszak'),
      ledolgozott_perc: Number(stats.totalMins ?? 0),
      munkanapok: Number(stats.workDays ?? 0),
      jelenleti_napok: Number(stats.attendedDays ?? 0),
      kesesek_szama: Number(stats.lateDays ?? 0),
      atlagos_erkezes: stats.avgArrival ?? null,
      szunetek_szama: Number(stats.breakCount ?? 0),
      szunet_percek: Number(stats.breakMins ?? 0),
      igazolt_hianyzas: Number(stats.justified ?? 0),
      igazolatlan_hianyzas: Number(stats.unjustified ?? 0),
      valtozas_szazalek_elozo_idoszakhoz: trend_pct ?? null,
    }

    // ── Modellhívás ─────────────────────────────────────────────────────────
    const model = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    let res: Response
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload, null, 2) }] }],
          generationConfig: {
            temperature: 0.4,      // tényszerű, de nem gépies megfogalmazás
            maxOutputTokens: 512,  // 3-5 magyar mondathoz bőven elég
          },
        }),
      })
    } catch (_e) {
      return json({ error: 'Nem sikerült elérni az MI szolgáltatást', code: 'NETWORK' }, 503)
    }

    if (!res.ok) {
      const raw = await res.text()
      const code = String(res.status)
      console.error(`Gemini ${res.status} (model=${model}): ${raw.slice(0, 800)}`)

      // A Google a valódi okot a válasz törzsében küldi. Ezt visszaadjuk a
      // felületnek is: egy 429 jelenthet elfogyott percenkénti keretet, de azt
      // is, hogy erre a modellre a kulcsnak EGYÁLTALÁN nincs ingyenes kvótája.
      let detail = ''
      try {
        const parsed = JSON.parse(raw)
        detail = parsed?.error?.message ?? ''
        // A kvóta-megsértés pontos neve elárulja, melyik limitbe ütköztünk
        const violation = parsed?.error?.details
          ?.find((d: { violations?: unknown }) => d.violations)
          ?.violations?.[0]?.quotaId
        if (violation) detail += ` [${violation}]`
      } catch { detail = raw.slice(0, 300) }

      const known: Record<string, string> = {
        '400': 'Hibás kérés az MI szolgáltatás felé',
        '403': 'Az API kulcs érvénytelen, vagy a Generative Language API nincs engedélyezve',
        '404': `A(z) "${model}" modell nem érhető el ezzel a kulccsal`,
        '429': `Kvóta-hiba a(z) "${model}" modellnél`,
        '500': 'Az MI szolgáltatás belső hibája',
        '503': 'Az MI szolgáltatás átmenetileg túlterhelt',
      }
      return json(
        { error: known[code] ?? 'Az MI szolgáltatás hibát adott', code, detail, model },
        res.status === 429 ? 429 : 502
      )
    }

    const data = await res.json()

    // A tartalom olvasása előtt a blokkolási okokat kell megnézni
    if (data.promptFeedback?.blockReason) {
      return json({ error: 'A modell biztonsági okból elutasította a kérést', code: 'SAFETY_BLOCKED' }, 502)
    }

    const candidate = data.candidates?.[0]
    if (!candidate) {
      return json({ error: 'A modell nem adott választ', code: 'EMPTY_RESPONSE' }, 502)
    }
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
      return json({ error: 'A modell biztonsági okból megszakította a választ', code: 'SAFETY_BLOCKED' }, 502)
    }

    const text = (candidate.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      return json({ error: 'A modell üres választ adott', code: 'EMPTY_RESPONSE' }, 502)
    }
    // A token-limit miatti csonkolást jelezzük, de a szöveget visszaadjuk
    const truncated = candidate.finishReason === 'MAX_TOKENS'

    return json({
      summary: text,
      truncated,
      model,
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount ?? null,
        output_tokens: data.usageMetadata?.candidatesTokenCount ?? null,
      },
    })
  } catch (_err) {
    return json({ error: 'Belső hiba az összefoglaló készítésekor', code: 'INTERNAL' }, 500)
  }
})
