// =============================================================================
// Szakdolgozat build: Markdown  ->  .docx (a hivatalos sablon stílusaival)
// =============================================================================
// A sablon (sablon/zavrsni rad_sablon_HU_09_02_2023.docx) SOHA nem módosul.
// A generátor kicsomagolja, kicseréli benne a word/document.xml törzsét, és új
// fájlt ír a out/ mappába. Így a lapméret, margók, élőfej/élőláb, stílusok és
// a számozás definíciói bitre azonosak maradnak a sablonéval.
//
// Mit tart meg a sablonból változatlanul (nyers XML-ként másolva):
//   - címlap, hallgatói nyilatkozat, absztrakt, tartalomjegyzék(mező),
//     jelmagyarázat, köszönetnyilvánítás, "A szakdolgozat témája"
//   - a záró <w:sectPr> (oldalbeállítás) — ennek módosítását a sablon tiltja
//
// Mit generál a Markdownból:
//   - az "1. Bevezető" fejezettől a "Mellékletek" végéig minden
//
// Használat:
//   npm run build     -> out/szakdolgozat.docx
//   npm run words     -> szószám-jelentés (fejezetenként, kvótákkal)
// =============================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const TEMPLATE = path.join(ROOT, 'sablon', 'zavrsni rad_sablon_HU_09_02_2023.docx')
const CONTENT = path.join(HERE, 'content')
const FIGURES = path.join(HERE, 'figures')
const OUT = path.join(HERE, 'out', 'szakdolgozat.docx')

// A sablonban ténylegesen létező stílus-azonosítók (word/styles.xml)
const ST = {
  normal: 'Normal',
  h1: 'Heading1',
  h2: 'Heading2',
  h3: 'Heading3',
  h4: 'Heading4',
  h1nonum: 'Heading1nonumbering',
  list: 'ListParagraph',
  caption: 'Caption',
  bibliography: 'Bibliography',
  figure: 'Normalfigure-table',
  code: 'Normalprogramcode',
  codeFramed: 'Normalprogramcodeframed',
}
const NUM_BULLET = 7    // a sablon pontozott felsorolása
const NUM_ORDERED = 10  // a sablon számozott felsorolása

// A hivatalos terjedelmi előírás: a 2. és 3. fejezet EGYÜTT 7000–10 000 szó.
const QUOTA = { min: 7000, max: 10000, chapters: ['02', '03'] }

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Az útmutató megjegyzések (<!-- ... -->) sem a dokumentumba, sem a
// szószámlálásba nem kerülhetnek bele. Több soron is átnyúlhatnak.
const stripComments = md => md.replace(/<!--[\s\S]*?-->/g, '')

// ── Inline formázás: **félkövér**, *dőlt*, `kód` ──────────────────────────────
function runs(text) {
  const out = []
  // A minta sorrendje számít: a ** előbb, mint a *
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0, m
  const plain = t => { if (t) out.push(`<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`) }
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(`<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(tok.slice(2, -2))}</w:t></w:r>`)
    } else if (tok.startsWith('`')) {
      out.push(`<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr><w:t xml:space="preserve">${esc(tok.slice(1, -1))}</w:t></w:r>`)
    } else {
      out.push(`<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${esc(tok.slice(1, -1))}</w:t></w:r>`)
    }
    last = re.lastIndex
  }
  plain(text.slice(last))
  return out.join('') || '<w:r><w:t/></w:r>'
}

const para = (style, text, extra = '') =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${runs(text)}</w:p>`

const listPara = (text, numId) =>
  para(ST.list, text, `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`)

const pageBreak = () =>
  `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`

// ── Képek ────────────────────────────────────────────────────────────────────
// A kép EMU-ban méretezendő. A szövegtükör szélessége: A4 (11907 twip) mínusz
// bal+jobb margó (1418+851) = 9638 twip = 6.12 M EMU. Ennél szélesebb kép
// arányosan kicsinyítve kerül be.
const MAX_W_EMU = 6120000
let imgSeq = 0
const imageRels = []   // { id, target }

function imageParagraph(file, widthPx, heightPx) {
  const id = `rIdImg${++imgSeq}`
  imageRels.push({ id, target: `media/${file}` })
  let w = widthPx * 9525, h = heightPx * 9525          // px -> EMU (96 DPI)
  if (w > MAX_W_EMU) { h = Math.round(h * (MAX_W_EMU / w)); w = MAX_W_EMU }
  const docPr = imgSeq
  return `<w:p><w:pPr><w:pStyle w:val="${ST.figure}"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPr}" name="Kep${docPr}"/><wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${docPr}" name="Kep${docPr}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

