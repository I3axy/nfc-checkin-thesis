import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { C, S, CAL, R, tint } from '../lib/theme'
import { calcDayMinutes, isWorkerLate, fmtMins, fmtClock, HU_DAYS, HU_MONTHS } from '../lib/utils'
import { Table, Th, TableEmpty, SectionLabel, Badge, EmptyState } from '../components/ui'

const MONO = "'JetBrains Mono', monospace"
const HU_DAYS_MON = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']   // hétfővel kezdve

// ─── Naptári periódusok ───────────────────────────────────────────────────────
// A gördülő "utolsó N nap" helyett naptári egységekkel dolgozunk: így a hét
// természetesen hétfőn kezdődik, és vissza lehet lépni korábbi időszakokra.
const PERIODS = [
  { key: 'week', label: 'Hét' },
  { key: 'month', label: 'Hónap' },
  { key: 'quarter', label: 'Negyedév' },
]

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const midnight = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// A hét hétfővel kezdődik (JS-ben a vasárnap a 0, ezért az eltolás)
function startOfWeek(d) {
  const x = midnight(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function periodStart(period, d) {
  if (period === 'week') return startOfWeek(d)
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)   // negyedév
}

function periodEnd(period, start) {
  if (period === 'week') return addDays(start, 7)
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1)
  return new Date(start.getFullYear(), start.getMonth() + 3, 1)
}

function shiftPeriod(period, start, dir) {
  if (period === 'week') return addDays(start, 7 * dir)
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + dir, 1)
  return new Date(start.getFullYear(), start.getMonth() + 3 * dir, 1)
}

function periodLabel(period, start) {
  if (period === 'week') {
    const end = addDays(start, 6)
    const sameMonth = start.getMonth() === end.getMonth()
    return sameMonth
      ? `${start.getFullYear()}. ${HU_MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}.`
      : `${HU_MONTHS[start.getMonth()]} ${start.getDate()}. – ${HU_MONTHS[end.getMonth()]} ${end.getDate()}.`
  }
  if (period === 'month') return `${start.getFullYear()}. ${HU_MONTHS[start.getMonth()]}`
  return `${start.getFullYear()}. ${Math.floor(start.getMonth() / 3) + 1}. negyedév`
}

