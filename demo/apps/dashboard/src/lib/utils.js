export const HU_DAYS   = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']
export const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

export function getDaySummary(userEvents) {
  const today = new Date().toDateString()
  const sorted = userEvents
    .filter(e => new Date(e.timestamp).toDateString() === today)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let totalMinutes = 0, checkins = 0, lastIn = null, firstIn = null, lastOut = null
  for (const e of sorted) {
    if (e.type === 'checkin') {
      checkins++
      const at = new Date(e.timestamp)
      if (!firstIn) firstIn = at
      lastIn = at
    } else if (e.type === 'checkout') {
      const at = new Date(e.timestamp)
      lastOut = at
      if (lastIn) { totalMinutes += (at - lastIn) / 60000; lastIn = null }
    }
  }
  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000
  return { totalMinutes: Math.floor(totalMinutes), checkins, firstIn, lastOut }
}

export function calcRangeMinutes(userEvents, days) {
  const cutoff = Date.now() - days * 86400000
  const sorted = userEvents
    .filter(e => new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let totalMinutes = 0, lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') lastIn = new Date(e.timestamp)
    else if (e.type === 'checkout' && lastIn) { totalMinutes += (new Date(e.timestamp) - lastIn) / 60000; lastIn = null }
  }
  if (lastIn) totalMinutes += (Date.now() - lastIn) / 60000
  return Math.max(0, Math.floor(totalMinutes))
}

export function countRangeEvents(userEvents, days) {
  return userEvents.filter(e => new Date(e.timestamp).getTime() >= Date.now() - days * 86400000).length
}

export function calcDayMinutes(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let total = 0, lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') lastIn = new Date(e.timestamp)
    else if (e.type === 'checkout' && lastIn) { total += (new Date(e.timestamp) - lastIn) / 60000; lastIn = null }
  }
  if (lastIn && new Date().toDateString() === new Date(lastIn).toDateString()) total += (Date.now() - lastIn) / 60000
  return Math.floor(total)
}

export function isWorkerLate(timestamp, settings) {
  const d = new Date(timestamp)
  const threshold = new Date(d)
  threshold.setHours(settings.startHour, settings.startMinute + settings.lateThresholdMinutes, 0, 0)
  return d > threshold
}

export function fmtMins(m) {
  if (m < 1) return '—'
  const h = Math.floor(m / 60), min = Math.floor(m % 60)
  return h === 0 ? `${min}m` : min === 0 ? `${h}h` : `${h}h ${min}m`
}

export function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Normalize an NFC UID the same way the checkin Edge Function does, so stored
// values always match what the scanner sends (uppercase, no separators).
export function normalizeUid(raw) {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