// PNG/JPEG méret kiolvasása fejlécből (külső könyvtár nélkül)
function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {                       // PNG
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {                        // JPEG
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  }
  return { w: 800, h: 600 }   // ismeretlen formátum: ésszerű alapérték
}

// ── Markdown -> Word bekezdések ──────────────────────────────────────────────
// Támogatott jelölések:
//   # ## ### ####    fejezetcímek (számozott Heading1..4)
//   #!               számozatlan Heading1  (pl. "Irodalom")
//   - / *            pontozott felsorolás
//   1.               számozott felsorolás
//   ```              programkód (Normal program code)
//   ![alt](fajl.png) kép + alatta Caption
//   > szöveg         hosszabb idézet (behúzott, kisebb betű)
//   @@BIB            innentől minden sor Bibliography stílusú
//   @@PAGEBREAK      kézi oldaltörés
function mdToXml(md, figureState) {
  // A HTML-megjegyzések (útmutató szövegek) soha nem kerülnek a dokumentumba.
  // Több soron átnyúlhatnak, ezért a feldolgozás ELŐTT távolítjuk el őket.
  const lines = stripComments(md).split(/\r?\n/)
  const out = []
  let i = 0
  let bibMode = false

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (!line) { i++; continue }

    if (line === '@@PAGEBREAK') { out.push(pageBreak()); i++; continue }
    if (line === '@@BIB') { bibMode = true; i++; continue }

    if (bibMode) { out.push(para(ST.bibliography, line)); i++; continue }

    // Programkód
    if (line.startsWith('```')) {
      const framed = line.includes('framed')
      i++
      const code = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++ }
      i++
      const style = framed ? ST.codeFramed : ST.code
      for (const c of code) {
        out.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${esc(c)}</w:t></w:r></w:p>`)
      }
      continue
    }

    // Kép:  ![Képaláírás](fajl.png)
    const img = line.match(/^!\[(.*?)\]\((.+?)\)$/)
    if (img) {
      const [, capText, file] = img
      const abs = path.join(FIGURES, file)
      if (!fs.existsSync(abs)) {
        console.warn(`  ! hiányzó kép: ${file}`)
        i++; continue
      }
      const buf = fs.readFileSync(abs)
      const { w, h } = imageSize(buf)
      figureState.media.push({ file, buf })
      out.push(imageParagraph(file, w, h))
      // A sablon előírása: a képaláírás az ÁBRA ALÁ kerül
      figureState.figNo++
      out.push(para(ST.caption, `${figureState.figNo}. ábra: ${capText}`))
      i++
      continue
    }

    // Táblázat-felirat: a sablon szerint a táblázat FÖLÉ kerül
    const tcap = line.match(/^@@TABLE\s+(.+)$/)
    if (tcap) {
      figureState.tabNo++
      out.push(para(ST.caption, `${figureState.tabNo}. táblázat: ${tcap[1]}`))
      i++
      continue
    }

    // Fejezetcímek
    if (line.startsWith('#! ')) { out.push(para(ST.h1nonum, line.slice(3))); i++; continue }
    if (line.startsWith('#### ')) { out.push(para(ST.h4, line.slice(5))); i++; continue }
    if (line.startsWith('### ')) { out.push(para(ST.h3, line.slice(4))); i++; continue }
    if (line.startsWith('## ')) { out.push(para(ST.h2, line.slice(3))); i++; continue }
    if (line.startsWith('# ')) { out.push(para(ST.h1, line.slice(2))); i++; continue }

    // Idézet
    if (line.startsWith('> ')) {
      out.push(`<w:p><w:pPr><w:pStyle w:val="${ST.normal}"/><w:ind w:left="720"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
        `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(line.slice(2))}</w:t></w:r></w:p>`)
      i++; continue
    }

    // Felsorolások
    if (/^[-*]\s+/.test(line)) { out.push(listPara(line.replace(/^[-*]\s+/, ''), NUM_BULLET)); i++; continue }
    if (/^\d+\.\s+/.test(line)) { out.push(listPara(line.replace(/^\d+\.\s+/, ''), NUM_ORDERED)); i++; continue }

    // Sima bekezdés (a következő üres sorig összevonva)
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#|[-*]\s|\d+\.\s|>|```|!\[|@@)/.test(lines[i].trim())) {
      buf.push(lines[i].trim()); i++
    }
    out.push(para(ST.normal, buf.join(' ')))
  }
  return out.join('')
}

