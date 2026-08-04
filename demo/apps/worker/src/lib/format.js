// Formázó és számoló segédfüggvények. Külön fájlban, mert a felülettől
// függetlenül tesztelhetők — a munkaidő-számítás és a hiányzás-csoportosítás
// a rendszer két olyan pontja, ahol a hiba észrevétlen marad.

export const HU_DAYS   = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']
export const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

export const ABSENCE_LABELS = {
  vacation: 'Szabadság',
  sick: 'Betegszabadság',
  unjustified: 'Igazolatlan',
  other: 'Egyéb',
}

// A dolgozó által beküldött hiányzás kérelem: a vezető dönt róla.
export const STATUS_LABELS = {
  pending:  'Elbírálásra vár',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
}

export const STATUS_COLORS = {
  pending:  'var(--warn)',
  approved: 'var(--green)',
  rejected: 'var(--red)',
}

export const fmtTime = ts =>
  new Date(ts).toLocaleTimeString('hu', { hour: '2-digit', minute: '2-digit' })

// "5ó 20p" — a dolgozó a telefonján egy pillantással nézi, ezért rövid.
export function fmtMins(m) {
  if (!m || m < 1) return '—'
  const h = Math.floor(m / 60), min = Math.floor(m % 60)
  return h === 0 ? `${min}p` : min === 0 ? `${h}ó` : `${h}ó ${min}p`
}

// ─── Dátum ───────────────────────────────────────────────────────────────────

export const toYmd = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// "ma", "tegnap", "kedd" vagy "aug. 1." — a közeli napokat névvel könnyebb
// azonosítani, a régebbieket dátummal.
export function dayLabel(date) {
  const now = new Date()
  const mid = x => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diff = Math.round((mid(now) - mid(date)) / 86400000)
  if (diff === 0) return 'ma'
  if (diff === 1) return 'tegnap'
  if (diff < 7 && diff > 0) return HU_DAYS[date.getDay()]
  return `${HU_MONTHS[date.getMonth()]} ${date.getDate()}.`
}

// "aug. 4." illetve "aug. 4 – 15." egy tartományra
export function rangeLabel(fromYmd, toYmd_) {
  const a = parseYmd(fromYmd), b = parseYmd(toYmd_)
  if (fromYmd === toYmd_) return `${HU_MONTHS[a.getMonth()]} ${a.getDate()}.`
  if (a.getMonth() === b.getMonth()) return `${HU_MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}.`
  return `${HU_MONTHS[a.getMonth()]} ${a.getDate()}. – ${HU_MONTHS[b.getMonth()]} ${b.getDate()}.`
}

// ─── Munkaidő ────────────────────────────────────────────────────────────────

// Egy nap ledolgozott perceinek összege. A nyitva maradt belépés csak a MAI
// napon számít a jelen pillanatig — egy korábbi nap nyitott bejegyzése nem
// növekedhet a végtelenségig.
export function calcDayMins(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  let total = 0, lastIn = null
  for (const e of sorted) {
    if (e.type === 'checkin') lastIn = new Date(e.timestamp)
    else if (e.type === 'checkout' && lastIn) {
      total += (new Date(e.timestamp) - lastIn) / 60000
      lastIn = null
    }
  }
  if (lastIn && isSameDay(lastIn, new Date())) total += (Date.now() - lastIn) / 60000
  return Math.max(0, Math.floor(total))
}

// Eseményekből naponkénti bontás, legfrissebb elöl.
export function groupByDay(events) {
  const map = new Map()
  for (const e of events) {
    const d = new Date(e.timestamp)
    const key = toYmd(d)
    if (!map.has(key)) map.set(key, { key, date: d, events: [] })
    map.get(key).events.push(e)
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(d => ({
      ...d,
      events: [...d.events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      minutes: calcDayMins(d.events),
    }))
}

// ─── Hiányzások ──────────────────────────────────────────────────────────────

// Két nap akkor is egybefüggő, ha csak hétvége van közöttük: a péntek és a
// rákövetkező hétfő ugyanannak a szabadságnak a része.
export function continuesFrom(prevYmd, nextYmd) {
  const d = parseYmd(prevYmd), end = parseYmd(nextYmd)
  d.setDate(d.getDate() + 1)
  while (d < end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) return false   // munkanap a résben
    d.setDate(d.getDate() + 1)
  }
  return d.getTime() === end.getTime()
}

// Az egymást követő, azonos típusú, megjegyzésű ÉS állapotú napok egy tételként
// jelennek meg — különben egy kéthetes szabadság tíz sorként látszana. Az
// állapot azért töri a sorozatot, mert egy részben jóváhagyott időszakot
// egyetlen tételként mutatni félrevezető lenne.
export function groupRuns(list) {
  const sorted = [...(list ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const runs = []
  for (const a of sorted) {
    const last = runs[runs.length - 1]
    const follows = last && continuesFrom(last.to, a.date)
    const same = last
      && last.type === a.type
      && (last.note ?? '') === (a.note ?? '')
      && (last.status ?? 'approved') === (a.status ?? 'approved')
    if (follows && same) {
      last.to = a.date; last.days++; last.ids.push(a.id)
    } else {
      runs.push({
        from: a.date, to: a.date, type: a.type, note: a.note,
        status: a.status ?? 'approved', decisionNote: a.decision_note ?? null,
        ids: [a.id], days: 1,
      })
    }
  }
  return runs.reverse()
}

// Hány munkanapot érint a megadott tartomány (előnézethez a beküldés előtt).
export function countWorkdays(fromYmd, toYmd_, skipWeekends = true) {
  if (!fromYmd || !toYmd_ || toYmd_ < fromYmd) return 0
  let n = 0
  const end = parseYmd(toYmd_)
  for (const d = parseYmd(fromYmd); d <= end; d.setDate(d.getDate() + 1)) {
    if (skipWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue
    n++
    if (n > 400) break
  }
  return n
}
