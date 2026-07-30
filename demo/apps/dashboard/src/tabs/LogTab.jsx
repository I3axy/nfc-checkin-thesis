import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { C, S, tint } from '../lib/theme'
import { fmtClock } from '../lib/utils'
import { Table, Th, TableEmpty, Badge, Modal } from '../components/ui'
import { toast } from '../components/toast'

export function LogTab({ events, onSaved }) {
  const [nameFilter, setNameFilter] = useState('all')
  const [sortDir, setSortDir]       = useState('desc')
  const [deleting, setDeleting]     = useState(null)
  const [photoView, setPhotoView]   = useState(null)

  const names  = ['all', ...Array.from(new Set(events.map(e => e.name))).sort()]
  const sorted = [...events]
    .filter(e => nameFilter === 'all' || e.name === nameFilter)
    .sort((a, b) => sortDir === 'desc' ? new Date(b.timestamp) - new Date(a.timestamp) : new Date(a.timestamp) - new Date(b.timestamp))

  async function deleteEvent(id) {
    setDeleting(id)
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) toast('A törlés nem sikerült', 'error')
    else toast('Esemény törölve')
    onSaved(); setDeleting(null)
  }

  function exportCSV() {
    const rows = [['Név', 'Típus', 'Időpont', 'Kézi', 'Megjegyzés'], ...sorted.map(e => [e.name, e.type === 'checkin' ? 'Belépés' : 'Kilépés', new Date(e.timestamp).toLocaleString(), e.is_manual ? 'Igen' : '', e.note ?? ''])]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })), download: `checkin-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }

  function exportExcel() {
    const rows = [['Név', 'Típus', 'Időpont', 'Kézi', 'Megjegyzés'], ...sorted.map(e => [e.name, e.type === 'checkin' ? 'Belépés' : 'Kilépés', new Date(e.timestamp).toLocaleString(), e.is_manual ? 'Igen' : '', e.note ?? ''])]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Napló')
    XLSX.writeFile(wb, `checkin-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nameFilter} onChange={e => setNameFilter(e.target.value)} style={{ ...S.input, width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
          {names.map(n => <option key={n} value={n}>{n === 'all' ? 'Mind' : n}</option>)}
        </select>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>{sorted.length} esemény</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} style={S.btnSecondary}>↓ CSV</button>
        <button onClick={exportExcel} style={S.btnSecondary}>↓ Excel</button>
      </div>
      <Table>
        <thead>
          <tr style={{ background: C.bg2 }}>
            <Th>Dolgozó</Th>
            <Th>Típus</Th>
            <Th sortable onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>Időpont {sortDir === 'desc' ? '↓' : '↑'}</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(e => (
            <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={S.td}>
                <span style={{ fontWeight: 600, color: C.text }}>{e.name}</span>
                {e.is_manual && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: C.accent, border: `1px solid ${tint(C.accent, 28)}`, padding: '0 0.3rem' }}>kézi</span>}
                {e.note && <div style={{ fontSize: '0.72rem', color: C.muted }}>{e.note}</div>}
              </td>
              <td style={S.td}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: tint(e.type === 'checkin' ? C.green : C.red, 15), color: e.type === 'checkin' ? C.green : C.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>
                    {e.type === 'checkin' ? '↑' : '↓'}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: e.type === 'checkin' ? C.green : C.red }}>
                    {e.type === 'checkin' ? 'Belépés' : 'Kilépés'}
                  </span>
                </span>
                {e.photo_url && (
                  <button onClick={() => setPhotoView(e)} title="Fénykép megtekintése" style={{ ...S.btnIcon, marginLeft: '0.5rem', padding: '0.1rem 0.4rem' }}>📷</button>
                )}
              </td>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                <span style={{ color: C.text }}>{fmtClock(e.timestamp)}</span>
                <span style={{ color: C.muted, marginLeft: '0.5rem', fontSize: '0.72rem' }}>{new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                {e.is_manual && (
                  <button onClick={() => deleteEvent(e.id)} disabled={deleting === e.id} style={{ ...S.btnIcon, color: C.red, borderColor: tint(C.red, 30) }}>
                    {deleting === e.id ? '…' : '✕'}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && <TableEmpty colSpan={4}>Nincs esemény</TableEmpty>}
        </tbody>
      </Table>

      {photoView && <PhotoLightbox event={photoView} onClose={() => setPhotoView(null)} />}
    </>
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
