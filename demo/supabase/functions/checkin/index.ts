import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Normalize UID: uppercase, strip separators
const normalizeUid = (raw: string) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Deterministic, company-salted PIN hash — must match the dashboard's hashPin.
async function hashPin(companyId: string, pin: string) {
  const data = new TextEncoder().encode(`${companyId}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      nfc_uid,
      pin,
      company_slug,
      photo_base64,
      action,
      offline_type,
      offline_timestamp,
      client_event_id,
    } = await req.json()

    if (!company_slug) {
      return json({ error: 'company_slug required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Lookup company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, photo_required, pin_photo_required, card_self_enroll')
      .eq('slug', company_slug)
      .single()

    if (companyErr || !company) {
      return json({ error: 'Company not found' }, 404)
    }

    // -------------------------------------------------------------------------
    // action:'roster' — the scanner caches this so it can recognise cards,
    // toggle in/out and enforce guest expiry while offline.
    // -------------------------------------------------------------------------
    if (action === 'roster') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, role, nfc_uid, guest_expires_at')
        .eq('company_id', company.id)

      // Current in/out state per user, from recent events (latest wins).
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('events')
        .select('user_id, type, timestamp')
        .eq('company_id', company.id)
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })

      const stateByUser: Record<string, string> = {}
      for (const e of recent ?? []) {
        if (!(e.user_id in stateByUser)) stateByUser[e.user_id] = e.type
      }

      const roster = (profiles ?? [])
        .filter((p) => p.nfc_uid)
        .map((p) => ({
          uid: normalizeUid(p.nfc_uid),
          name: p.name,
          role: p.role,
          guest_expires_at: p.guest_expires_at ?? null,
          state: stateByUser[p.id] ?? null,
        }))

      return json({ photo_required: company.photo_required, profiles: roster })
    }

    // From here on we need to identify a person: by PIN (keypad fallback) or by
    // NFC card. viaPin drives whether the PIN-specific photo policy applies.
    const viaPin = !!pin
    let profile:
      | { id: string; name: string; role: string; guest_expires_at: string | null; nfc_uid?: string | null }
      | null = null

    if (viaPin) {
      const pinHash = await hashPin(company.id, String(pin))
      const { data } = await supabase
        .from('profiles')
        // nfc_uid is needed here to decide whether a card can still be paired
        .select('id, name, role, guest_expires_at, nfc_uid')
        .eq('company_id', company.id)
        .eq('pin', pinHash)
        .maybeSingle()
      profile = data
      if (!profile) {
        return json({ error: 'Wrong PIN', code: 'UNKNOWN_PIN' }, 404)
      }
    } else {
      if (!nfc_uid) {
        return json({ error: 'nfc_uid or pin required' }, 400)
      }
      const uid = normalizeUid(nfc_uid)
      const variants = [uid, uid.replace(/(.{2})/g, '$1:').slice(0, -1)]
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role, guest_expires_at')
        .eq('company_id', company.id)
        .in('nfc_uid', variants)
        .maybeSingle()
      profile = data
      if (!profile) {
        return json({ error: 'Unknown card', code: 'UNKNOWN_CARD' }, 404)
      }
    }

    // Photo policy differs for card vs PIN (a PIN can be shared with a colleague)
    const photoRequired = viaPin ? company.pin_photo_required : company.photo_required

    // Can this person still pair a card? Only over PIN (the card branch already
    // has one by definition), only when the company allows it, and only while
    // the profile has no card yet.
    const canEnrollCard = viaPin && company.card_self_enroll && !profile.nfc_uid

    // -------------------------------------------------------------------------
    // action:'enroll_card' — the worker pairs their own card, identified by PIN.
    //
    // This is the ONLY write the PIN authorises, and it is deliberately narrow:
    // it can fill an empty field, never overwrite a populated one. A leaked PIN
    // therefore cannot take over a colleague's existing card; at worst it claims
    // a card for someone who has none — which the audit column below records,
    // and which the real worker notices immediately (they can no longer pair).
    // -------------------------------------------------------------------------
    if (action === 'enroll_card') {
      if (!viaPin) {
        return json({ error: 'PIN required to pair a card', code: 'ENROLL_NEEDS_PIN' }, 400)
      }
      if (!company.card_self_enroll) {
        return json({ error: 'Card pairing is disabled for this company', code: 'ENROLL_DISABLED' }, 403)
      }
      if (profile.nfc_uid) {
        return json({ error: 'This profile already has a card', code: 'ENROLL_HAS_CARD' }, 409)
      }
      if (!nfc_uid) {
        return json({ error: 'nfc_uid required', code: 'ENROLL_NO_UID' }, 400)
      }

      const uid = normalizeUid(nfc_uid)
      if (!uid) {
        return json({ error: 'Unreadable card', code: 'ENROLL_BAD_UID' }, 400)
      }

      // The card must be free within this company. Both spellings are checked,
      // because manually entered identifiers may carry the colon-separated form.
      const variants = [uid, uid.replace(/(.{2})/g, '$1:').slice(0, -1)]
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', company.id)
        .in('nfc_uid', variants)
        .maybeSingle()
      if (taken) {
        return json({ error: 'This card belongs to someone else', code: 'ENROLL_TAKEN' }, 409)
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ nfc_uid: uid, nfc_uid_enrolled_at: new Date().toISOString() })
        .eq('id', profile.id)
        .is('nfc_uid', null)          // last-line guard against a concurrent pairing
      if (updErr) throw updErr

      return json({ ok: true, code: 'ENROLLED', user: { name: profile.name } })
    }

    // -------------------------------------------------------------------------
    // action:'sync' — replay a single event recorded while the scanner was
    // offline. Uses the client's original type + timestamp, and a
    // client_event_id so a retried request never double-inserts.
    // -------------------------------------------------------------------------
    if (action === 'sync') {
      if (offline_type !== 'checkin' && offline_type !== 'checkout') {
        return json({ error: 'offline_type must be checkin/checkout', code: 'BAD_SYNC' }, 400)
      }
      if (!offline_timestamp) {
        return json({ error: 'offline_timestamp required', code: 'BAD_SYNC' }, 400)
      }

      // Guest validity is judged at the time the event happened, not now.
      if (
        profile.role === 'guest' &&
        profile.guest_expires_at &&
        new Date(profile.guest_expires_at) < new Date(offline_timestamp)
      ) {
        return json(
          { error: 'Guest pass expired', code: 'GUEST_EXPIRED', user: { name: profile.name } },
          403
        )
      }

      // Idempotency: if this client_event_id was already stored, we're done —
      // and we must NOT upload another photo copy.
      if (client_event_id) {
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('client_event_id', client_event_id)
          .maybeSingle()
        if (existing) return json({ ok: true, code: 'ALREADY_SYNCED' })
      }

      let photoPath: string | null = null
      if (photo_base64) {
        const raw = String(photo_base64).replace(/^data:image\/\w+;base64,/, '')
        const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
        photoPath = `${company.id}/${profile.id}/${Date.now()}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('checkin-photos')
          .upload(photoPath, bytes, { contentType: 'image/jpeg' })
        if (uploadErr) {
          return json({ error: 'Photo upload failed', code: 'PHOTO_UPLOAD_FAILED' }, 500)
        }
      }

      const { data: event, error: insertErr } = await supabase
        .from('events')
        .insert({
          company_id: company.id,
          user_id: profile.id,
          type: offline_type,
          timestamp: offline_timestamp,
          photo_url: photoPath,
          client_event_id: client_event_id ?? null,
        })
        .select('id, type, timestamp')
        .single()

      if (insertErr) {
        // Unique violation → another request already stored this id.
        if (insertErr.code === '23505') return json({ ok: true, code: 'ALREADY_SYNCED' })
        throw insertErr
      }

      return json({ ok: true, user: { id: profile.id, name: profile.name }, event })
    }

    // -------------------------------------------------------------------------
    // Default: live (online) check-in / check-out
    // -------------------------------------------------------------------------

    // Guest cards stop working after their expiry time
    if (profile.role === 'guest' && profile.guest_expires_at && new Date(profile.guest_expires_at) < new Date()) {
      return json(
        { error: 'Guest pass expired', code: 'GUEST_EXPIRED', user: { name: profile.name } },
        403
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

    // Two-step flow: if a photo is required (card or PIN policy) and none was
    // sent yet, tell the client to capture one — don't insert the event or run
    // deduplication until the follow-up request arrives with the photo.
    if (photoRequired && !photo_base64) {
      return json({
        needs_photo: true,
        user: { id: profile.id, name: profile.name, role: profile.role },
      })
    }

    // Deduplication: block if same type within 30 seconds
    const { data: recent } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', profile.id)
      .eq('type', eventType)
      .gte('timestamp', new Date(Date.now() - 30_000).toISOString())
      .maybeSingle()

    if (recent) {
      return json({ error: 'Duplicate event', code: 'DUPLICATE' }, 409)
    }

    // Upload photo (if provided) before inserting the event
    let photoPath: string | null = null
    if (photo_base64) {
      const raw = String(photo_base64).replace(/^data:image\/\w+;base64,/, '')
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
      photoPath = `${company.id}/${profile.id}/${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('checkin-photos')
        .upload(photoPath, bytes, { contentType: 'image/jpeg' })
      if (uploadErr) {
        return json({ error: 'Photo upload failed', code: 'PHOTO_UPLOAD_FAILED' }, 500)
      }
    }

    // Insert event
    const { data: event, error: insertErr } = await supabase
      .from('events')
      .insert({
        company_id: company.id,
        user_id: profile.id,
        type: eventType,
        photo_url: photoPath,
      })
      .select('id, type, timestamp')
      .single()

    if (insertErr) throw insertErr

    return json({
      user: { id: profile.id, name: profile.name, role: profile.role },
      event: { id: event.id, type: event.type, timestamp: event.timestamp },
      // The scanner offers card pairing AFTER a successful check-in, so the
      // attendance record never depends on whether the worker goes through with it.
      can_enroll_card: canEnrollCard,
    })
  } catch (err) {
    return json({ error: 'Internal server error' }, 500)
  }
})
