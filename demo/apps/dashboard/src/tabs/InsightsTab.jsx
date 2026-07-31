import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { C, S, CAL, R, tint } from '../lib/theme'
import { calcDayMinutes, isWorkerLate, fmtMins, fmtClock, HU_DAYS, HU_MONTHS } from '../lib/utils'
import { Table, Th, TableEmpty, SectionLabel, Badge, EmptyState } from '../components/ui'

const MONO = "'JetBrains Mono', monospace"
const PERIODS = [
  { days: 7,  label: '7 nap' },
  { days: 30, label: '30 nap' },
  { days: 90, label: '3 hónap' },
]

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function InsightsTab({ employees, settings }) {
  const staff = useMemo(() => employees.filter(e => e.role !== 'guest'), [employees])
  const [selectedId, setSelectedId] = useState('')
  const [period, setPeriod] = useState(7)
  const [range, setRange] = useState({ events: [], absences: [], loading: true })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiState, setAiState] = useState('idle')   // idle | thinking | done
  const [aiText, setAiText] = useState('')

  useEffect(() => { if (staff.length > 0 && !selectedId) setSelectedId(staff[0].id) }, [staff, selectedId])
  const sel = staff.find(e => e.id === selectedId) ?? staff[0]

  // Fetch 2× the window for the selected worker: current period + the one
  // before it (the previous period feeds the trend comparison).
  useEffect(() => {
    if (!sel?.id) return
    let alive = true
    setRange(r => ({ ...r, loading: true }))
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (2 * period - 1))
    Promise.all([
      supabase.from('events').select('type, timestamp').eq('user_id', sel.id).gte('timestamp', from.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('absences').select('date, type').eq('user_id', sel.id).gte('date', ymd(from)),
    ]).then(([{ data: evts }, { data: abs }]) => {
      if (alive) setRange({ events: evts ?? [], absences: abs ?? [], loading: false })
    })
    return () => { alive = false }
  }, [sel?.id, period])

  // Per-day stats for a window ending `endOffset` days before today
  const buildDays = (endOffset) => Array.from({ length: period }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (period - 1 - i) - endOffset)
    const dateKey = d.toDateString()
    const dayEvts = range.events.filter(e => new Date(e.timestamp).toDateString() === dateKey)
    const firstIn = dayEvts.find(e => e.type === 'checkin')?.timestamp ?? null
    const lastOut = [...dayEvts].reverse().find(e => e.type === 'checkout')?.timestamp ?? null
    return {
      date: d, mins: calcDayMinutes(dayEvts), firstIn, lastOut,
      late: firstIn ? isWorkerLate(firstIn, settings) : false,
      absence: range.absences.find(a => a.date === ymd(d))?.type ?? null,
    }
  })

  const days     = useMemo(buildDays.bind(null, 0),      [range, period, settings])       // current window
  const prevDays = useMemo(buildDays.bind(null, period), [range, period, settings])       // previous window

  const stats = useMemo(() => summarize(days), [days])
  const prev  = useMemo(() => summarize(prevDays), [prevDays])
  const trendPct = prev.totalMins > 0 ? Math.round(((stats.totalMins - prev.totalMins) / prev.totalMins) * 100) : null

  const periodLabel = PERIODS.find(p => p.days === period)?.label ?? `${period} nap`

  // ── MI summary (placeholder generator — swap for an LLM Edge Function later)
  function openAi() {
    setAiOpen(true); setAiState('thinking')
    setTimeout(() => {
      setAiText(buildAiSummary(sel?.name ?? '', periodLabel, stats, trendPct))
      setAiState('done')
    }, 900)
  }
  useEffect(() => {
    if (!aiOpen) return
    setAiState('thinking')
    const t = setTimeout(() => {
      setAiText(buildAiSummary(sel?.name ?? '', periodLabel, stats, trendPct))
      setAiState('done')
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, period, range])

  if (staff.length === 0) return <EmptyState>Nincs dolgozó</EmptyState>

  const isIn = sel.lastEvent?.type === 'checkin'
  const chart = period === 90 ? weeklyChart(days) : dailyChart(days, period)

  return (
    <>
      {/* ── Header controls ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...S.input, width: 'auto', minWidth: 200 }}>
          {staff.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <Badge color={isIn ? C.green : C.muted}>{isIn ? 'Bent' : 'Kint'}</Badge>
        {sel.department && <span style={{ fontSize: '0.78rem', color: C.muted }}>{sel.department}</span>}
        <div style={{ flex: 1 }} />

        {/* Period segmented control */}
        <div style={{ display: 'flex', gap: 4, background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.md, padding: 4 }}>
          {PERIODS.map(p => (
            <button key={p.days} type="button" onClick={() => setPeriod(p.days)} style={{
              padding: '0.35rem 0.8rem', fontSize: '0.78rem', fontWeight: period === p.days ? 600 : 500,
              background: period === p.days ? tint(C.accent, 12) : 'transparent',
              color: period === p.days ? C.accent : C.muted,
              border: 'none', borderRadius: R.sm, cursor: 'pointer',
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* MI summary trigger */}
        <button type="button" onClick={() => (aiOpen ? setAiOpen(false) : openAi())} title="MI összefoglaló" style={{
          padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 700,
          background: aiOpen ? tint(C.green, 18) : tint(C.green, 10),
          color: C.green, border: `1px solid ${tint(C.green, 30)}`,
          borderRadius: 0, cursor: 'pointer', letterSpacing: '0.02em',
        }}>
          MI
        </button>
      </div>

      {/* ── MI panel ────────────────────────────────────────────────────── */}
      {aiOpen && (
        <div style={{ background: tint(C.accent, 6), border: `1px solid ${tint(C.accent, 22)}`, borderRadius: R.lg, padding: '1rem 1.25rem', marginBottom: '1.25rem', animation: 'fade-up 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.95rem' }}>✨</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.accent }}>MI összefoglaló</span>
              <span style={{ fontSize: '0.72rem', color: C.muted }}>{sel.name} · utolsó {periodLabel}</span>
            </div>
            <button onClick={() => setAiOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.05rem', lineHeight: 1 }}>×</button>
          </div>

          {aiState === 'thinking' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {[92, 78, 60].map((w, i) => (
                <div key={i} style={{ height: 10, width: `${w}%`, background: tint(C.accent, 18), animation: `shimmer 1.2s ease ${i * 0.15}s infinite` }} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.86rem', color: C.text, lineHeight: 1.65, margin: 0 }}>{aiText}</p>
          )}

          <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: '0.7rem' }}>
            Automatikusan generált összefoglaló a rögzített jelenléti adatok alapján.
          </div>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Kpi label="Ledolgozott idő" value={range.loading ? '…' : fmtMins(stats.totalMins)} color={C.green}
             sub={trendPct !== null ? `${trendPct >= 0 ? '▲' : '▼'} ${Math.abs(trendPct)}% az előző időszakhoz képest` : 'nincs korábbi adat'}
             subColor={trendPct === null ? C.muted : trendPct >= 0 ? C.green : C.red} />
        <Kpi label="Munkanapok" value={range.loading ? '…' : stats.workDays} color={C.text} sub={`${periodLabel} alatt`} />
        <Kpi label="Késések" value={range.loading ? '…' : stats.lateDays} color={stats.lateDays > 0 ? CAL.late.bar : C.muted} sub={stats.workDays > 0 ? `${Math.round((stats.lateDays / stats.workDays) * 100)}% a munkanapokból` : '—'} />
        <Kpi label="Átl. érkezés" value={range.loading ? '…' : (stats.avgArrival ?? '—')} color={C.accent} mono sub={`küszöb: ${String(settings.startHour).padStart(2, '0')}:${String(settings.startMinute).padStart(2, '0')}`} />
        <Kpi label="Hiányzás" value={range.loading ? '…' : stats.justified + stats.unjustified} color={stats.unjustified > 0 ? CAL.unjustified.bar : C.muted} sub={`${stats.justified} igazolt · ${stats.unjustified} igazolatlan`} />
      </div>

      {/* ── Chart card ──────────────────────────────────────────────────── */}
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '1rem 0.75rem 0.6rem', marginBottom: '1.25rem' }}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={chart.data} barSize={chart.barSize} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} interval={chart.interval} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="h" width={30} />
            <Tooltip
              contentStyle={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '0.8rem', borderRadius: 0 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
              formatter={(v) => [`${v} óra`, 'Ledolgozott']}
              cursor={{ fill: C.bg2 }}
            />
            <ReferenceLine y={chart.refLine} stroke={C.border} strokeDasharray="4 3" label={{ value: `${chart.refLine}h`, fill: C.muted, fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="hours" radius={0}>
              {chart.data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', paddingTop: '0.35rem', flexWrap: 'wrap' }}>
          {[[C.accent, period === 90 ? '40h+/hét' : '8h+'], [C.green, period === 90 ? 'Normál hét' : '6–8h'], [CAL.late.bar, period === 90 ? 'Kevés' : '<6h'], [C.bg2, 'Nem volt']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 9, height: 9, background: color, border: `1px solid ${C.border}` }} />
              <span style={{ fontSize: '0.65rem', color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily detail (7-day view only) ──────────────────────────────── */}
      {period === 7 && (
        <Table>
          <thead>
            <tr>
              <Th>Nap</Th><Th>Belépés</Th><Th>Kilépés</Th><Th>Ledolgozott</Th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ date, mins, firstIn, lastOut, late, absence }) => {
              const isToday   = date.toDateString() === new Date().toDateString()
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              return (
                <tr key={date.toISOString()} style={{ borderBottom: `1px solid ${C.border}`, opacity: isWeekend && mins === 0 ? 0.45 : 1 }}>
                  <td style={{ ...S.td, fontFamily: MONO, fontSize: '0.82rem' }}>
                    <span style={{ color: C.muted }}>{HU_DAYS[date.getDay()]} </span>
                    <span style={{ color: isToday ? C.accent : C.text }}>{HU_MONTHS[date.getMonth()]} {date.getDate()}.</span>
                    {isToday && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: C.accent, fontWeight: 700 }}>ma</span>}
                    {absence && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: absence === 'unjustified' ? CAL.unjustified.bar : CAL.justified.bar, fontWeight: 700 }}>hiányzás</span>}
                  </td>
                  <td style={{ ...S.td, fontFamily: MONO, color: firstIn ? (late ? CAL.late.bar : C.text) : C.border }}>
                    {firstIn ? fmtClock(firstIn) : '—'}{late && ' ⚠'}
                  </td>
                  <td style={{ ...S.td, fontFamily: MONO, color: lastOut ? C.text : C.border }}>{lastOut ? fmtClock(lastOut) : '—'}</td>
                  <td style={{ ...S.td, fontFamily: MONO, fontWeight: mins > 0 ? 700 : 400, color: mins > 480 ? C.accent : mins > 0 ? C.green : C.border }}>
                    {fmtMins(mins)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}

      <div style={{ height: '2rem' }} />
      <MonthlySummary employees={employees} settings={settings} />
    </>
  )
}

// ── stats helpers ─────────────────────────────────────────────────────────────

function summarize(days) {
  const worked = days.filter(d => d.mins > 0)
  const arrivals = days.filter(d => d.firstIn).map(d => { const t = new Date(d.firstIn); return t.getHours() * 60 + t.getMinutes() })
  const avgMin = arrivals.length ? Math.round(arrivals.reduce((s, m) => s + m, 0) / arrivals.length) : null
  return {
    totalMins: days.reduce((s, d) => s + d.mins, 0),
    workDays: worked.length,
    lateDays: days.filter(d => d.late).length,
    avgArrival: avgMin !== null ? `${String(Math.floor(avgMin / 60)).padStart(2, '0')}:${String(avgMin % 60).padStart(2, '0')}` : null,
    justified: days.filter(d => d.absence && d.absence !== 'unjustified').length,
    unjustified: days.filter(d => d.absence === 'unjustified').length,
  }
}

function dailyChart(days, period) {
  return {
    barSize: period === 7 ? 32 : 12,
    interval: period === 7 ? 0 : 4,
    refLine: 8,
    data: days.map(({ date, mins }) => ({
      name: period === 7 ? HU_DAYS[date.getDay()] : `${date.getMonth() + 1}.${date.getDate()}.`,
      full: `${HU_MONTHS[date.getMonth()]} ${date.getDate()}.`,
      hours: +(mins / 60).toFixed(1),
      color: mins === 0 ? 'var(--surface-2)' : mins >= 480 ? 'var(--accent)' : mins >= 360 ? 'var(--green)' : 'var(--cal-late)',
    })),
  }
}

function weeklyChart(days) {
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return {
    barSize: 20,
    interval: 0,
    refLine: 40,
    data: weeks.map(w => {
      const mins = w.reduce((s, d) => s + d.mins, 0)
      const start = w[0].date
      return {
        name: `${start.getMonth() + 1}.${start.getDate()}.`,
        full: `${HU_MONTHS[start.getMonth()]} ${start.getDate()}. hete`,
        hours: +(mins / 60).toFixed(1),
        color: mins === 0 ? 'var(--surface-2)' : mins >= 2400 ? 'var(--accent)' : mins >= 1500 ? 'var(--green)' : 'var(--cal-late)',
      }
    }),
  }
}

// Placeholder text generator — replace with an LLM Edge Function call later;
// the UI (panel, loading state, regenerate-on-change) is already wired for it.
function buildAiSummary(name, periodLabel, s, trendPct) {
  const parts = []
  const avg = s.workDays > 0 ? Math.round(s.totalMins / s.workDays) : 0
  parts.push(`${name} az elmúlt ${periodLabel} során ${fmtMins(s.totalMins)} munkaidőt teljesített ${s.workDays} munkanapon${avg ? ` (napi átlag ${fmtMins(avg)})` : ''}.`)
  if (s.avgArrival) parts.push(`Átlagos érkezési ideje ${s.avgArrival}${s.lateDays > 0 ? `, ebből ${s.lateDays} alkalommal késett` : ', késés nélkül'}.`)
  if (s.justified + s.unjustified > 0) parts.push(`Az időszakban ${s.justified} igazolt és ${s.unjustified} igazolatlan hiányzása volt.`)
  else parts.push('Hiányzása nem volt az időszakban.')
  if (trendPct !== null && Math.abs(trendPct) >= 3) parts.push(`Az előző azonos hosszúságú időszakhoz képest a ledolgozott idő ${trendPct >= 0 ? 'nőtt' : 'csökkent'} ${Math.abs(trendPct)}%-kal.`)
  const lateRatio = s.workDays > 0 ? s.lateDays / s.workDays : 0
  if (s.unjustified > 0) parts.push('Az igazolatlan hiányzások kiemelt figyelmet igényelnek.')
  else if (lateRatio > 0.3) parts.push('Összességében stabil jelenlét, de a pontosságon érdemes javítani.')
  else if (s.workDays > 0) parts.push('Összességében megbízható, kiegyensúlyozott teljesítmény.')
  return parts.join(' ')
}

function Kpi({ label, value, color, sub, subColor, mono }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '0.85rem 1rem' }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1.3, letterSpacing: '-0.02em', fontFamily: mono ? MONO : 'inherit' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: subColor ?? C.muted, marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  )
}

// ─── Company-wide monthly summary + Excel export ──────────────────────────────

function MonthlySummary({ employees, settings }) {
  const [month,   setMonth]   = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [events,  setEvents]  = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(false)

  const workers = useMemo(() => employees.filter(e => e.role === 'worker'), [employees])

  useEffect(() => {
    setLoading(true)
    const from  = month.toISOString()
    const to    = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString()
    const fromD = month.toISOString().slice(0, 10)
    const toD   = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('events').select('user_id, type, timestamp').gte('timestamp', from).lt('timestamp', to).order('timestamp', { ascending: true }),
      supabase.from('absences').select('user_id, type').gte('date', fromD).lte('date', toD),
    ]).then(([{ data: evts }, { data: abs }]) => {
      setEvents(evts ?? [])
      setAbsences(abs ?? [])
      setLoading(false)
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
    const wAbs        = absences.filter(a => a.user_id === w.id)
    const justified   = wAbs.filter(a => a.type !== 'unjustified').length
    const unjustified = wAbs.filter(a => a.type === 'unjustified').length

    return { name: w.name, department: w.department ?? '', totalMins, workDays, lateDays, justified, unjustified }
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
