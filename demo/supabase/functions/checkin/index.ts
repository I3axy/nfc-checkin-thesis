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
    const { nfc_uid, company_slug, photo_url } = await req.json()

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

    // Normalize UID: uppercase, strip separators
    const uid = nfc_uid.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Lookup company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, photo_required')
      .eq('slug', company_slug)
      .single()

    if (companyErr || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Lookup profile — try multiple UID format variants
    const variants = [uid, uid.replace(/(.{2})/g, '$1:').slice(0, -1)]
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('company_id', company.id)
      .in('nfc_uid', variants)
      .maybeSingle()

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ error: 'Unknown card', code: 'UNKNOWN_CARD' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine next event type (toggle)
    const { data: lastEvent } = await supabase
      .from('events')
      .select('type')
      .eq('user_id', profile.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const eventType = lastEvent?.type === 'checkin' ? 'checkout' : 'checkin'

    // Deduplication: block if same type within 30 seconds
    const { data: recent } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', profile.id)
      .eq('type', eventType)
      .gte('timestamp', new Date(Date.now() - 30_000).toISOString())
      .maybeSingle()

    if (recent) {
      return new Response(
        JSON.stringify({ error: 'Duplicate event', code: 'DUPLICATE' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert event
    const { data: event, error: insertErr } = await supabase
      .from('events')
      .insert({
        company_id: company.id,
        user_id: profile.id,
        type: eventType,
        photo_url: photo_url ?? null,
      })
      .select('id, type, timestamp')
      .single()

    if (insertErr) throw insertErr

    return new Response(
      JSON.stringify({
        user: { id: profile.id, name: profile.name, role: profile.role },
        event: { id: event.id, type: event.type, timestamp: event.timestamp },
        photo_required: company.photo_required,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
