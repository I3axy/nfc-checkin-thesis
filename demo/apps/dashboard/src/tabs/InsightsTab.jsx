import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { C, S, CAL } from '../lib/theme'
import { calcDayMinutes, isWorkerLate, fmtMins, fmtClock, HU_DAYS, HU_MONTHS } from '../lib/utils'
import { Table, Th, TableEmpty, SectionLabel, Badge, EmptyState } from '../components/ui'

export function InsightsTab({ employees, events, settings }) {
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => { if (employees.length > 0 && !selectedId) setSelectedId(employees[0].id) }, [employees, selectedId])

  if (employees.length === 0) return <EmptyState>Nincs dolgozó</EmptyState>

  const sel = employees.find(e => e.id === selectedId) ?? employees[0]
  const isIn = sel.lastEvent?.type === 'checkin'
  const workerEvents = events.filter(e => e.user_id === sel.id)

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const dateStr = d.toDateString()
    const dayEvts = workerEvents.filter(e => new Date(e.timestamp).toDateString() === dateStr)
    const firstIn = dayEvts.find(e => e.type === 'checkin')?.timestamp ?? null
    const lastOut = [...dayEvts].reverse().find(e => e.type === 'checkout')?.timestamp ?? null
    const mins = calcDayMinutes(dayEvts)
    return { date: d, mins, firstIn, lastOut }
  })

  const weekTotal = last7.reduce((s, d) => s + d.mins, 0)
  const workDays  = last7.filter(d => d.mins > 0).length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.78rem', color: C.muted, whiteSpace: 'nowrap' }}>Dolgozó:</span>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...S.input, width: 'auto', minWidth: 200 }}>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <Badge color={isIn ? C.green : C.muted}>{isIn ? 'Bent' : 'Kint'}</Badge>
        {sel.department && <span style={{ fontSize: '0.78rem', color: C.muted }}>{sel.department}</span>}
      </div>

      <SectionLabel color={C.accent}>Mai adatok</SectionLabel>
      <Table>
        <tbody>
          {[
            ['Első belépés',    sel.firstInToday ? fmtClock(sel.firstInToday) : '—', C.text],
            ['Utolsó kilépés',  sel.lastOutToday ? fmtClock(sel.lastOutToday) : '—', C.text],
            ['Ledolgozott idő', fmtMins(sel.todayMinutes),                            C.green],
            ['Munkamenetek',    String(sel.todayCheckins ?? 0),                       C.text],
          ].map(([label, value, color], i, arr) => (
            <tr key={label} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <td style={{ ...S.td, color: C.muted, width: '55%' }}>{label}</td>
              <td style={{ ...S.td, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div style={{ height: '1.5rem' }} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
        <SectionLabel color={C.accent}>Utolsó 7 nap</SectionLabel>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>összesen: <strong style={{ color: C.text }}>{fmtMins(weekTotal)}</strong> — {workDays} munkanap</span>
      </div>

      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '1rem 0.5rem 0.5rem', marginBottom: '1rem' }}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={last7.map(({ date, mins }) => ({ name: HU_DAYS[date.getDay()], hours: parseFloat((mins / 60).toFixed(1)), full: `${HU_MONTHS[date.getMonth()]} ${date.getDate()}.` }))}
            barSize={32} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit="h" width={28} />
            <Tooltip
              contentStyle={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '0.8rem', borderRadius: 0 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
              formatter={(v) => [`${v} óra`, 'Ledolgozott']}
              cursor={{ fill: C.bg2 }}
            />
            <ReferenceLine y={8} stroke={C.border} strokeDasharray="4 3" label={{ value: '8h', fill: C.muted, fontSize: 10, position: 'insideTopRight' }} />
            <Bar dataKey="hours" radius={0}>
              {last7.map(({ mins }, i) => (
                <Cell key={i} fill={mins === 0 ? C.bg2 : mins >= 480 ? C.accent : mins >= 360 ? C.green : CAL.late.bar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', paddingTop: '0.25rem' }}>
          {[[C.green, '6–8h'], [C.accent, '8h+'], [CAL.late.bar, '<6h'], [C.bg2, 'Nem volt']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 10, height: 10, background: color, border: `1px solid ${C.border}` }} />
              <span style={{ fontSize: '0.65rem', color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <Table>
        <thead>
          <tr style={{ background: C.bg2 }}>
            <Th>Nap</Th><Th>Belépés</Th><Th>Kilépés</Th><Th>Ledolgozott</Th>
          </tr>
        </thead>
        <tbody>
          {last7.map(({ date, mins, firstIn, lastOut }) => {
            const isToday   = date.toDateString() === new Date().toDateString()
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <tr key={date.toISOString()} style={{ borderBottom: `1px solid ${C.border}`, opacity: isWeekend ? 0.45 : 1 }}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                  <span style={{ color: C.muted }}>{HU_DAYS[date.getDay()]} </span>
                  <span style={{ color: isToday ? C.accent : C.text }}>{HU_MONTHS[date.getMonth()]} {date.getDate()}.</span>
                  {isToday && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: C.accent }}>ma</span>}
                </td>
                <td style={{ ...S.td, fontFamily: 'monospace', color: firstIn ? C.text : C.border }}>{firstIn ? fmtClock(firstIn) : '—'}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', color: lastOut ? C.text : C.border }}>{lastOut ? fmtClock(lastOut) : '—'}</td>
                <td style={{ ...S.td, fontWeight: mins > 0 ? 700 : 400, color: mins > 480 ? C.accent : mins > 0 ? C.green : C.border }}>
                  {fmtMins(mins)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>

      <div style={{ height: '2rem' }} />
      <MonthlySummary employees={employees} settings={settings} />
    </>
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
    const monthLabel = month.toLocaleDateString('hu', { year: 'numeric', month: 'long' })
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
          <tr style={{ background: C.bg2 }}>
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
                  <td style={{ ...S.td, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{fmtMins(r.totalMins)}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{r.workDays}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: r.lateDays > 0 ? CAL.late.bar : C.muted }}>{r.lateDays}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: r.justified > 0 ? CAL.justified.bar : C.muted }}>{r.justified}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: r.unjustified > 0 ? CAL.unjustified.bar : C.muted }}>{r.unjustified}</td>
                </tr>
              ))
          }
        </tbody>
      </Table>
    </div>
  )
}