export function InsightsTab({ employees, settings }) {
  const staff = useMemo(() => employees.filter(e => e.role !== 'guest'), [employees])
  const [selectedId, setSelectedId] = useState('')
  const [period, setPeriod] = useState('week')
  const [anchor, setAnchor] = useState(() => periodStart('week', new Date()))
  const [data, setData] = useState({ events: [], absences: [], loading: true })
  const [selectedKey, setSelectedKey] = useState(null)     // kiválasztott nap (ymd) vagy hét-kezdet
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => { if (staff.length > 0 && !selectedId) setSelectedId(staff[0].id) }, [staff, selectedId])
  const sel = staff.find(e => e.id === selectedId) ?? staff[0]

  // Periódusváltáskor az aktuális dátumhoz igazodó kezdet
  function changePeriod(p) {
    setPeriod(p)
    setAnchor(periodStart(p, anchor))
    setSelectedKey(null)
  }

  const start = anchor
  const end = periodEnd(period, start)
  const prevStart = shiftPeriod(period, start, -1)

  // Az előző periódust is lekérjük, mert abból számoljuk a trendet
  useEffect(() => {
    if (!sel?.id) return
    let alive = true
    setData(d => ({ ...d, loading: true }))
    Promise.all([
      supabase.from('events')
        .select('id, type, timestamp, is_manual, note, photo_url')
        .eq('user_id', sel.id)
        .gte('timestamp', prevStart.toISOString())
        .lt('timestamp', end.toISOString())
        .order('timestamp', { ascending: true }),
      supabase.from('absences')
        .select('date, type, note')
        .eq('user_id', sel.id)
        .gte('date', ymd(prevStart))
        .lt('date', ymd(end)),
    ]).then(([{ data: evts }, { data: abs }]) => {
      if (alive) setData({ events: evts ?? [], absences: abs ?? [], loading: false })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, period, start.getTime()])

  // ── Napi bontás egy tetszőleges [from, to) intervallumra ──────────────────
  const buildDays = (from, to) => {
    const out = []
    for (let d = new Date(from); d < to; d = addDays(d, 1)) {
      const key = ymd(d)
      const dayEvts = data.events.filter(e => ymd(new Date(e.timestamp)) === key)
      const firstIn = dayEvts.find(e => e.type === 'checkin')?.timestamp ?? null
      out.push({
        key, date: new Date(d), events: dayEvts,
        mins: calcDayMinutes(dayEvts),
        firstIn,
        lastOut: [...dayEvts].reverse().find(e => e.type === 'checkout')?.timestamp ?? null,
        late: firstIn ? isWorkerLate(firstIn, settings) : false,
        absence: data.absences.find(a => a.date === key)?.type ?? null,
      })
    }
    return out
  }

  const days = useMemo(() => buildDays(start, end), [data, start, end, settings])
  const prevDays = useMemo(() => buildDays(prevStart, start), [data, prevStart, start, settings])

  const stats = useMemo(() => summarize(days), [days])
  const prev = useMemo(() => summarize(prevDays), [prevDays])
  const trendPct = prev.totalMins > 0 ? Math.round(((stats.totalMins - prev.totalMins) / prev.totalMins) * 100) : null

  // Negyedévnél heti oszlopok, egyébként napi
  const bars = useMemo(() => period === 'quarter' ? groupByWeek(days) : days.map(d => ({
    key: d.key, label: period === 'week' ? HU_DAYS_MON[(d.date.getDay() + 6) % 7] : String(d.date.getDate()),
    full: `${HU_MONTHS[d.date.getMonth()]} ${d.date.getDate()}.`,
    mins: d.mins, weekend: [0, 6].includes(d.date.getDay()), absence: d.absence, late: d.late,
  })), [days, period])

  const maxMins = Math.max(480, ...bars.map(b => b.mins))
  const hasData = stats.totalMins > 0 || days.some(d => d.events.length > 0)

  const selectedDay = selectedKey ? days.find(d => d.key === selectedKey) : null
  const selectedWeek = period === 'quarter' && selectedKey ? bars.find(b => b.key === selectedKey) : null

  if (staff.length === 0) return <EmptyState>Nincs dolgozó</EmptyState>

  const isIn = sel.lastEvent?.type === 'checkin'

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Fejléc ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setSelectedKey(null) }} style={{ ...S.input, width: 'auto', minWidth: 190 }}>
          {staff.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <Badge color={isIn ? C.green : C.muted}>{isIn ? 'Bent' : 'Kint'}</Badge>
        {sel.department && <span style={{ fontSize: '0.78rem', color: C.muted }}>{sel.department}</span>}
        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 4, background: C.bg1, border: `1px solid ${C.border}`, padding: 4 }}>
          {PERIODS.map(p => (
            <button key={p.key} type="button" onClick={() => changePeriod(p.key)} style={{
              padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: period === p.key ? 600 : 500,
              background: period === p.key ? tint(C.accent, 12) : 'transparent',
              color: period === p.key ? C.accent : C.muted, border: 'none', cursor: 'pointer',
            }}>{p.label}</button>
          ))}
        </div>

        <button type="button" onClick={() => setAiOpen(o => !o)} title="MI összefoglaló" style={{
          padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 700,
          background: aiOpen ? tint(C.green, 18) : tint(C.green, 10),
          color: C.green, border: `1px solid ${tint(C.green, 30)}`,
          cursor: 'pointer', letterSpacing: '0.02em',
        }}>MI</button>
      </div>

      {/* ── Időszak-navigáció ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" onClick={() => { setAnchor(a => shiftPeriod(period, a, -1)); setSelectedKey(null) }} style={S.btnIcon}>‹</button>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, minWidth: 210, textAlign: 'center' }}>
          {periodLabel(period, start)}
        </span>
        <button
          type="button"
          onClick={() => { setAnchor(a => shiftPeriod(period, a, 1)); setSelectedKey(null) }}
          disabled={end > new Date()}
          style={{ ...S.btnIcon, opacity: end > new Date() ? 0.35 : 1 }}
        >›</button>
        <button type="button" onClick={() => { setAnchor(periodStart(period, new Date())); setSelectedKey(null) }} style={{ ...S.btnIcon, marginLeft: '0.25rem' }}>Ma</button>
        {data.loading && <span style={{ fontSize: '0.75rem', color: C.muted }}>betöltés…</span>}
      </div>

      {/* ── KPI kártyák ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Kpi label="Ledolgozott idő" value={fmtMins(stats.totalMins)} color={C.green}
          sub={trendPct !== null ? `${trendPct >= 0 ? '▲' : '▼'} ${Math.abs(trendPct)}% az előző időszakhoz` : 'nincs összehasonlítás'}
          subColor={trendPct === null ? C.muted : trendPct >= 0 ? C.green : C.red} />
        <Kpi label="Munkanapok" value={stats.workDays} color={C.text} sub={periodLabel(period, start)} />
        <Kpi label="Késések" value={stats.lateDays} color={stats.lateDays > 0 ? CAL.late.bar : C.muted}
          sub={stats.workDays > 0 ? `${Math.round((stats.lateDays / stats.workDays) * 100)}% a munkanapokból` : '—'} />
        <Kpi label="Átl. érkezés" value={stats.avgArrival ?? '—'} color={C.accent} mono
          sub={`küszöb: ${String(settings.startHour).padStart(2, '0')}:${String(settings.startMinute).padStart(2, '0')}`} />
        <Kpi label="Szünet összesen" value={fmtMins(stats.breakMins)} color={C.muted} sub={`${stats.breakCount} alkalom`} />
      </div>

      {/* ── Grafikon + részletező ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', alignItems: 'start' }}>

        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.85rem' }}>
            {period === 'quarter' ? 'Heti bontás' : 'Napi bontás'}
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: '0.5rem' }}>
              — kattints egy oszlopra a részletekért
            </span>
          </div>

          {!hasData && !data.loading ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: C.muted, fontSize: '0.85rem' }}>
              Nincs rögzített esemény ebben az időszakban.
            </div>
          ) : (
            <BarChart bars={bars} maxMins={maxMins} selectedKey={selectedKey} onSelect={setSelectedKey} settings={settings} />
          )}
        </div>

        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '1rem', minHeight: 260 }}>
          {selectedDay
            ? <DayDetail day={selectedDay} settings={settings} />
            : selectedWeek
              ? <WeekDetail week={selectedWeek} days={days} onPickDay={setSelectedKey} />
              : <div style={{ color: C.muted, fontSize: '0.85rem', padding: '2.5rem 1rem', textAlign: 'center' }}>
                  Válassz egy {period === 'quarter' ? 'hetet' : 'napot'} a grafikonon a részletes aktivitás megtekintéséhez.
                </div>
          }
        </div>
      </div>

      {aiOpen && <AiPanel worker={sel} periodText={periodLabel(period, start)} stats={stats} trendPct={trendPct} onClose={() => setAiOpen(false)} />}

      <div style={{ height: '2rem' }} />
      <MonthlySummary employees={employees} settings={settings} />
    </div>
  )
}

// ─── Oszlopdiagram (saját, hogy a kattintás és a hétvége-jelölés kézben legyen)
function BarChart({ bars, maxMins, selectedKey, onSelect, settings }) {
  const gridHours = [0, 2, 4, 6, 8].filter(h => h * 60 <= maxMins + 60)
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 170, position: 'relative', borderBottom: `1px solid ${C.border}`, paddingBottom: 2 }}>
        {/* vízszintes segédvonalak */}
        {gridHours.map(h => (
          <div key={h} style={{ position: 'absolute', left: 0, right: 0, bottom: (h * 60 / maxMins) * 100 + '%', borderTop: `1px dashed ${C.border}`, opacity: 0.5 }}>
            <span style={{ position: 'absolute', left: 0, top: -14, fontSize: '0.6rem', color: C.muted }}>{h}h</span>
          </div>
        ))}
        {bars.map(b => {
          const active = selectedKey === b.key
          const h = maxMins > 0 ? (b.mins / maxMins) * 100 : 0
          const color = b.absence ? (b.absence === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar)
            : b.mins === 0 ? C.bg2
            : b.late ? CAL.late.bar
            : b.mins >= 480 ? C.accent : C.green
          return (
            <button
              key={b.key}
              onClick={() => onSelect(active ? null : b.key)}
              title={`${b.full} — ${fmtMins(b.mins)}`}
              style={{
                flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                background: active ? tint(C.accent, 10) : b.weekend ? tint(C.muted, 6) : 'transparent',
                border: 'none', borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                cursor: 'pointer', padding: 0,
              }}
            >
              <div style={{ height: `${Math.max(h, b.mins > 0 ? 2 : 0)}%`, background: color, opacity: active ? 1 : 0.85, transition: 'height 0.2s' }} />
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: '0.3rem' }}>
        {bars.map(b => (
          <div key={b.key} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '0.6rem', color: selectedKey === b.key ? C.accent : C.muted, fontWeight: selectedKey === b.key ? 700 : 400, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {b.label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.8rem' }}>
        {[[C.accent, '8h+'], [C.green, 'normál'], [CAL.late.bar, 'késett'], [CAL.justified.bar, 'hiányzás'], [C.bg2, 'nem volt']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 9, height: 9, background: c, border: `1px solid ${C.border}` }} />
            <span style={{ fontSize: '0.62rem', color: C.muted }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Napi részletező: 0–24 órás idősáv + minden tapp + szünetek ───────────────
function DayDetail({ day, settings }) {
  const segs = segments(day.events)
  const brs = breaks(segs)
  const mins = d => d.getHours() * 60 + d.getMinutes()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>
          {HU_DAYS_MON[(day.date.getDay() + 6) % 7]} · {HU_MONTHS[day.date.getMonth()]} {day.date.getDate()}.
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.green, fontFamily: MONO }}>{fmtMins(day.mins)}</span>
      </div>

      {day.absence && (
        <div style={{ fontSize: '0.78rem', color: day.absence === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar, marginBottom: '0.6rem', fontWeight: 600 }}>
          Rögzített hiányzás: {ABSENCE_LABELS[day.absence] ?? day.absence}
        </div>
      )}

      {/* 0–24 órás sáv */}
      <div style={{ position: 'relative', height: 26, background: C.bg0, border: `1px solid ${C.border}`, marginBottom: '0.3rem' }}>
        {[6, 12, 18].map(h => (
          <div key={h} style={{ position: 'absolute', left: `${(h / 24) * 100}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${C.border}` }} />
        ))}
        {segs.map((s, i) => (
          <div key={i} title={`${fmtClock(s.from)} – ${fmtClock(s.to)}`} style={{
            position: 'absolute', top: 3, bottom: 3,
            left: `${(mins(s.from) / 1440) * 100}%`,
            width: `${Math.max(((mins(s.to) - mins(s.from)) / 1440) * 100, 0.6)}%`,
            background: s.open ? tint(C.green, 45) : C.green,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: C.muted, marginBottom: '0.9rem' }}>
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span>
      </div>

      {/* Összesítő */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <MiniStat label="Érkezés" value={day.firstIn ? fmtClock(day.firstIn) : '—'} color={day.late ? CAL.late.bar : C.text} />
        <MiniStat label="Távozás" value={day.lastOut ? fmtClock(day.lastOut) : '—'} color={C.text} />
        <MiniStat label="Szünet" value={brs.length ? fmtMins(brs.reduce((s, b) => s + b.mins, 0)) : '—'} color={C.muted} />
      </div>

      {/* Minden tapp időrendben */}
      <div style={{ fontSize: '0.66rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
        Aktivitás ({day.events.length} esemény)
      </div>
      {day.events.length === 0
        ? <div style={{ fontSize: '0.8rem', color: C.muted, padding: '0.5rem 0' }}>Nincs esemény ezen a napon.</div>
        : <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {day.events.map((e, i) => {
              const br = brs.find(b => b.afterIndex === i)
              return (
                <div key={e.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ width: 20, height: 20, background: tint(e.type === 'checkin' ? C.green : C.red, 15), color: e.type === 'checkin' ? C.green : C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0 }}>
                      {e.type === 'checkin' ? '↑' : '↓'}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: '0.82rem', color: C.text }}>{fmtClock(e.timestamp)}</span>
                    <span style={{ fontSize: '0.76rem', color: C.muted }}>{e.type === 'checkin' ? 'belépés' : 'kilépés'}</span>
                    {e.is_manual && <span style={{ fontSize: '0.6rem', color: C.accent, border: `1px solid ${tint(C.accent, 28)}`, padding: '0 0.3rem' }}>kézi</span>}
                    {e.photo_url && <span title="fényképpel" style={{ fontSize: '0.72rem' }}>📷</span>}
                    {e.note && <span style={{ fontSize: '0.68rem', color: C.muted, marginLeft: 'auto' }}>{e.note}</span>}
                  </div>
                  {br && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0 0.2rem 1.6rem', fontSize: '0.7rem', color: CAL.late.bar }}>
                      ⏸ szünet — {fmtMins(br.mins)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

// ─── Heti részletező (negyedév nézetben) ─────────────────────────────────────
function WeekDetail({ week, days, onPickDay }) {
  const wDays = days.filter(d => d.key >= week.key && d.key < ymd(addDays(new Date(week.key), 7)))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{week.full}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.green, fontFamily: MONO }}>{fmtMins(week.mins)}</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: C.muted, marginBottom: '0.5rem' }}>Kattints egy napra a részletes aktivitásért.</div>
      {wDays.map(d => (
        <button key={d.key} onClick={() => onPickDay(d.key)} style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.45rem 0.5rem', border: 'none', borderBottom: `1px solid ${C.border}`,
          background: 'transparent', cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontFamily: MONO, fontSize: '0.8rem', color: C.text }}>
            {HU_DAYS_MON[(d.date.getDay() + 6) % 7]} {HU_MONTHS[d.date.getMonth()]} {d.date.getDate()}.
          </span>
          <span style={{ fontSize: '0.78rem', fontFamily: MONO, color: d.mins > 0 ? C.green : C.muted }}>
            {d.mins > 0 ? fmtMins(d.mins) : '—'}{d.events.length > 0 ? ` · ${d.events.length} tapp` : ''}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── MI panel — lebegő réteg, nem tolja el a tartalmat ───────────────────────
const LOADING_STEPS = [
  'Jelenléti adatok betöltése…',
  'Munkaidő-szakaszok elemzése…',
  'Késések és szünetek összevetése…',
  'Összefoglaló megfogalmazása…',
]

// A hibakódok emberi jelentése — a valódi API bekötése után ezek élesednek.
const ERROR_MEANINGS = {
  TIMEOUT: 'Az összefoglaló elkészítése túllépte a 30 másodperces időkorlátot.',
  NETWORK: 'Nem sikerült elérni a szolgáltatást. Ellenőrizd az internetkapcsolatot.',
  401: 'Hitelesítési hiba — az API kulcs hiányzik vagy érvénytelen.',
  429: 'Túl sok kérés rövid idő alatt. Próbáld újra egy perc múlva.',
  500: 'A szolgáltatás belső hibája.',
  503: 'A szolgáltatás átmenetileg nem elérhető.',
}

const AI_TIMEOUT_MS = 30000

function AiPanel({ worker, periodText, stats, trendPct, onClose }) {
  const [state, setState] = useState('loading')   // loading | done | error
  const [text, setText] = useState('')
  const [error, setError] = useState(null)        // { code, message }
  const [step, setStep] = useState(0)
  const abortRef = useRef(null)

  // Esc-re zárás
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Váltakozó töltőszöveg
  useEffect(() => {
    if (state !== 'loading') return
    const t = setInterval(() => setStep(s => (s + 1) % LOADING_STEPS.length), 1100)
    return () => clearInterval(t)
  }, [state])

  useEffect(() => {
    let alive = true
    setState('loading'); setError(null); setStep(0)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const timer = setTimeout(() => ctrl.abort('TIMEOUT'), AI_TIMEOUT_MS)

    requestSummary({ worker, periodText, stats, trendPct, signal: ctrl.signal })
      .then(res => { if (alive) { setText(res); setState('done') } })
      .catch(err => {
        if (!alive) return
        const code = err?.code ?? (ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK')
        setError({ code, message: ERROR_MEANINGS[code] ?? (err?.message || 'Ismeretlen hiba.') })
        setState('error')
      })
      .finally(() => clearTimeout(timer))

    return () => { alive = false; clearTimeout(timer); ctrl.abort() }
  }, [worker?.id, periodText, stats.totalMins, trendPct])

  return (
    <div style={{
      position: 'absolute', top: 46, right: 0, zIndex: 120, width: 'min(560px, 100%)',
      // Az áttetsző réteg színe témánként külön hangolt (--glass): fehér
      // felület fehér háttéren nem tudna átlátszónak látszani.
      background: C.glass,
      backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
      border: `1px solid ${tint(C.green, 30)}`, boxShadow: C.shadow,
      padding: '1rem 1.15rem', animation: 'fade-up 0.18s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.green, letterSpacing: '0.02em' }}>MI</span>
          <span style={{ fontSize: '0.72rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {worker?.name} · {periodText}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>

      {state === 'loading' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
            <span style={{ width: 12, height: 12, border: `2px solid ${tint(C.green, 30)}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: C.text }}>{LOADING_STEPS[step]}</span>
          </div>
          {[92, 78, 60].map((w, i) => (
            <div key={i} style={{ height: 9, width: `${w}%`, background: tint(C.green, 16), marginBottom: 6, animation: `shimmer 1.2s ease ${i * 0.15}s infinite` }} />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ width: 18, height: 18, background: tint(C.red, 15), color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>!</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.red }}>Az összefoglaló nem készült el</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: C.text, marginBottom: '0.4rem' }}>{error?.message}</div>
          <div style={{ fontSize: '0.72rem', color: C.muted, fontFamily: MONO }}>Hibakód: {error?.code}</div>
        </div>
      )}

      {state === 'done' && (
        <p style={{ fontSize: '0.86rem', color: C.text, lineHeight: 1.65, margin: 0 }}>{text}</p>
      )}

      <div style={{ fontSize: '0.66rem', color: C.muted, marginTop: '0.8rem' }}>
        A rögzített jelenléti adatokból generált összefoglaló.
      </div>
    </div>
  )
}

// A tényleges szöveg-előállítás. Jelenleg helyi generátor; a valódi API-hívás
// ide kerül (Edge Function -> Claude), a signal/hibakód szerződés változatlanul.
function requestSummary({ worker, periodText, stats, trendPct, signal }) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(buildSummary(worker?.name ?? '', periodText, stats, trendPct)), 900)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      const err = new Error('aborted'); err.code = signal.reason === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK'
      reject(err)
    })
  })
}

function buildSummary(name, periodText, s, trendPct) {
  const parts = []
  const avg = s.workDays > 0 ? Math.round(s.totalMins / s.workDays) : 0
  if (s.workDays === 0) return `${name} nevű dolgozónak a vizsgált időszakban (${periodText}) nincs rögzített munkaideje.`
  parts.push(`${name} a(z) ${periodText} időszakban ${fmtMins(s.totalMins)} munkaidőt teljesített ${s.workDays} munkanapon, ami napi átlagban ${fmtMins(avg)}.`)
  if (s.avgArrival) parts.push(`Átlagos érkezési ideje ${s.avgArrival}${s.lateDays > 0 ? `, ebből ${s.lateDays} alkalommal késett` : ', késés nélkül'}.`)
  if (s.breakCount > 0) parts.push(`Az időszak alatt ${s.breakCount} alkalommal hagyta el a munkaterületet, összesen ${fmtMins(s.breakMins)} időtartamra.`)
  if (s.justified + s.unjustified > 0) parts.push(`${s.justified} igazolt és ${s.unjustified} igazolatlan hiányzás került rögzítésre.`)
  if (trendPct !== null && Math.abs(trendPct) >= 3) parts.push(`Az előző időszakhoz képest a ledolgozott idő ${trendPct >= 0 ? 'nőtt' : 'csökkent'} ${Math.abs(trendPct)}%-kal.`)
  const lateRatio = s.workDays > 0 ? s.lateDays / s.workDays : 0
  if (s.unjustified > 0) parts.push('Az igazolatlan hiányzások kiemelt figyelmet igényelnek.')
  else if (lateRatio > 0.3) parts.push('A jelenlét stabil, a pontosságon azonban érdemes javítani.')
  else parts.push('Összességében megbízható, kiegyensúlyozott teljesítmény.')
  return parts.join(' ')
}

// ─── Segédfüggvények ─────────────────────────────────────────────────────────
const ABSENCE_LABELS = { vacation: 'Szabadság', sick: 'Betegszabadság', unjustified: 'Igazolatlan', other: 'Egyéb' }

// Jelenléti szakaszok: belépés -> kilépés párok. A nyitott szakasz (még bent
// van) a nap végéig, illetve a mai napon a jelenlegi időpontig tart.
function segments(events) {
  const out = []
  let open = null
  for (const e of events) {
    if (e.type === 'checkin') open = new Date(e.timestamp)
    else if (e.type === 'checkout' && open) { out.push({ from: open, to: new Date(e.timestamp), open: false }); open = null }
  }
  if (open) {
    const today = new Date()
    const sameDay = open.toDateString() === today.toDateString()
    const end = sameDay ? today : new Date(open.getFullYear(), open.getMonth(), open.getDate(), 23, 59)
    out.push({ from: open, to: end, open: true })
  }
  return out
}

// A szakaszok közti rések = szünetek (pl. ebéd, dohányzás — a kártyát az
// ajtónyitáshoz is használják, ezért ezek valós kilépésként jelennek meg).
function breaks(segs) {
  const out = []
  for (let i = 1; i < segs.length; i++) {
    const mins = Math.round((segs[i].from - segs[i - 1].to) / 60000)
    if (mins > 0) out.push({ mins, afterIndex: 2 * i - 1 })
  }
  return out
}

function summarize(days) {
  const arrivals = days.filter(d => d.firstIn).map(d => { const t = new Date(d.firstIn); return t.getHours() * 60 + t.getMinutes() })
  const avgMin = arrivals.length ? Math.round(arrivals.reduce((s, m) => s + m, 0) / arrivals.length) : null
  let breakMins = 0, breakCount = 0
  for (const d of days) {
    for (const b of breaks(segments(d.events))) { breakMins += b.mins; breakCount++ }
  }
  return {
    totalMins: days.reduce((s, d) => s + d.mins, 0),
    workDays: days.filter(d => d.mins > 0).length,
    lateDays: days.filter(d => d.late).length,
    avgArrival: avgMin !== null ? `${String(Math.floor(avgMin / 60)).padStart(2, '0')}:${String(avgMin % 60).padStart(2, '0')}` : null,
    justified: days.filter(d => d.absence && d.absence !== 'unjustified').length,
    unjustified: days.filter(d => d.absence === 'unjustified').length,
    breakMins, breakCount,
  }
}

function groupByWeek(days) {
  const map = new Map()
  for (const d of days) {
    const wk = ymd(startOfWeek(d.date))
    if (!map.has(wk)) map.set(wk, { key: wk, mins: 0, weekend: false, absence: null, late: false, date: startOfWeek(d.date) })
    const w = map.get(wk)
    w.mins += d.mins
    if (d.late) w.late = true
  }
  return [...map.values()].map(w => ({
    ...w,
    label: `${w.date.getMonth() + 1}.${w.date.getDate()}.`,
    full: `${HU_MONTHS[w.date.getMonth()]} ${w.date.getDate()}. hete`,
  }))
}

function Kpi({ label, value, color, sub, subColor, mono }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '0.85rem 1rem' }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1.3, letterSpacing: '-0.02em', fontFamily: mono ? MONO : 'inherit' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: subColor ?? C.muted, marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: C.bg0, border: `1px solid ${C.border}`, padding: '0.4rem 0.55rem' }}>
      <div style={{ fontSize: '0.6rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '0.92rem', fontWeight: 700, color, fontFamily: MONO }}>{value}</div>
    </div>
  )
}

// ─── Havi összesítő + Excel export (változatlan) ─────────────────────────────

function MonthlySummary({ employees, settings }) {
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [events, setEvents] = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(false)

  const workers = useMemo(() => employees.filter(e => e.role === 'worker'), [employees])

  useEffect(() => {
    setLoading(true)
    const from = month.toISOString()
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString()
    const fromD = ymd(month)
    const toD = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    Promise.all([
      supabase.from('events').select('user_id, type, timestamp').gte('timestamp', from).lt('timestamp', to).order('timestamp', { ascending: true }),
      supabase.from('absences').select('user_id, type').gte('date', fromD).lte('date', toD),
    ]).then(([{ data: evts }, { data: abs }]) => {
      setEvents(evts ?? []); setAbsences(abs ?? []); setLoading(false)
    })
  }, [month])

  const rows = useMemo(() => workers.map(w => {
    const wEvts = events.filter(e => e.user_id === w.id)
    const byDay = {}
    for (const e of wEvts) (byDay[e.timestamp.slice(0, 10)] ??= []).push(e)

    let totalMins = 0, workDays = 0, lateDays = 0
    for (const dayEvts of Object.values(byDay)) {
      const mins = calcDayMinutes(dayEvts)
      if (mins > 0) { totalMins += mins; workDays++ }
      const firstIn = dayEvts.find(e => e.type === 'checkin')?.timestamp
      if (firstIn && isWorkerLate(firstIn, settings)) lateDays++
    }
    const wAbs = absences.filter(a => a.user_id === w.id)
    return {
      name: w.name, department: w.department ?? '', totalMins, workDays, lateDays,
      justified: wAbs.filter(a => a.type !== 'unjustified').length,
      unjustified: wAbs.filter(a => a.type === 'unjustified').length,
    }
  }), [workers, events, absences, settings])

  function exportExcel() {
    const aoa = [
      ['Dolgozó', 'Részleg', 'Ledolgozott óra', 'Munkanapok', 'Késések', 'Igazolt hiányzás', 'Igazolatlan hiányzás'],
      ...rows.map(r => [r.name, r.department, +(r.totalMins / 60).toFixed(2), r.workDays, r.lateDays, r.justified, r.unjustified]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 17 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Összesítő')
    XLSX.writeFile(wb, `osszesito-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.xlsx`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <SectionLabel color={C.accent}>Havi összesítő — minden dolgozó</SectionLabel>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={S.btnIcon}>‹</button>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text, minWidth: 120, textAlign: 'center' }}>
          {month.toLocaleDateString('hu', { year: 'numeric', month: 'long' })}
        </span>
        <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={S.btnIcon}>›</button>
        <button type="button" onClick={exportExcel} disabled={rows.length === 0} style={{ ...S.btnSecondary, opacity: rows.length === 0 ? 0.5 : 1 }}>↓ Excel</button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Dolgozó</Th><Th>Részleg</Th><Th>Ledolg.</Th><Th>Munkanap</Th><Th>Késés</Th><Th>Ig. hiány</Th><Th>Igazolatlan</Th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <TableEmpty colSpan={7}>Betöltés…</TableEmpty>
            : rows.length === 0
              ? <TableEmpty colSpan={7}>Nincs dolgozó</TableEmpty>
              : rows.map(r => (
                <tr key={r.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...S.td, fontWeight: 600, color: C.text }}>{r.name}</td>
                  <td style={{ ...S.td, color: C.muted, fontSize: '0.8rem' }}>{r.department || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: C.green, fontFamily: MONO }}>{fmtMins(r.totalMins)}</td>
                  <td style={{ ...S.td, fontFamily: MONO }}>{r.workDays}</td>
                  <td style={{ ...S.td, fontFamily: MONO, color: r.lateDays > 0 ? CAL.late.bar : C.muted }}>{r.lateDays}</td>
                  <td style={{ ...S.td, fontFamily: MONO, color: r.justified > 0 ? CAL.justified.bar : C.muted }}>{r.justified}</td>
                  <td style={{ ...S.td, fontFamily: MONO, color: r.unjustified > 0 ? CAL.unjustified.bar : C.muted }}>{r.unjustified}</td>
                </tr>
              ))
          }
        </tbody>
      </Table>
    </div>
  )
}