// ── Szószámlálás ─────────────────────────────────────────────────────────────
const countWords = md => stripComments(md)
  .replace(/```[\s\S]*?```/g, ' ')     // kód nem számít bele
  .replace(/^\s*(#|@@|!\[).*$/gm, ' ') // címek, direktívák, képek sem
  .replace(/[*`>_]/g, ' ')
  .split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

// ── Build ────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`HIBA: nem találom a sablont:\n  ${TEMPLATE}`)
    process.exit(1)
  }

  const files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md')).sort()
  if (files.length === 0) {
    console.error(`HIBA: nincs .md fájl a content/ mappában`)
    process.exit(1)
  }

  // Szószám-jelentés
  const stats = files.map(f => ({ file: f, words: countWords(fs.readFileSync(path.join(CONTENT, f), 'utf8')) }))
  const core = stats.filter(s => QUOTA.chapters.some(c => s.file.startsWith(c))).reduce((n, s) => n + s.words, 0)

  console.log('\nSzószám fejezetenként:')
  for (const s of stats) console.log(`  ${s.file.padEnd(34)} ${String(s.words).padStart(6)} szó`)
  const pct = Math.round((core / QUOTA.max) * 100)
  const bar = '█'.repeat(Math.min(30, Math.round(pct / 3.34))).padEnd(30, '·')
  console.log(`\n  2.+3. fejezet (előírás ${QUOTA.min}–${QUOTA.max} szó):`)
  console.log(`  [${bar}] ${core} szó  (${pct}% a felső határhoz képest)`)
  if (core < QUOTA.min) console.log(`  -> még ${QUOTA.min - core} szó kell a minimumhoz`)
  else if (core > QUOTA.max) console.log(`  !! ${core - QUOTA.max} szóval TÚLLÉPTE a felső határt`)
  else console.log(`  -> az előírt tartományban`)

  if (process.argv.includes('--words')) { console.log(); return }

  // Sablon beolvasása
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE))
  const docXml = await zip.file('word/document.xml').async('string')

  // A törzs felosztása: minden a SZÁMOZOTT Heading1 ("Bevezető") előtt marad,
  // onnantól a generált tartalom jön.
  const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length
  const bodyEnd = docXml.lastIndexOf('<w:sectPr')
  const sectPr = docXml.slice(bodyEnd, docXml.lastIndexOf('</w:body>'))
  const body = docXml.slice(bodyStart, bodyEnd)

  const splitAt = body.indexOf('<w:pStyle w:val="Heading1"/>')
  if (splitAt === -1) {
    console.error('HIBA: nem találom a sablonban az első számozott Heading1-et (Bevezető).')
    process.exit(1)
  }
  const paraStart = body.lastIndexOf('<w:p ', splitAt)
  const frontMatter = body.slice(0, paraStart === -1 ? splitAt : paraStart)

  // Tartalom generálása
  const figureState = { figNo: 0, tabNo: 0, media: [] }
  let generated = ''
  for (const f of files) {
    const md = fs.readFileSync(path.join(CONTENT, f), 'utf8')
    // A sablon előírja: minden fejezet új oldalon kezdődik
    if (generated) generated += pageBreak()
    generated += mdToXml(md, figureState)
  }

  const newDoc = docXml.slice(0, bodyStart) + frontMatter + generated + sectPr + '</w:body></w:document>'
  zip.file('word/document.xml', newDoc)

  // Képek beillesztése + kapcsolatok
  if (figureState.media.length) {
    for (const m of figureState.media) zip.file(`word/media/${m.file}`, m.buf)
    const relsPath = 'word/_rels/document.xml.rels'
    let rels = await zip.file(relsPath).async('string')
    const add = imageRels.map(r =>
      `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${r.target}"/>`
    ).join('')
    rels = rels.replace('</Relationships>', add + '</Relationships>')
    zip.file(relsPath, rels)

    // A képformátumok MIME-típusa szerepeljen a [Content_Types].xml-ben
    let ct = await zip.file('[Content_Types].xml').async('string')
    for (const [ext, mime] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg']]) {
      if (figureState.media.some(m => m.file.toLowerCase().endsWith('.' + ext)) && !ct.includes(`Extension="${ext}"`)) {
        ct = ct.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`)
      }
    }
    zip.file('[Content_Types].xml', ct)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))

  console.log(`\nKész: ${path.relative(ROOT, OUT)}`)
  console.log(`  ${figureState.figNo} ábra, ${figureState.tabNo} táblázat-felirat, ${figureState.media.length} beágyazott kép`)
  console.log('  A sablon érintetlen maradt.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
