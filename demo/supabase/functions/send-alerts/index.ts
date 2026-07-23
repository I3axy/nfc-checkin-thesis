import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// The demo runs in Hungary; work-start rules are wall-clock local time.
const TZ = 'Europe/Budapest'
const localDateStr = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const localMinutes = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const h = Number(p.find((x) => x.type === 'hour')!.value)
  const m = Number(p.find((x) => x.type === 'minute')!.value)
  return h * 60 + m
}
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)

const ABSENCE_LABELS: Record<string, string> = {
  vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY not set' }, 500)

  // Optional { company_id } → digest for one company (the dashboard "send now"
  // button). No body → every company (the scheduled pg_cron run).
  let onlyCompanyId: string | null = null
  try {
    const body = await req.json()
    onlyCompanyId = body?.company_id ?? null
  } catch { /* no body */ }

  const now = new Date()
  const todayStr = localDateStr(now)
  // Events can straddle the UTC/local boundary, so pull a wide window and
  // filter to the local day in JS.
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()

  let companyQuery = supabase
    .from('companies')
    .select('id, name, work_start_hour, work_start_minute, late_threshold_minutes')
  if (onlyCompanyId) companyQuery = companyQuery.eq('id', onlyCompanyId)
  const { data: companies } = await companyQuery
  if (!companies?.length) return json({ sent: 0, companies: 0 })

  let totalSent = 0
  const errors: string[] = []

  for (const company of companies) {
    const startMin = company.work_start_hour * 60 + company.work_start_minute + company.late_threshold_minutes

    const { data: workers } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('role', 'worker')
      .order('name')
    if (!workers?.length) continue

    const [{ data: events }, { data: absences }] = await Promise.all([
      supabase
        .from('events')
        .select('user_id, type, timestamp')
        .eq('company_id', company.id)
        .eq('type', 'checkin')
        .gte('timestamp', since),
      supabase
        .from('absences')
        .select('user_id, type')
        .eq('company_id', company.id)
        .eq('date', todayStr),
    ])

    // Earliest check-in today (local day) per worker
    const firstIn: Record<string, Date> = {}
    for (const e of events ?? []) {
      const t = new Date(e.timestamp)
      if (localDateStr(t) !== todayStr) continue
      if (!firstIn[e.user_id] || t < firstIn[e.user_id]) firstIn[e.user_id] = t
    }
    const absenceByUser: Record<string, string> = {}
    for (const a of absences ?? []) absenceByUser[a.user_id] = a.type

    const present = workers
      .filter((w) => firstIn[w.id])
      .map((w) => ({ name: w.name, at: firstIn[w.id], late: localMinutes(firstIn[w.id]) > startMin }))
    const onLeave = workers.filter((w) => !firstIn[w.id] && absenceByUser[w.id])
      .map((w) => ({ name: w.name, type: absenceByUser[w.id] }))
    const missing = workers.filter((w) => !firstIn[w.id] && !absenceByUser[w.id])

    // Manager emails (auth users linked to manager/admin profiles)
    const { data: managers } = await supabase
      .from('profiles')
      .select('auth_user_id')
      .eq('company_id', company.id)
      .in('role', ['manager', 'admin'])
    const managerAuthIds = (managers ?? []).map((m) => m.auth_user_id).filter(Boolean)
    if (!managerAuthIds.length) continue

    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const managerEmails = (authUsers?.users ?? [])
      .filter((u) => managerAuthIds.includes(u.id))
      .map((u) => u.email)
      .filter(Boolean) as string[]
    if (!managerEmails.length) continue

    const lateCount = present.filter((p) => p.late).length
    const subject = `[${company.name}] Napi jelenlét — ${present.length} jelen, ${missing.length} hiányzik${lateCount ? `, ${lateCount} késett` : ''}`
    const html = renderDigest(company.name, todayStr, present, onLeave, missing)

    for (const email of managerEmails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'NFC Check-in <onboarding@resend.dev>', to: [email], subject, html }),
      })
      if (res.ok) totalSent++
      else errors.push(`${email}: ${res.status} ${await res.text()}`)
    }
  }

  return json({ sent: totalSent, companies: companies.length, errors })
})

function renderDigest(
  companyName: string,
  dateStr: string,
  present: { name: string; at: Date; late: boolean }[],
  onLeave: { name: string; type: string }[],
  missing: { name: string }[],
) {
  const row = (s: string) => `<li style="padding:2px 0">${s}</li>`
  const section = (title: string, items: string[]) =>
    `<h3 style="margin:18px 0 6px;font-size:15px">${title}</h3>` +
    (items.length ? `<ul style="margin:0;padding-left:20px">${items.join('')}</ul>` : `<div style="color:#888;font-size:13px">—</div>`)

  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;color:#111">
    <h2 style="margin:0 0 2px">Napi jelenléti összesítő</h2>
    <div style="color:#666;font-size:13px">${companyName} · ${dateStr}</div>
    ${section(`✅ Jelen (${present.length})`, present.map((p) =>
      row(`${p.name} — <b>${hhmm(p.at)}</b>${p.late ? ' <span style="color:#d97706">⚠️ késett</span>' : ''}`)))}
    ${section(`🌴 Igazolt hiányzás (${onLeave.length})`, onLeave.map((p) =>
      row(`${p.name} — ${ABSENCE_LABELS[p.type] ?? p.type}`)))}
    ${section(`❌ Nem jelentkezett be (${missing.length})`, missing.map((p) => row(p.name)))}
    <hr style="margin:18px 0;border:none;border-top:1px solid #eee">
    <div style="color:#999;font-size:12px">NFC Check-in rendszer · automatikus üzenet</div>
  </div>`
}
