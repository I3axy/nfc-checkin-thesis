import { S, Empty } from './ui'
import { rangeLabel, dayLabel, fmtTime, ABSENCE_LABELS } from '../lib/format'

// Harang ikon vonalrajzként. Nem hangulatjel: az emoji betűtípusonként más
// alakot vesz fel, és a színét sem lehet a felülethez igazítani.
function BellIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export function NotificationBell({ unread, onOpen }) {
  return (
    <button
      onClick={onOpen}
      aria-label={unread > 0 ? `Értesítések — ${unread} új` : 'Értesítések'}
      style={{
        position: 'relative', background: 'transparent',
        border: '1px solid var(--border)',
        padding: '0.55rem', cursor: 'pointer', borderRadius: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 44, minHeight: 44, flexShrink: 0,
      }}
    >
      <BellIcon color="var(--muted)" />
      {/* Jelölés, nem animáció: az olvasatlanság ÁLLAPOT, ami akkor is fennáll,
          ha az értesítés egy hete keletkezett. A szám nélküli pötty kevesebbet
          mondana — így az is látszik, hány döntés vár elolvasásra. */}
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          minWidth: 18, height: 18, padding: '0 4px',
          background: 'var(--red)', color: '#fff',
          fontSize: '0.65rem', fontWeight: 700, lineHeight: '18px',
          textAlign: 'center', boxSizing: 'border-box',
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

// Teljes képernyős nézet. Telefonon egy lenyíló doboz szűk lenne az
// indoklásoknak, és a görgetése is ütközne a mögötte lévő tartalommal.
export function NotificationsScreen({ notifications, onBack }) {
  return (
    <div style={S.page}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.75rem 1rem', display: 'flex', alignItems: 'center',
        gap: '0.75rem', flexShrink: 0,
      }}>
        {/* Ugyanaz a jel, mint a vezetői felület menüjének becsukásánál */}
        <button onClick={onBack} aria-label="Vissza" style={{
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--muted)', fontSize: '1rem', fontFamily: 'inherit',
          cursor: 'pointer', borderRadius: 0,
          minWidth: 44, minHeight: 44, flexShrink: 0,
        }}>
          «
        </button>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>Értesítések</div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {notifications.length === 0
          ? <Empty>Még nincs értesítésed.</Empty>
          : notifications.map(n => <NotificationRow key={n.id} n={n} />)
        }
      </main>
    </div>
  )
}

function NotificationRow({ n }) {
  const approved = n.type === 'absence_approved'
  const d = n.data ?? {}
  const created = new Date(n.created_at)
  const unread = !n.read_at

  return (
    <div style={{
      padding: '0.9rem 1rem', borderBottom: '1px solid var(--border)',
      // Az olvasatlan sor kiemelése az egyetlen különbség — a régi értesítés
      // ugyanúgy olvasható marad.
      background: unread ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'transparent',
      borderLeft: `3px solid ${unread ? 'var(--accent)' : 'transparent'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: approved ? 'var(--green)' : 'var(--red)' }}>
          {approved ? 'Kérelem jóváhagyva' : 'Kérelem elutasítva'}
        </span>
        <span style={{ ...S.mono, fontSize: '0.7rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {dayLabel(created)} {fmtTime(created)}
        </span>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.35rem' }}>
        {d.date_from ? rangeLabel(d.date_from, d.date_to ?? d.date_from) : '—'}
        <span style={{ color: 'var(--muted)' }}>
          {' · '}{ABSENCE_LABELS[d.absence_type] ?? d.absence_type ?? 'hiányzás'}
          {d.days ? ` · ${d.days} nap` : ''}
        </span>
      </div>

      {/* Elutasításnál az indoklás a lényeg — enélkül a döntés érthetetlen */}
      {!approved && d.decision_note && (
        <div style={{
          marginTop: '0.6rem', padding: '0.55rem 0.65rem', fontSize: '0.8rem',
          color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)',
          lineHeight: 1.5,
        }}>
          Indoklás: {d.decision_note}
        </div>
      )}
    </div>
  )
}
