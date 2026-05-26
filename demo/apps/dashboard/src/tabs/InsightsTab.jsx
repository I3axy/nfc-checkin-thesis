import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { C, S, CAL } from '../lib/theme'
import { calcDayMinutes, fmtMins, fmtClock, HU_DAYS, HU_MONTHS } from '../lib/utils'
import { Table, Th, SectionLabel, Badge, EmptyState } from '../components/ui'

export function InsightsTab({ employees, events }) {
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
                <Cell key={i} fill={mins === 0 ? C.bg2 : mins >= 480 ? C.accent : mins >= 360 ? C.green : CAL.late.border} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', paddingTop: '0.25rem' }}>
          {[[C.green, '6–8h'], [C.accent, '8h+'], [CAL.late.border, '<6h'], [C.bg2, 'Nem volt']].map(([color, label]) => (
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
    </>
  )
}
