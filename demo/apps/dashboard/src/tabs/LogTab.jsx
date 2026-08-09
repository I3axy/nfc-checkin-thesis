import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { C, S, tint } from '../lib/theme'
import { fmtClock } from '../lib/utils'
import { Table, Th, TableEmpty, Modal , Chip, FilterGroup } from '../components/ui'
import { toast } from '../components/toast'

const PAGE_SIZES = [20, 50, 100, 0]           // 0 = mind
const MONO = "'JetBrains Mono', monospace"

// Accent-insensitive compare so "Kovacs" finds "Kovács"
// (NFD splits "á" into "a" + combining accent; the range strips the accents)
const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const ymd  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }

export function LogTab({ events, employees = [], onSaved }) {
  const [from, setFrom]           = useState(() => daysAgo(29))
  const [to, setTo]               = useState(() => ymd(new Date()))
  const [search, setSearch]       = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [shifts, setShifts]       = useState([])          // [] = mind
  const [sortDir, setSortDir]     = useState('desc')
  const [pageSize, setPageSize]   = useState(50)
  const [page, setPage]           = useState(1)
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState(null)
  const [photoView, setPhotoView] = useState(null)
  const blurTimer = useRef(null)

  // Shift/department options come from the data — never hardcoded, so renaming
  // "A műszak" to "Délelőtti" in the profiles is all that's needed.
  const shiftOptions = useMemo(
    () => [...new Set(employees.map(e => e.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu')),
    [employees]
  )

  const profileMap = useMemo(
    () => Object.fromEntries(employees.map(p => [p.id, p])),
    [employees]
  )

  // The log loads its own slice for the chosen range — the dashboard only keeps
  // the most recent events in memory, which wouldn't cover older ranges.
  // `events` is a dependency so a realtime check-in refreshes the list too.
  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase.from('events')
      .select('id, user_id, type, timestamp, is_manual, note, photo_url')
      .gte('timestamp', new Date(`${from}T00:00:00`).toISOString())
      .lte('timestamp', new Date(`${to}T23:59:59.999`).toISOString())
      .order('timestamp', { ascending: false })
      .limit(5000)
      .then(({ data }) => { if (alive) { setRows(data ?? []); setLoading(false) } })
    return () => { alive = false }
  }, [from, to, events])

  const enriched = useMemo(() => rows.map(e => ({
    ...e,
    name: profileMap[e.user_id]?.name ?? 'Ismeretlen',
    department: profileMap[e.user_id]?.department ?? null,
  })), [rows, profileMap])

  const filtered = useMemo(() => {
    const q = norm(search.trim())
    return enriched
      .filter(e => shifts.length === 0 || shifts.includes(e.department))
      .filter(e => !q || norm(e.name).includes(q))
      .sort((a, b) => sortDir === 'desc'
        ? new Date(b.timestamp) - new Date(a.timestamp)
        : new Date(a.timestamp) - new Date(b.timestamp))
  }, [enriched, shifts, search, sortDir])

  // Reset to the first page whenever the result set changes underneath
  useEffect(() => { setPage(1) }, [search, shifts, from, to, pageSize, sortDir])

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const visible    = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Predictive search: names matching what's typed, that actually occur in range
  const suggestions = useMemo(() => {
    const q = norm(search.trim())
    if (!q) return []
    const inRange = new Set(enriched.map(e => e.name))
    return [...inRange].filter(n => norm(n).includes(q) && norm(n) !== q).sort((a, b) => a.localeCompare(b, 'hu')).slice(0, 6)
  }, [search, enriched])

  function toggleShift(s) {
    setShifts(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function deleteEvent(id) {
    setDeleting(id)
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) toast('A törlés nem sikerült', 'error')
    else { toast('Esemény törölve'); setRows(prev => prev.filter(e => e.id !== id)) }
    onSaved(); setDeleting(null)
  }

  const exportRows = () => [
    ['Név', 'Műszak', 'Típus', 'Időpont', 'Kézi', 'Megjegyzés'],
    ...filtered.map(e => [e.name, e.department ?? '', e.type === 'checkin' ? 'Belépés' : 'Kilépés', new Date(e.timestamp).toLocaleString('hu'), e.is_manual ? 'Igen' : '', e.note ?? '']),
  ]

  function exportCSV() {
    const csv = exportRows().map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })),
      download: `naplo-${from}_${to}.csv`,
    })
    a.click()
  }

  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet(exportRows())
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 28 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Napló')
    XLSX.writeFile(wb, `naplo-${from}_${to}.xlsx`)
  }

  return (
    <>
      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '0.9rem 1rem', marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Predictive name search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <FilterLabel>Keresés névre</FilterLabel>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSuggestOpen(true) }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => { blurTimer.current = setTimeout(() => setSuggestOpen(false), 120) }}
              placeholder="pl. Kovács"
              style={{ ...S.input, width: '100%' }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSuggestOpen(false) }}
                style={{ position: 'absolute', right: 6, bottom: 7, background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1 }}>×</button>
            )}
            {suggestOpen && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: C.bg1, border: `1px solid ${C.border}`, boxShadow: C.shadow, maxHeight: 220, overflowY: 'auto' }}>
                {suggestions.map(n => (
                  <button
                    key={n}
                    type="button"
                    // onMouseDown fires before the input's blur closes the list
                    onMouseDown={() => { clearTimeout(blurTimer.current); setSearch(n); setSuggestOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.7rem', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: C.text, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <div>
            <FilterLabel>Időszak</FilterLabel>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ ...S.input, width: 'auto' }} />
              <span style={{ color: C.muted, fontSize: '0.8rem' }}>–</span>
              <input type="date" value={to} min={from} max={ymd(new Date())} onChange={e => setTo(e.target.value)} style={{ ...S.input, width: 'auto' }} />
            </div>
          </div>

          {/* Quick ranges */}
          <div>
            <FilterLabel>Gyorsválasztás</FilterLabel>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {[['Ma', 0], ['7 nap', 6], ['30 nap', 29], ['90 nap', 89]].map(([label, d]) => (
                <Chip key={label}
                  active={from === daysAgo(d) && to === ymd(new Date())}
                  onClick={() => { setFrom(daysAgo(d)); setTo(ymd(new Date())) }}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Shift chips — options are derived from the profiles' department field */}
        {shiftOptions.length > 0 && (
          <div style={{ paddingTop: '0.75rem', borderTop: `1px solid ${C.border}` }}>
            <FilterGroup label="Műszak">
              <Chip active={shifts.length === 0} onClick={() => setShifts([])}>Mind</Chip>
              {shiftOptions.map(s => (
                <Chip key={s} active={shifts.includes(s)} onClick={() => toggleShift(s)}>{s}</Chip>
              ))}
            </FilterGroup>
          </div>
        )}
      </div>

      {/* ── Result bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: C.muted }}>
          {loading ? 'Betöltés…' : <><strong style={{ color: C.text }}>{filtered.length}</strong> esemény</>}
          {!loading && filtered.length !== enriched.length && <span style={{ color: C.muted }}> ({enriched.length} közül szűrve)</span>}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: C.muted }}>Sorok:</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {PAGE_SIZES.map(n => (
            <Chip key={n} active={pageSize === n} onClick={() => setPageSize(n)}>
              {n === 0 ? 'Mind' : n}
            </Chip>
          ))}
        </div>
        <button onClick={exportCSV} style={S.btnSecondary}>↓ CSV</button>
        <button onClick={exportExcel} style={S.btnSecondary}>↓ Excel</button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <Table className="table-compact">
        <thead>
          <tr>
            <Th>Dolgozó</Th>
            <Th className="col-secondary">Műszak</Th>
            <Th>Típus</Th>
            <Th sortable active dir={sortDir} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>Időpont</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? <TableEmpty colSpan={5}>Betöltés…</TableEmpty>
            : visible.length === 0
              ? <TableEmpty colSpan={5}>Nincs a szűrésnek megfelelő esemény</TableEmpty>
              : visible.map(e => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600, color: C.text }}>{e.name}</span>
                    {e.is_manual && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: C.accent, border: `1px solid ${tint(C.accent, 28)}`, padding: '0 0.3rem' }}>kézi</span>}
                    {e.note && <div style={{ fontSize: '0.72rem', color: C.muted }}>{e.note}</div>}
                  </td>
                  <td className="col-secondary" style={{ ...S.td, fontSize: '0.78rem', color: C.muted }}>{e.department ?? '—'}</td>
                  <td style={S.td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: tint(e.type === 'checkin' ? C.green : C.red, 15), color: e.type === 'checkin' ? C.green : C.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                        {e.type === 'checkin' ? '↑' : '↓'}
                      </span>
                      <span className="not-phone" style={{ fontSize: '0.78rem', fontWeight: 600, color: e.type === 'checkin' ? C.green : C.red }}>
                        {e.type === 'checkin' ? 'Belépés' : 'Kilépés'}
                      </span>
                    </span>
                    {e.photo_url && (
                      <button onClick={() => setPhotoView(e)} title="Fénykép megtekintése" style={{ ...S.btnIcon, marginLeft: '0.5rem', padding: '0.1rem 0.4rem' }}>📷</button>
                    )}
                  </td>
                  {/* Az óra és a dátum egymás alatt: így az oszlop nem
                      szélesíti ki a táblázatot vízszintes görgetésig. */}
                  <td style={{ ...S.td, fontFamily: MONO, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    <div style={{ color: C.text }}>{fmtClock(e.timestamp)}</div>
                    <div style={{ color: C.muted, fontSize: '0.7rem' }}>
                      {new Date(e.timestamp).toLocaleDateString('hu', { year: '2-digit', month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    {e.is_manual && (
                      <button onClick={() => deleteEvent(e.id)} disabled={deleting === e.id} style={{ ...S.btnIcon, color: C.red, borderColor: tint(C.red, 30) }}>
                        {deleting === e.id ? '…' : '✕'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
          }
        </tbody>
      </Table>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pageSize !== 0 && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.85rem' }}>
          <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} style={{ ...S.btnIcon, opacity: safePage === 1 ? 0.4 : 1 }}>«</button>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ ...S.btnIcon, opacity: safePage === 1 ? 0.4 : 1 }}>‹</button>
          <span style={{ fontSize: '0.8rem', color: C.muted, minWidth: 110, textAlign: 'center' }}>
            <strong style={{ color: C.text }}>{safePage}</strong> / {totalPages} oldal
          </span>
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ ...S.btnIcon, opacity: safePage === totalPages ? 0.4 : 1 }}>›</button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} style={{ ...S.btnIcon, opacity: safePage === totalPages ? 0.4 : 1 }}>»</button>
        </div>
      )}

      {photoView && <PhotoLightbox event={photoView} onClose={() => setPhotoView(null)} />}
    </>
  )
}

function FilterLabel({ children, inline }) {
  return (
    <div style={{ fontSize: '0.66rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: inline ? 0 : '0.3rem', marginRight: inline ? '0.3rem' : 0 }}>
      {children}
    </div>
  )
}

function PhotoLightbox({ event, onClose }) {
  const [url, setUrl]     = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.storage.from('checkin-photos').createSignedUrl(event.photo_url, 60)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setUrl(data.signedUrl)
      })
  }, [event.photo_url])

  return (
    <Modal title={`Fénykép — ${event.name}`} onClose={onClose}>
      {error && <div style={S.errorBox}>{error}</div>}
      {!error && !url && <div style={{ color: C.muted, fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Betöltés…</div>}
      {url && <img src={url} alt="Check-in fénykép" style={{ width: '100%', display: 'block' }} />}
    </Modal>
  )
}
