import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nfc_uid, company_slug } = await req.json()

    if (!nfc_uid || !company_slug) {
      return new Response(
        JSON.stringify({ error: 'nfc_uid and company_slug required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const uid = nfc_uid.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const variants = [uid, uid.replace(/(.{2})/g, '$1:').slice(0, -1)]

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('slug', company_slug)
      .single()

    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role, department')
      .eq('company_id', company.id)
      .in('nfc_uid', variants)
      .maybeSingle()

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Unknown card', code: 'UNKNOWN_CARD' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

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

    // Worker view: own events last 7 days
    const { data: events } = await supabase
      .from('events')
      .select('id, type, timestamp')
      .eq('user_id', profile.id)
      .gte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: false })
      .limit(50)

    return new Response(
      JSON.stringify({ profile, company, events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
