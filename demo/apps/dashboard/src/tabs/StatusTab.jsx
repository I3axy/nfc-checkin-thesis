import { useState, useMemo } from 'react'
import { C, S, CAL, tint } from '../lib/theme'
import { fmtMins, fmtClock, isWorkerLate, isToday, fmtDayLabel } from '../lib/utils'
import { Table, TableEmpty, SectionLabel, Badge, EmptyState } from '../components/ui'
import { EditModal } from '../components/EditModal'

// Az automatikus kiléptetés ezzel a megjegyzéssel jön létre (auto_checkout_due).
// Jelöljük, mert a vezetőnek látnia kell, hogy nem valódi kártyaérintés volt.
const isAutoCheckout = ev => ev?.type === 'checkout' && ev?.note === 'Automatikus kiléptetés'

function AutoTag() {
  return (
    <span style={{ fontSize: '0.6rem', color: C.muted, border: `1px solid ${C.border}`, padding: '0.1rem 0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
      auto
    </span>
  )
}

export function StatusTab({ employees, onSaved, settings }) {
  const [editing, setEditing] = useState(null)
  const [deptFilter, setDeptFilter] = useState('all')

  const departments = useMemo(() => ['all', ...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees])
  const filtered = deptFilter === 'all' ? employees : employees.filter(e => e.department === deptFilter)
  const staff   = filtered.filter(e => e.role !== 'guest')
  const guests  = employees.filter(e => e.role === 'guest')
  const inside  = staff.filter(e => e.lastEvent?.type === 'checkin')
  const outside = staff.filter(e => e.lastEvent?.type !== 'checkin')

  if (employees.length === 0) return <EmptyState>Nincs dolgozó regisztrálva</EmptyState>

  return (
    <>
      {departments.length > 2 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{
              padding: '0.28rem 0.85rem', fontSize: '0.75rem', fontWeight: deptFilter === d ? 600 : 500,
              border: `1px solid ${deptFilter === d ? tint(C.accent, 40) : C.border}`,
              background: deptFilter === d ? tint(C.accent, 12) : 'transparent',
              color: deptFilter === d ? C.accent : C.muted,
              cursor: 'pointer', borderRadius: 0,
            }}>
              {d === 'all' ? 'Mind' : d}
            </button>
          ))}
        </div>
      )}

      <SectionLabel color={C.green}>Bent — {inside.length}</SectionLabel>
      <Table className="table-compact">
        <tbody>
          {inside.length === 0
            ? <TableEmpty>Senki nincs bent</TableEmpty>
            : inside.map(emp => <EmpRow key={emp.id} emp={emp} onEdit={() => setEditing(emp)} settings={settings} />)
          }
        </tbody>
      </Table>

      <div style={{ height: '1.25rem' }} />

      <SectionLabel color={C.muted}>Kint — {outside.length}</SectionLabel>
      <Table className="table-compact">
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
          <Table className="table-compact">
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
      <td className="col-secondary" style={{ ...S.td, width: 42 }}>
        <Avatar name={guest.name} color={isIn ? C.green : C.muted} />
      </td>
      <td style={{ ...S.td }}>
        <span style={{ fontWeight: 600, color: C.text }}>{guest.name}</span>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', color: C.accent, border: `1px solid ${tint(C.accent, 28)}`, padding: '0.1rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, borderRadius: 0 }}>Vendég</span>
      </td>
      <td style={S.td}>
        {guest.lastEvent
          ? <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(guest.lastEvent.timestamp)}</Badge>
          : <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
        }
      </td>
      <td className="col-secondary" style={{ ...S.td, fontSize: '0.78rem' }}>
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

  // A lap a MAI állapotot mutatja. Egy korábbi napról származó esemény óráját
  // dátum nélkül kiírni félrevezető volt ("Kint 02:00" úgy festett, mintha ma
  // történt volna), ezért a nem mai eseményeknél a nap is megjelenik.
  const evToday = isToday(emp.lastEvent?.timestamp)
  // Nyitva maradt korábbi nap: a rendszer szerint bent van, de a belépés nem
  // ma történt — vagy elmaradt a kiléptetés, vagy az automatikus zárás nem futott.
  const staleIn = isIn && !evToday

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td className="col-secondary" style={{ ...S.td, width: 42 }}>
        <Avatar name={emp.name} color={isIn ? C.green : C.muted} />
      </td>
      <td style={{ ...S.td }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: C.text }}>{emp.name}</span>
          {isLate && <span style={{ fontSize: '0.62rem', color: CAL.late.bar, border: `1px solid ${tint(CAL.late.bar, 30)}`, padding: '0.1rem 0.4rem', fontWeight: 700, borderRadius: 0 }}>Késő</span>}
          {staleIn && <span style={{ fontSize: '0.62rem', color: CAL.late.bar, border: `1px solid ${tint(CAL.late.bar, 30)}`, padding: '0.1rem 0.4rem', fontWeight: 700, borderRadius: 0 }}>Nyitva maradt</span>}
        </div>
        {emp.department && <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '0.1rem' }}>{emp.department}</div>}
      </td>
      <td style={S.td}>
        {!emp.lastEvent
          ? <span style={{ color: C.muted, fontSize: '0.78rem' }}>Még nem volt</span>
          : evToday
            ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Badge color={isIn ? C.green : C.red}>{isIn ? '↑ Bent' : '↓ Kint'} {fmtClock(emp.lastEvent.timestamp)}</Badge>
                {isAutoCheckout(emp.lastEvent) && <AutoTag />}
              </div>
            // Nem mai esemény: ma nem járt bent, csak az utolsó ismert állapot látszik.
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ color: C.muted, fontSize: '0.78rem' }}>Ma nem volt bent</span>
                <span style={{ fontSize: '0.68rem', color: C.muted, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace" }}>
                  utoljára {fmtDayLabel(emp.lastEvent.timestamp)} {fmtClock(emp.lastEvent.timestamp)} · {isIn ? 'bent' : 'kint'}
                  {isAutoCheckout(emp.lastEvent) && ' (auto)'}
                </span>
              </div>
        }
      </td>
      <td className="col-secondary" style={{ ...S.td, fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace" }}>
        {emp.todayMinutes > 0 ? <span style={{ color: C.text }}>{fmtMins(emp.todayMinutes)}</span> : <span style={{ color: C.muted }}>—</span>}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button onClick={onEdit} style={S.btnIcon}>✎</button>
      </td>
    </tr>
  )
}
