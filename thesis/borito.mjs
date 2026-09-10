// =============================================================================
// Borítólap: sablon -> out/borito.docx + out/borito.pdf
// =============================================================================
// A bekötéshez külön fedlap készül, saját sablonból:
//   sablon/zavrsni_rad_korice_HU_09_02_2023.docx
//
// A fedlap NEM azonos a dolgozat belső címlapjával: csak a MAGYAR cím szerepel
// rajta (a szerb és az angol nem), és nincs rajta se absztrakt, se nyilatkozat.
// Az adatok viszont ugyanabból a meta.mjs-ből jönnek, mint a címlapé — így a
// kettő nem térhet el egymástól.
//
// A sablon maga SOHA nem módosul: kicsomagoljuk, a word/document.xml-t
// kicseréljük, és új fájlt írunk az out/ mappába.
//
// Használat:  node borito.mjs
// =============================================================================
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { META } from './meta.mjs'
import { paragraphs, paraText, setParaText } from './docx.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const TEMPLATE = path.join(ROOT, 'sablon', 'zavrsni_rad_korice_HU_09_02_2023.docx')
const OUT_DOCX = path.join(HERE, 'out', 'borito.docx')
const OUT_PDF = path.join(HERE, 'out', 'borito.pdf')
const PY = path.join(HERE, 'tools', 'frissit.py')

// A helyőrzők a szövegük ELEJÉRŐL ismerhetők fel, nem bekezdés-sorszámról: ha
// a sablon egyszer módosul, a generátor hangosan jelzi, mit nem talált,
// ahelyett hogy némán üres borítót adna.
const MEZOK = [
  ['cím (Magyar', META.titleHu],
  ['vezeték és UTÓnév', META.student],
  ['dr. vezeték és UTÓnév', META.mentor],
  ['leckekönyv SZÁMa', META.indexNo],
  ['Szabadka, 20xx', `${META.place}, ${META.year}`],
]

// A "dr. vezeték és UTÓnév" a "vezeték és UTÓnév"-vel is kezdődhetne, ha a
// keresés bárhol illeszkedne — ezért a hosszabb, pontosabb helyőrző megy
// előre, és minden bekezdés csak egyszer cserélhető.
function tolt(xml) {
  const hianyzik = []
  const kesz = new Set()
  const sorrend = [...MEZOK].sort((a, b) => b[0].length - a[0].length)

  for (const [elotag, ertek] of sorrend) {
    let megvan = false
    for (const q of paragraphs(xml)) {
      if (q.empty || kesz.has(q.start)) continue
      const src = xml.slice(q.start, q.end)
      if (!paraText(src).trim().startsWith(elotag)) continue
      xml = xml.slice(0, q.start) + setParaText(src, ertek) + xml.slice(q.end)
      kesz.add(q.start)
      megvan = true
      break
    }
    if (!megvan) hianyzik.push(elotag)
  }
  return { xml, hianyzik }
}

const run = (cmd, args) => new Promise(resolve => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { err += d })
  p.on('close', code => resolve({ code, out, err }))
  p.on('error', e => resolve({ code: -1, out, err: String(e) }))
})

const JELOLTEK = [
  'C:/Program Files/LibreOffice/program',
  'C:/Program Files (x86)/LibreOffice/program',
  '/usr/lib/libreoffice/program',
  '/Applications/LibreOffice.app/Contents/MacOS',
]

function keresLibreOffice() {
  for (const dir of JELOLTEK) {
    for (const exe of ['soffice.exe', 'soffice']) {
      const soffice = path.join(dir, exe)
      if (!fs.existsSync(soffice)) continue
      for (const py of ['python.exe', 'python3', 'python']) {
        const python = path.join(dir, py)
        if (fs.existsSync(python)) return { soffice, python }
      }
      return { soffice, python: null }
    }
  }
  return null
}

// A PDF-et ugyanaz a LibreOffice-script készíti, amelyik a dolgozatét. Az a
// script docx-et is ír, ezért kap egy eldobható célfájlt: a borító .docx-e a
// SABLONBÓL készült, érintetlen Word-formázású változat marad, nem a
// LibreOffice újramentése.
async function pdf() {
  const lo = keresLibreOffice()
  if (!lo?.python) {
    console.log('\n  ! nem találom a LibreOffice-t (vagy a python.exe-t mellette),')
    console.log('    ezért PDF nem készült. A .docx-et Wordből is lehet PDF-be menteni.')
    return false
  }
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'borito-lo-'))
  const eldobhato = path.join(profil, 'nem-kell.docx')
  const port = 2402 + (process.pid % 400)
  const r = await run(lo.python, [PY, lo.soffice, profil, OUT_DOCX, OUT_PDF, eldobhato, String(port)])

  try {
    fs.rmSync(profil, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
  } catch { /* a LibreOffice még fogja; a temp mappában marad */ }

  const zarolt = r.out.split('\n').filter(l => l.startsWith('FAIL') && l.includes('.pdf'))
  if (zarolt.length) {
    console.error('\nHIBA: a borito.pdf nem írható felül — szinte biztosan nyitva van')
    console.error('      egy PDF-olvasóban. Zárd be, és futtasd újra.')
    return false
  }
  if (r.code !== 0 || !fs.existsSync(OUT_PDF)) {
    console.error('\nHIBA a PDF-készítés közben:')
    console.error((r.err || r.out || '(nincs kimenet)').trim())
    return false
  }
  return true
}

async function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`HIBA: nem találom a borítólap sablonját:\n  ${TEMPLATE}`)
    process.exit(1)
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE))
  const eredeti = await zip.file('word/document.xml').async('string')
  const { xml, hianyzik } = tolt(eredeti)

  if (hianyzik.length) {
    console.error('\nHIBA: a sablonban nem találom ezeket a helyőrzőket:')
    for (const h of hianyzik) console.error(`      "${h}"`)
    console.error('\n  A borítólap kitöltetlenül maradna, ezért nem készült el.')
    process.exit(1)
  }

  zip.file('word/document.xml', xml)
  fs.mkdirSync(path.dirname(OUT_DOCX), { recursive: true })
  fs.writeFileSync(OUT_DOCX, await zip.generateAsync({
    type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 },
  }))

  console.log('\nBorítólap:')
  for (const [elotag, ertek] of MEZOK) {
    console.log(`  ${(elotag + ' ').padEnd(24, '·')} ${ertek}`)
  }

  const vanPdf = await pdf()
  console.log()
  for (const f of vanPdf ? [OUT_DOCX, OUT_PDF] : [OUT_DOCX]) {
    console.log(`  ${path.relative(HERE, f).padEnd(20)} ${Math.round(fs.statSync(f).size / 1024)} kB`)
  }
  console.log('\n  A sablon érintetlen maradt.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
