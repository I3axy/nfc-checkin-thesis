import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500 })
  }

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  // Get all companies
  const { data: companies } = await supabase.from('companies').select('id, name')
  if (!companies?.length) return new Response(JSON.stringify({ sent: 0 }))

  let totalSent = 0

  for (const company of companies) {
    // Workers who have no checkin today AND no absence today
    const { data: workers } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('role', 'worker')

    if (!workers?.length) continue

    const { data: todayCheckins } = await supabase
      .from('events')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('type', 'checkin')
      .gte('timestamp', todayStart.toISOString())

    const { data: todayAbsences } = await supabase
      .from('absences')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('date', todayStart.toISOString().slice(0, 10))

    const checkedInIds = new Set(todayCheckins?.map((e) => e.user_id) ?? [])
    const absentIds = new Set(todayAbsences?.map((a) => a.user_id) ?? [])

    const missing = workers.filter((w) => !checkedInIds.has(w.id) && !absentIds.has(w.id))
    if (!missing.length) continue

    // Get manager emails
    const { data: managers } = await supabase
      .from('profiles')
      .select('auth_user_id')
      .eq('company_id', company.id)
      .in('role', ['manager', 'admin'])

    if (!managers?.length) continue

    const managerAuthIds = managers.map((m) => m.auth_user_id).filter(Boolean)
    if (!managerAuthIds.length) continue

    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const managerEmails = authUsers?.users
      .filter((u) => managerAuthIds.includes(u.id))
      .map((u) => u.email)
      .filter(Boolean) ?? []

    if (!managerEmails.length) continue

    const missingList = missing.map((w) => `• ${w.name}`).join('\n')
    const subject = `[${company.name}] Hiányzók ma — ${missing.length} fő`
    const body = `Jó reggelt!\n\nMa reggel 9:00-ig az alábbi munkavállalók nem jelentkeztek be és nincs rögzített hiányzásuk:\n\n${missingList}\n\nNFC Check-in rendszer`

    for (const email of managerEmails) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'nfc-checkin@resend.dev',
          to: email,
          subject,
          text: body,
        }),
      })
      totalSent++
    }
  }

  return new Response(
    JSON.stringify({ sent: totalSent }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
