import { useState, useMemo } from 'react'
import { C, S, CAL, R, tint } from '../lib/theme'
import { fmtMins, fmtClock, isWorkerLate } from '../lib/utils'
import { Table, TableEmpty, SectionLabel, Badge, EmptyState } from '../components/ui'
import { EditModal } from '../components/EditModal'

export function StatusTab({ employees, onSaved, settings }) {
  const [editing, setEditing] = useState(null)
  const [deptFilter, setDeptFilter] = useState('all')

  const departments = useMemo(() => ['all', ...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])
  const filtered = deptFilter === 'all' ? employees : employees.filter(e => e.department === deptFilter)
  const staff   = filtered.filter(e => e.role !== 'guest')
  const guests  = employees.filter(e => e.role === 'guest')
  const inside  = staff.filter(e => e.lastEvent?.type === 'checkin')
  const outside = staff.filter(e => e.lastEvent?.type !== 'checkin')
  const lateToday = staff.filter(e => e.firstInToday && isWorkerLate(e.firstInToday, settings))

  if (employees.length === 0) return <EmptyState>Nincs dolgozó regisztrálva</EmptyState>

  return (
    <>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Kpi label="Bent" value={inside.length} color={C.green} sub={`${staff.length} dolgozóból`} />
        <Kpi label="Kint" value={outside.length} color={C.muted} sub="jelenleg nincs bent" />
        <Kpi label="Késők ma" value={lateToday.length} color={lateToday.length > 0 ? CAL.late.bar : C.muted} sub={`küszöb: ${String(settings.startHour).padStart(2, '0')}:${String(settings.startMinute).padStart(2, '0')} + ${settings.lateThresholdMinutes}p`} />
        {guests.length > 0 && <Kpi label="Vendégek" value={guests.length} color={C.accent} sub="aktív vendégprofil" />}
      </div>

      {departments.length > 2 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{
              padding: '0.28rem 0.85rem', fontSize: '0.75rem', fontWeight: deptFilter === d ? 600 : 500,
              border: `1px solid ${deptFilter === d ? tint(C.accent, 40) : C.border}`,
              background: deptFilter === d ? tint(C.accent, 12) : 'transparent',
              color: deptFilter === d ? C.accent : C.muted,
              cursor: 'pointer', borderRadius: 999,
            }}>
              {d === 'all' ? 'Mind' : d}
            </button>
          ))}
        </div>
      )}

      <SectionLabel color={C.green}>Bent — {inside.length}</SectionLabel>
      <Table>
        <tbody>
          {inside.length === 0
            ? <TableEmpty>Senki nincs bent</TableEmpty>
            : inside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} settings={settings} />)
          }
        </tbody>
      </Table>

      <div style={{ height: '1.25rem' }} />

      <SectionLabel color={C.muted}>Kint — {outside.length}</SectionLabel>
      <Table>
        <tbody>
          {outside.length === 0
            ? <TableEmpty>Mindenki bent van</TableEmpty>
            : outside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} settings={settings} />)
          }
        </tbody>
      </Table>

      {guests.length > 0 && (
        <>
          <div style={{ height: '1.25rem' }} />
          <SectionLabel color={C.accent}>Vendégek — {guests.length}</SectionLabel>
          <Table>
            <tbody>
              {guests.map(g => <GuestRow key={g.id} guest={g} onEdit={() => setEditing(g)} />)}
            </tbody>
          </Table>
        </>
      )}

      {editing && <EditModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved() }} />}
    </>
  )
}

function Kpi({ label, value, color, sub }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '0.85rem 1rem' }}>
      <div style={{ fontSize: '0.66rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1.25, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  )
}

function Avatar({ name, color }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('')
  return (
    <span style={{ width: 30, height: 30, borderRadius: '50%', background: tint(color, 15), color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </span>
  )
}

function GuestRow({ guest, onEdit }) {
  const isIn    = guest.lastEvent?.type === 'checkin'
  const exp     = guest.guest_expires_at ? new Date(guest.guest_expires_at) : null
  const expired = exp && exp < new Date()
  const expLabel = exp ? exp.toLocaleString('hu', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}`, opacity: expired ? 0.55 : 1 }}>
      <td style={{ ...S.td, width: 42 }}>
        <Avatar name={guest.name} color={isIn ? C.green : C.muted} />
      </td>
      <td style={{ ...S.td }}>
        <span style={{ fontWeight: 600, color: C.text }}>{guest.name}</span>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', color: C.accent, border: `1px solid ${tint(C.accent, 28)}`, padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, borderRadius: 999 }}>Vendég</span>
      </td>
      <td style={S.td}>
        {guest.lastEvent
          ? <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(guest.lastEvent.timestamp)}</Badge>
          : <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
        }
      </td>
      <td style={{ ...S.td, fontSize: '0.78rem' }}>
        {expired
          ? <span style={{ color: CAL.unjustified.bar, fontWeight: 700 }}>⏰ Lejárt · {expLabel}</span>
          : <span style={{ color: C.muted }}>Lejár: <span style={{ color: C.text }}>{expLabel}</span></span>
        }
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button onClick={onEdit} style={S.btnIcon}>✎</button>
      </td>
    </tr>
  )
}

function EmpRow({ emp, onEdit, settings }) {
  const isIn   = emp.lastEvent?.type === 'checkin'
  const isLate = emp.firstInToday ? isWorkerLate(emp.firstInToday, settings) : false

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ ...S.td, width: 42 }}>
        <Avatar name={emp.name} color={isIn ? C.green : C.muted} />
      </td>
      <td style={{ ...S.td }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: C.text }}>{emp.name}</span>
          {isLate && <span style={{ fontSize: '0.62rem', color: CAL.late.bar, border: `1px solid ${tint(CAL.late.bar, 30)}`, padding: '0.1rem 0.4rem', fontWeight: 700, borderRadius: 999 }}>Késő</span>}
        </div>
        {emp.department && <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '0.1rem' }}>{emp.department}</div>}
      </td>
      <td style={S.td}>
        {emp.lastEvent
          ? <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(emp.lastEvent.timestamp)}</Badge>
          : <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
        }
      </td>
      <td style={{ ...S.td, fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace" }}>
        {emp.todayMinutes > 0 ? <span style={{ color: C.text }}>{fmtMins(emp.todayMinutes)}</span> : <span style={{ color: C.muted }}>—</span>}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button onClick={onEdit} style={S.btnIcon}>✎</button>
      </td>
    </tr>
  )
}
