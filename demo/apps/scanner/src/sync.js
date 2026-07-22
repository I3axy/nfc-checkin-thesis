// -----------------------------------------------------------------------------
// Replays queued offline events to the checkin function, in order.
//
// Each item is sent with action:'sync', its original timestamp and a
// client_event_id so the server insert is idempotent. An item is removed from
// the queue only once the server has durably accepted it (or reports it was
// already stored). A transient/network failure stops the run so the remaining
// items are retried on the next attempt — order is preserved.
// -----------------------------------------------------------------------------
import { getQueue, dequeue, queueCount } from './db.js'

export async function syncQueue({ functionUrl, companySlug, onProgress }) {
  const items = await getQueue()
  let synced = 0

  for (const item of items) {
    let done = false
    try {
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfc_uid: item.uid,
          company_slug: companySlug,
          action: 'sync',
          offline_type: item.type,
          offline_timestamp: item.timestamp,
          client_event_id: item.client_event_id,
          ...(item.photo_base64 ? { photo_base64: item.photo_base64 } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok || data.code === 'ALREADY_SYNCED') {
        done = true // stored (or already stored on a previous retry)
      } else if (data.code === 'UNKNOWN_CARD' || data.code === 'GUEST_EXPIRED') {
        // Permanent: the card is invalid server-side. Drop it rather than let
        // it block every later item in the queue forever.
        done = true
      } else {
        break // transient server error — keep it, retry later
      }
    } catch {
      break // offline / network error — keep it, retry later
    }

    if (done) {
      await dequeue(item.id)
      synced++
      onProgress?.()
    }
  }

  return { synced, remaining: await queueCount() }
}
