import { useState, useMemo } from 'react'
import { C, S } from '../lib/theme'
import { fmtMins, fmtClock, isWorkerLate } from '../lib/utils'
import { Table, TableEmpty, SectionLabel, Badge } from '../components/ui'
import { EditModal } from '../components/EditModal'

export function StatusTab({ employees, onSaved, settings }) {
  const [editing, setEditing] = useState(null)
  const [deptFilter, setDeptFilter] = useState('all')

  const departments = useMemo(() => ['all', ...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])
  const filtered = deptFilter === 'all' ? employees : employees.filter(e => e.department === deptFilter)
  const inside  = filtered.filter(e => e.lastEvent?.type === 'checkin')
  const outside = filtered.filter(e => e.lastEvent?.type !== 'checkin')

  if (employees.length === 0) return (
    <div style={{ color: C.muted, padding: '3rem', textAlign: 'center', fontSize: '0.9rem', border: `1px solid ${C.border}` }}>
      Nincs dolgozó regisztrálva
    </div>
  )

  return (
    <>
      {departments.length > 2 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', border: `1px solid ${deptFilter === d ? C.accent : C.border}`, background: deptFilter === d ? C.bg2 : 'transparent', color: deptFilter === d ? C.accent : C.muted, cursor: 'pointer' }}>
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

      {editing && <EditModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved() }} />}
    </>
  )
}

function EmpRow({ emp, onEdit, settings }) {
  const isIn   = emp.lastEvent?.type === 'checkin'
  const isLate = emp.firstInToday ? isWorkerLate(emp.firstInToday, settings) : false

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ ...S.td, width: 10, paddingRight: 0 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isIn ? C.green : C.border }} />
      </td>
      <td style={{ ...S.td, fontWeight: 700, color: C.text }}>
        {emp.name}
        {isLate && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: '#e8a838', border: '1px solid #e8a83840', padding: '0.1rem 0.35rem', fontWeight: 700 }}>Késő</span>}
      </td>
      <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>{emp.department ?? '—'}</td>
      <td style={S.td}>
        {emp.lastEvent
          ? <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(emp.lastEvent.timestamp)}</Badge>
          : <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
        }
      </td>
      <td style={{ ...S.td, color: C.muted, fontSize: '0.78rem' }}>
        {emp.todayMinutes > 0 ? fmtMins(emp.todayMinutes) : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button onClick={onEdit} style={S.btnIcon}>✎</button>
      </td>
    </tr>
  )
}
