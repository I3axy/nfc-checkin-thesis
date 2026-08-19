// =============================================================================
// Tartalomjegyzék-frissítés és PDF-export
// =============================================================================
// A build.mjs a tartalomjegyzék-mezőt szándékosan üresen, „elavult” jelöléssel
// hagyja: az oldalszámok a tördeléstől függenek, amit csak egy szövegszerkesztő
// tud kiszámolni. Ez a script elvégzi ezt a lépést a telepített LibreOffice
// segítségével, és két új fájlt készít az out/ mappába:
//
//   szakdolgozat-kesz.docx   — frissített tartalomjegyzékkel
//   szakdolgozat.pdf         — ugyanaz PDF-ben
//
// A build kimenete (szakdolgozat.docx) NEM módosul. Ez tudatos: azt a fájlt a
// sablonból, érintetlen Word-formázással állítjuk elő, a -kesz.docx viszont
// már a LibreOffice újramentése, amely a formázást apróságokban átírhatja.
// Így megmarad a választás, hogy melyik változat kerüljön leadásra.
//
// Használat:  node frissit.mjs
// =============================================================================

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(HERE, 'out', 'szakdolgozat.docx')
const PDF = path.join(HERE, 'out', 'szakdolgozat.pdf')
const DOCX = path.join(HERE, 'out', 'szakdolgozat-kesz.docx')
const SCRIPT = path.join(HERE, 'tools', 'frissit.py')

// A LibreOffice szokásos telepítési helyei Windowson és Linuxon/macOS-en.
const CANDIDATES = [
  'C:/Program Files/LibreOffice/program',
  'C:/Program Files (x86)/LibreOffice/program',
  '/usr/lib/libreoffice/program',
  '/Applications/LibreOffice.app/Contents/MacOS',
]

function findLibreOffice() {
  for (const dir of CANDIDATES) {
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

const run = (cmd, args) => new Promise(resolve => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { err += d })
  p.on('close', code => resolve({ code, out, err }))
  p.on('error', e => resolve({ code: -1, out, err: String(e) }))
})

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`HIBA: nincs meg a forrás: ${path.relative(HERE, SRC)}\n` +
                  `      Előbb futtasd: node build.mjs`)
    process.exit(1)
  }

  const lo = findLibreOffice()
  if (!lo) {
    console.error('HIBA: nem találom a LibreOffice-t.\n' +
      '      A tartalomjegyzéket ilyenkor kézzel kell frissíteni:\n' +
      '      Word: Ctrl+A, majd F9 — LibreOffice: jobb gomb a jegyzéken →\n' +
      '      Tárgymutató frissítése.')
    process.exit(1)
  }
  if (!lo.python) {
    console.error(`HIBA: a LibreOffice mellett nincs python.exe:\n  ${lo.soffice}`)
    process.exit(1)
  }

  // Külön, eldobható profil: így akkor is lefut, ha a LibreOffice épp nyitva
  // van, és a felhasználó beállításaihoz nem nyúlunk hozzá.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'thesis-lo-'))
  const port = 2002 + (process.pid % 400)

  console.log('\nTartalomjegyzék frissítése LibreOffice-szal…')
  const r = await run(lo.python, [SCRIPT, lo.soffice, profile, SRC, PDF, DOCX, String(port)])

  // A háttérben futó LibreOffice a leállítás után még pár pillanatig fogja a
  // profilt, ezért a takarítás újrapróbálkozik — és ha így sem sikerül, csak
  // figyelmeztet: az ideiglenes mappa a rendszer temp könyvtárában marad.
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
  } catch {
    console.warn(`  (az ideiglenes profil nem törölhető: ${profile})`)
  }

  if (r.code !== 0 || !r.out.includes('OK')) {
    console.error('HIBA a frissítés közben:')
    console.error((r.err || r.out || '(nincs kimenet)').trim())
    process.exit(1)
  }

  for (const f of [DOCX, PDF]) {
    const kb = Math.round(fs.statSync(f).size / 1024)
    console.log(`  ${path.relative(HERE, f).padEnd(28)} ${kb} kB`)
  }
  console.log('\n  A build kimenete (out/szakdolgozat.docx) változatlan maradt.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
