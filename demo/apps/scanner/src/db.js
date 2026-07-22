// -----------------------------------------------------------------------------
// Offline store for the scanner (IndexedDB via Dexie).
//
// Four tables:
//   roster – cached staff/guest list so a card can be recognised offline
//   state  – last known event type per card, so we can toggle in/out offline
//   queue  – events recorded while offline, waiting to be synced
//   meta   – small key/value cache (photo_required, last roster refresh time)
// -----------------------------------------------------------------------------
import Dexie from 'dexie'

export const db = new Dexie('nfc_scanner')
db.version(1).stores({
  roster: 'uid',   // { uid, name, role, guest_expires_at }
  state: 'uid',    // { uid, type }
  queue: '++id',   // { id, uid, name, type, timestamp, client_event_id, photo_base64 }
  meta: 'key',     // { key, value }
})

// Same normalisation the checkin function uses — must match on both sides.
export function normalizeUid(raw) {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// --- roster -----------------------------------------------------------------

// Replace the cached roster and seed per-card state from the server, then
// replay any still-queued offline events on top so the in/out state stays
// correct for people whose latest tap hasn't been synced yet.
export async function cacheRoster({ profiles = [], photo_required = false }) {
  await db.transaction('rw', db.roster, db.state, db.queue, db.meta, async () => {
    await db.roster.clear()
    await db.roster.bulkPut(
      profiles.map((p) => ({
        uid: p.uid,
        name: p.name,
        role: p.role,
        guest_expires_at: p.guest_expires_at ?? null,
      }))
    )
    for (const p of profiles) {
      if (p.state) await db.state.put({ uid: p.uid, type: p.state })
    }
    const pending = await db.queue.orderBy('id').toArray()
    for (const item of pending) {
      await db.state.put({ uid: item.uid, type: item.type })
    }
    await db.meta.put({ key: 'photo_required', value: !!photo_required })
    await db.meta.put({ key: 'roster_cached_at', value: Date.now() })
  })
}

export function lookupCard(uid) {
  return db.roster.get(uid)
}

export async function rosterCount() {
  return db.roster.count()
}

// --- in/out state -----------------------------------------------------------

export async function getState(uid) {
  const s = await db.state.get(uid)
  return s?.type
}

export function setState(uid, type) {
  return db.state.put({ uid, type })
}

// --- offline queue ----------------------------------------------------------

export function enqueue(item) {
  return db.queue.add(item)
}

export function getQueue() {
  return db.queue.orderBy('id').toArray()
}

export function dequeue(id) {
  return db.queue.delete(id)
}

export function queueCount() {
  return db.queue.count()
}

// --- meta -------------------------------------------------------------------

export async function getMeta(key) {
  const m = await db.meta.get(key)
  return m?.value
}
