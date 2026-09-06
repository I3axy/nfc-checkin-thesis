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
import { META } from './meta.mjs'

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

// A fejezetek új oldalon kezdődnek. Ezt NEM külön, oldaltörést tartalmazó
// bekezdéssel érjük el, hanem a fejezet első bekezdésének tulajdonságával.
// A különálló törésbekezdés ugyanis maga is elfoglal egy sort: ha az előző
// oldal éppen betelt, a bekezdés átcsúszik a következő lapra, a benne lévő
// törés pedig onnan dob még egyet — így üres lap keletkezik a fejezet elé.
// A pageBreakBefore ezzel szemben a bekezdés helyzetét írja elő, nem told
// előre semmit.
function startOnNewPage(xml) {
  // A pPr elemeinek sorrendje kötött: a pageBreakBefore a pStyle és az
  // esetleges keepNext UTÁN következik.
  const m = xml.match(/^<w:p(?=[ >])[^>]*><w:pPr>(?:<w:pStyle w:val="[^"]*"\/>)?(?:<w:keepNext\/>)?/)
  if (!m) return pageBreak() + xml            // nem bekezdéssel kezdődik
  return xml.slice(0, m[0].length) + '<w:pageBreakBefore/>' + xml.slice(m[0].length)
}

// ── Táblázat ─────────────────────────────────────────────────────────────────
// Markdown csőtáblázatból ( | a | b | ) OOXML táblázat. A cellák a sablon
// "Normal figure-table" stílusát kapják, a felirat a @@TABLE direktívával
// külön, a táblázat FÖLÉ kerül — így írja elő a sablon.
const TEXT_WIDTH_TWIP = 9638   // A4 szélesség mínusz a sablon bal+jobb margója

function tableXml(rows) {
  const cols = Math.max(...rows.map(r => r.length))
  const w = Math.floor(TEXT_WIDTH_TWIP / cols)
  // A sablon 3.1.4. pontjának példatáblázata szerint: 0,5 pt (sz=8) fekete
  // szegély, a fejlécsor pedig BFBFBF világosszürke kitöltést kap. A sablon
  // ezt nem táblázatstílussal, hanem közvetlen formázással oldja meg, ezért
  // itt is így készül — a kész dolgozat táblázatai így a sablon példájával
  // azonos megjelenésűek.
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(s => `<w:${s} w:val="single" w:sz="8" w:space="0" w:color="000000"/>`).join('')
  const HEAD_SHD = '<w:shd w:val="clear" w:color="auto" w:fill="BFBFBF"/>'

  // A `keep` a sor bekezdéseit a következőhöz köti. Ha az utolsó sor
  // kivételével minden sor ilyen, a táblázat egyben marad: nem szakad ketté
  // két lap között. Az utolsó sor szándékosan marad kötés nélkül — enélkül a
  // táblázat a rá következő szövegtörzset is magával rántaná.
  const cell = (text, head, keep) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? HEAD_SHD : ''}</w:tcPr>` +
    `<w:p><w:pPr><w:pStyle w:val="${ST.figure}"/>${keep ? '<w:keepNext/>' : ''}<w:jc w:val="left"/></w:pPr>` +
    (head
      ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
      : runs(text)) +
    `</w:p></w:tc>`

  // A fejlécsor oldaltöréskor megismétlődik (tblHeader) — ha a táblázat olyan
  // hosszú, hogy egy lapra semmiképp nem fér ki, enélkül olvashatatlanná
  // válna a folytatás. A sorok belül sem törnek meg (cantSplit).
  const row = (cs, head, keep) =>
    `<w:tr><w:trPr><w:cantSplit/>${head ? '<w:tblHeader/>' : ''}</w:trPr>` +
    Array.from({ length: cols }, (_, k) => cell(cs[k] ?? '', head, keep)).join('') +
    `</w:tr>`

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${`<w:gridCol w:w="${w}"/>`.repeat(cols)}</w:tblGrid>` +
    row(rows[0], true, rows.length > 1) +
    rows.slice(1).map((r, n) => row(r, false, n < rows.length - 2)).join('') +
    // Két egymást követő táblázatot a Word összevonna, ezért zárásként üres
    // bekezdés kerül utána.
    `</w:tbl><w:p/>`
}

// ── Képek ────────────────────────────────────────────────────────────────────
// A kép EMU-ban méretezendő. A szövegtükör szélessége: A4 (11907 twip) mínusz
// bal+jobb margó (1418+851) = 9638 twip = 6.12 M EMU. Ennél szélesebb kép
// arányosan kicsinyítve kerül be.
const MAX_W_EMU = 6120000
// A szövegtükör MAGASSÁGA: A4 (16838 twip) mínusz felső+alsó margó (2×1418)
// = 14002 twip = 24,7 cm. Ennél magasabb kép nem fér ki, a szövegszerkesztő
// pedig ilyenkor átlöki a következő oldalra, és ott is túllógna. A korlátot
// ezért 18 cm-ben húzzuk meg, hogy a képaláírásnak és néhány sor szövegnek is
// maradjon hely.
const MAX_H_EMU = 6480000                              // 18 cm
// Az ÁLLÓ tájolású képek — a telefonos képernyőképek — a szövegtükör
// szélességére igazítva 18 cm magasak lennének, tehát egy teljes oldalt
// elfoglalnának úgy, hogy a tartalmuk közben elfér a lap felén is. Rájuk
// ezért feleakkora korlát vonatkozik, így az ábra a hozzá tartozó szöveggel
// együtt marad olvasható egy oldalon.
const MAX_H_PORTRAIT_EMU = 3240000                     // 9 cm
let imgSeq = 0
const imageRels = []   // { id, target }
const imageSizes = []  // { file, cm } — a build jelentéséhez

function imageParagraph(file, widthPx, heightPx, scale = 1) {
  const id = `rIdImg${++imgSeq}`
  imageRels.push({ id, target: `media/${file}` })
  let w = widthPx * 9525, h = heightPx * 9525          // px -> EMU (96 DPI)
  const maxH = heightPx > widthPx ? MAX_H_PORTRAIT_EMU : MAX_H_EMU
  if (w > MAX_W_EMU) { h = Math.round(h * (MAX_W_EMU / w)); w = MAX_W_EMU }
  if (h > maxH) { w = Math.round(w * (maxH / h)); h = maxH }
  const capped = h === maxH
  // A kézzel megadott arány a korlátozás UTÁN érvényesül, tehát a megadott
  // százalék mindig a lapra illesztett mérethez képest értendő.
  if (scale !== 1) { w = Math.round(w * scale); h = Math.round(h * scale) }
  imageSizes.push({ file, w: w / 360000, h: h / 360000, capped, scale })
  const docPr = imgSeq
  // A keepNext tartja egy oldalon a képet a saját feliratával; enélkül a
  // szövegszerkesztő a lap alján elválasztaná őket egymástól.
  return `<w:p><w:pPr><w:pStyle w:val="${ST.figure}"/><w:keepNext/></w:pPr><w:r><w:drawing>` +
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
//   ![alt](fajl.png) kép + alatta Caption; a {90%} utótag kisebbre veszi
//   > szöveg         hosszabb idézet (behúzott, kisebb betű)
//   @@BIB            innentől minden sor Bibliography stílusú
//   @@PAGEBREAK      kézi oldaltörés
function mdToXml(md, figureState) {
  // A HTML-megjegyzések (útmutató szövegek) soha nem kerülnek a dokumentumba.
  // Több soron átnyúlhatnak, ezért a feldolgozás ELŐTT távolítjuk el őket.
  const lines = stripComments(md).split(/\r?\n/)
  const out = []
  const breakAt = []      // hányadik bekezdés kezdődjön új oldalon (@@PAGEBREAK)
  let i = 0
  let bibMode = false

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (!line) { i++; continue }

    // A törés nem külön bekezdésként kerül be, hanem a UTÁNA következő
    // bekezdés tulajdonságaként — az indoklás a startOnNewPage-nél olvasható.
    if (line === '@@PAGEBREAK') { breakAt.push(out.length); i++; continue }
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
      // A kódrészlet sorai összetartoznak: a lap alján nem szakadhatnak ketté.
      // Az utolsó sor kötés nélkül marad, különben a rá következő szövegtörzset
      // is magával vinné a következő oldalra.
      code.forEach((c, n) => {
        const keep = n < code.length - 1 ? '<w:keepNext/>' : ''
        out.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/>${keep}</w:pPr><w:r><w:t xml:space="preserve">${esc(c)}</w:t></w:r></w:p>`)
      })
      continue
    }

    // Kép:  ![Képaláírás](fajl.png)  vagy  ![Képaláírás](fajl.png){90%}
    const img = line.match(/^!\[(.*?)\]\((.+?)\)(?:\{(\d+)%\})?$/)
    if (img) {
      const [, capText, file, pct] = img
      const scale = pct ? Number(pct) / 100 : 1
      const abs = path.join(FIGURES, file)
      // A hiányzó képet NEM hagyjuk ki: a sorszáma megmarad, a helyére látható
      // helyőrző kerül. Kihagyás esetén ugyanis minden későbbi ábra sorszáma
      // eggyel csúszna, a szövegbeli hivatkozások pedig rossz ábrára mutatnának.
      if (!fs.existsSync(abs)) {
        figureState.missing.push(file)
        figureState.figNo++
        out.push(para(ST.figure, `[ide kerül a képernyőkép: ${file}]`))
        out.push(para(ST.caption, `${figureState.figNo}. ábra: ${capText}`))
        i++; continue
      }
      const buf = fs.readFileSync(abs)
      const { w, h } = imageSize(buf)
      figureState.media.push({ file, buf })
      out.push(imageParagraph(file, w, h, scale))
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
      // A felirat a táblázat FÖLÉ kerül, ezért kötést kap: nem maradhat egy
      // előző lap alján a hozzá tartozó táblázat nélkül.
      out.push(para(ST.caption, `${figureState.tabNo}. táblázat: ${tcap[1]}`, '<w:keepNext/>'))
      i++
      continue
    }

    // Táblázat: | a | b |  — a második sor az elválasztó (|---|---|)
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const rows = [cells(line)]
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++ }
      out.push(tableXml(rows))
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
  // A kért töréseket a helyükön álló bekezdésre alkalmazzuk. A fájl végén álló
  // @@PAGEBREAK mögött nincs ilyen bekezdés, ott marad a különálló törés.
  for (const k of breakAt) {
    if (k < out.length) out[k] = startOnNewPage(out[k])
    else out.push(pageBreak())
  }
  return out.join('')
}

// ── Szószámlálás ─────────────────────────────────────────────────────────────
// Két mérőszám készül. A szigorúbb csak a folyó szöveget számolja; a Word
// beépített számlálója ezzel szemben a fejezetcímeket, a feliratokat és a
// táblázatok tartalmát is beleveszi. A kettő különbsége néhány száz szó, ami a
// felső határ közelében már eldöntheti, belefér-e a dolgozat — ezért mindkettő
// megjelenik.
const tokens = s => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length

const countWords = md => tokens(stripComments(md)
  .replace(/```[\s\S]*?```/g, ' ')     // kód nem számít bele
  .replace(/^\s*(#|@@|!\[).*$/gm, ' ') // címek, direktívák, képek sem
  .replace(/[*`>_]/g, ' '))

// Ahogy a Word számolja: a címek és a feliratok is szövegnek minősülnek.
const countWordsWord = md => tokens(stripComments(md)
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^\s*!\[.*$/gm, ' ')        // a kép maga nem szöveg
  .replace(/^\s*@@(BIB|PAGEBREAK)\s*$/gm, ' ')
  .replace(/^\s*@@TABLE\s+/gm, ' ')    // a felirat szövege viszont igen
  .replace(/^#+\s+/gm, ' ')
  .replace(/[*`>_|]/g, ' '))

// ── A sablon előlapjainak kitöltése ──────────────────────────────────────────
// A címlap, az absztrakt, a jelmagyarázat és a témaleírás helyőrző szöveggel
// érkezik a sablonból ("cím (MagyarUL)", "leckekönyv SZÁMa" és társai). Ezeket
// a build a meta.mjs tartalmára cseréli.
//
// A csere a helyőrző SZÖVEGÉRE illeszt, nem bekezdés-sorszámra: ha a sablon
// egyszer módosul, a build hangosan jelzi, mit nem talált, ahelyett hogy némán
// üresen hagyná a címlapot.
//
// Miért nem elég egy egyszerű szövegcsere? A Word a szerkesztési előzmény
// miatt a helyőrzőt több <w:r> futamra tördeli ("vezeték és " + "UTÓ" +
// "név"), sőt a cím még kitöltendő mezőt (FILLIN) is tartalmaz. Ezért a
// bekezdés összes futama lecserélődik egyetlen újra, a bekezdés
// tulajdonságainak (<w:pPr>, azaz a stílus) megtartásával.

const paraText = p => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('')

// A bekezdések határai. A <w:pPr> nem illeszkedik, mert utána nem szóköz
// vagy '>' áll. Az önzáró (üres) bekezdést külön jelöljük — abban nincs mit
// cserélni.
function paragraphs(xml) {
  const out = []
  const re = /<w:p(?=[ >])[^>]*>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    if (m[0].endsWith('/>')) {
      out.push({ start: m.index, end: m.index + m[0].length, empty: true })
      continue
    }
    const end = xml.indexOf('</w:p>', re.lastIndex)
    if (end === -1) continue
    out.push({ start: m.index, end: end + '</w:p>'.length, empty: false })
    re.lastIndex = end + '</w:p>'.length
  }
  return out
}

function setParaText(p, text) {
  const open = p.match(/^<w:p[^>]*>/)[0]
  const pPr = (p.match(/^<w:p[^>]*>(<w:pPr>[\s\S]*?<\/w:pPr>)/) ?? ['', ''])[1]
  // A sablon futamai szerb nyelvre vannak jelölve; magyar szövegnél ez téves
  // helyesírás-ellenőrzést eredményezne.
  const run = text === ''
    ? ''
    : `<w:r><w:rPr><w:lang w:val="hu-HU"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
  return open + pPr + run + '</w:p>'
}

// Az első olyan bekezdés cseréje, amelynek szövege a megadott előtaggal
// kezdődik. A null érték a bekezdés eltávolítását jelenti. Tömb esetén a
// helyőrző helyére annyi felsoroláspont kerül, ahány elem van — a sablon
// pontozott listájával, ugyanazzal, amelyet a fejezetek felsorolásai is
// használnak.
function replaceParaStartingWith(xml, prefix, value) {
  for (const q of paragraphs(xml)) {
    if (q.empty) continue
    const src = xml.slice(q.start, q.end)
    if (!paraText(src).trim().startsWith(prefix)) continue
    const next =
      value === null ? '' :
      Array.isArray(value) ? value.map(t => listPara(t, NUM_BULLET)).join('') :
      setParaText(src, value)
    return { xml: xml.slice(0, q.start) + next + xml.slice(q.end), found: true }
  }
  return { xml, found: false }
}

// A jelmagyarázat táblázata három példasorral érkezik. A sablon fejlécsora
// megmarad, a példasorok helyére annyi sor kerül, ahány rövidítés van — az
// első példasor szolgál mintaként, így a cellák formázása változatlan.
function fillLegendTable(xml, entries) {
  const at = xml.indexOf('Jel/Rövidítés')
  if (at === -1) return { xml, found: false }
  const start = xml.lastIndexOf('<w:tbl>', at)
  const end = xml.indexOf('</w:tbl>', at) + '</w:tbl>'.length
  if (start === -1 || end <= start) return { xml, found: false }

  const parts = xml.slice(start, end).split(/(?=<w:tr[ >])/)
  if (parts.length < 3) return { xml, found: false }
  const [grid, header, firstRow] = parts
  const sample = firstRow.slice(0, firstRow.indexOf('</w:tr>') + '</w:tr>'.length)

  const rows = entries.map(([abbr, desc]) => {
    // A mintasorban cellánként egy bekezdés áll: az első a rövidítés, a
    // második az értelmezés.
    const cells = [abbr, desc]
    let n = 0, out = '', last = 0
    for (const q of paragraphs(sample)) {
      if (q.empty || n >= cells.length) continue
      out += sample.slice(last, q.start) + setParaText(sample.slice(q.start, q.end), cells[n++])
      last = q.end
    }
    return out + sample.slice(last)
  }).join('')

  return { xml: xml.slice(0, start) + grid + header + rows + '</w:tbl>' + xml.slice(end), found: true }
}

function fillFrontMatter(xml) {
  const missing = []
  const put = (prefix, value) => {
    const r = replaceParaStartingWith(xml, prefix, value)
    xml = r.xml
    if (!r.found) missing.push(prefix)
  }

  put('cím (Magyar', META.titleHu)
  put('cím (szerb', META.titleSr)
  put('cím (angol', META.titleEn)
  put('vezeték és UTÓnév', META.student)
  put('dr. vezeték és UTÓnév', META.mentor)
  put('leckekönyv SZÁMa', META.indexNo)
  put('Szabadka, 20xx', `${META.place}, ${META.year}`)
  put('Szabadkán, kelt', META.dateLine)

  put('Az absztrakt a szakdolgozat', META.abstract)
  put('Kulcsszavak:', `Kulcsszavak: ${META.keywords.join(', ')}`)

  const legend = fillLegendTable(xml, META.legend)
  xml = legend.xml
  if (!legend.found) missing.push('jelmagyarázat táblázata')
  // A táblázat alatti kitöltési útmutató a kész dolgozatban nem maradhat.
  put('Ebben a részben fel kell sorolni', null)

  put('Ez a fejezet személyes megjegyzéseket', META.thanks)
  put('A szakdolgozatnak ezen részét a mentor', META.topic)

  return { xml, missing }
}

// ── Tartalomjegyzék ──────────────────────────────────────────────────────────
// A sablon tartalomjegyzéke Word-mező, amelynek EREDMÉNYE is el van tárolva a
// fájlban — méghozzá a sablon példafejezeteivel és azok oldalszámaival. Ezt az
// eredményt a szövegszerkesztő csak külön kérésre számolja újra, ezért a kész
// dolgozatban is a sablon tartalomjegyzéke látszana.
//
// Az oldalszámokat itt kiszámolni nem lehet: azok a tördeléstől függenek,
// amit csak a szövegszerkesztő ismer. Amit tehetünk: a hamis eredményt
// töröljük (rossz adat semmiképp ne maradjon a dokumentumban), a mezőt pedig
// „elavult”-ra jelöljük, hogy megnyitáskor újraszámolásra kerüljön.
function resetToc(doc) {
  const marks = []
  const re = /<w:fldChar\b[^>]*w:fldCharType="(begin|separate|end)"[^>]*>/g
  for (let m; (m = re.exec(doc));) {
    marks.push({ type: m[1], start: m.index, end: re.lastIndex, tag: m[0] })
  }

  const instr = doc.indexOf('TOC \\o')
  if (instr < 0) return null

  // A mezőt nyitó jel az utasítás előtti utolsó „begin”.
  let bi = -1
  for (let n = marks.length - 1; n >= 0; n--) {
    if (marks[n].start < instr && marks[n].type === 'begin') { bi = n; break }
  }
  if (bi < 0) return null

  const si = marks.findIndex((k, n) => n > bi && k.type === 'separate')
  if (si < 0) return null

  // A tárolt eredményben az egyes sorok oldalszámai önálló PAGEREF-mezők,
  // ezért a mező végét mélységszámlálással kell megkeresni.
  let depth = 1, ei = -1
  for (let n = si + 1; n < marks.length; n++) {
    if (marks[n].type === 'begin') depth++
    else if (marks[n].type === 'end' && --depth === 0) { ei = n; break }
  }
  if (ei < 0) return null

  const hint = '<w:r><w:rPr><w:i/><w:lang w:val="hu-HU"/></w:rPr><w:t xml:space="preserve">' +
    esc('A tartalomjegyzék még nem frissült. Word: Ctrl+A, majd F9. ' +
        'LibreOffice: jobb gomb a jegyzéken → Tárgymutató frissítése.') +
    '</w:t></w:r>'

  // A vágás határai FUTTATÁS-határok, nem a jelek maga: a fldChar a run
  // belsejében áll, így a jel mellett vágva run kerülne runba (sémasértés).
  const cut = doc.indexOf('</w:r>', marks[si].end)
  const paste = Math.max(doc.lastIndexOf('<w:r ', marks[ei].start),
                         doc.lastIndexOf('<w:r>', marks[ei].start))
  if (cut < 0 || paste < 0 || paste <= cut) return null

  // A kivágott rész bekezdéshatárai kiegyensúlyozottan tűnnek el: a mező első
  // bekezdésének nyitó, az utolsóénak záró jele marad meg, közte minden pár.
  let out = doc.slice(0, cut + '</w:r>'.length) + hint + doc.slice(paste)
  // A „begin” az elvágott rész ELŐTT van, indexe tehát nem csúszott el.
  const dirty = marks[bi].tag.replace(/<w:fldChar\b/, '<w:fldChar w:dirty="true"')
  return out.slice(0, marks[bi].start) + dirty + out.slice(marks[bi].end)
}

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
  const stats = files.map(f => {
    const md = fs.readFileSync(path.join(CONTENT, f), 'utf8')
    return { file: f, words: countWords(md), wordsWord: countWordsWord(md) }
  })
  const inQuota = s => QUOTA.chapters.some(c => s.file.startsWith(c))
  const core = stats.filter(inQuota).reduce((n, s) => n + s.words, 0)
  const coreWord = stats.filter(inQuota).reduce((n, s) => n + s.wordsWord, 0)

  console.log('\nSzószám fejezetenként:            folyó szöveg   Word szerint')
  for (const s of stats) {
    console.log(`  ${s.file.padEnd(30)} ${String(s.words).padStart(8)} ${String(s.wordsWord).padStart(14)}`)
  }
  const pct = Math.round((core / QUOTA.max) * 100)
  const bar = '█'.repeat(Math.min(30, Math.round(pct / 3.34))).padEnd(30, '·')
  console.log(`\n  2.+3. fejezet (előírás ${QUOTA.min}–${QUOTA.max} szó):`)
  console.log(`  [${bar}] ${core} szó  (${pct}% a felső határhoz képest)`)
  console.log(`  Word szerint (címekkel, feliratokkal együtt): ${coreWord} szó`)
  if (core < QUOTA.min) console.log(`  -> még ${QUOTA.min - core} szó kell a minimumhoz`)
  else if (core > QUOTA.max) console.log(`  !! ${core - QUOTA.max} szóval TÚLLÉPTE a felső határt`)
  else if (coreWord > QUOTA.max) console.log(`  -> a folyó szöveg belefér, de a Word ${coreWord - QUOTA.max} szóval többet mutat`)
  else console.log(`  -> az előírt tartományban mindkét mérés szerint`)

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
  const { xml: frontMatter, missing } = fillFrontMatter(body.slice(0, paraStart === -1 ? splitAt : paraStart))
  if (missing.length) {
    console.log('\n  ! a sablonban nem találom ezeket a helyőrzőket:')
    for (const m of missing) console.log(`      "${m}"`)
  }

  // Tartalom generálása
  const figureState = { figNo: 0, tabNo: 0, media: [], missing: [] }
  let generated = ''
  for (const f of files) {
    const md = fs.readFileSync(path.join(CONTENT, f), 'utf8')
    // A sablon előírja: minden fejezet új oldalon kezdődik
    const xml = mdToXml(md, figureState)
    generated += generated ? startOnNewPage(xml) : xml
  }

  let newDoc = docXml.slice(0, bodyStart) + frontMatter + generated + sectPr + '</w:body></w:document>'
  const toc = resetToc(newDoc)
  if (toc) newDoc = toc
  else console.warn('  ! a tartalomjegyzék-mezőt nem találom — a sablon szerkezete változhatott')
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

  // A tartalomjegyzék a sablonban Word-mező, amelynek eltárolt eredménye még a
  // sablon példafejezeteit sorolja fel. A mezőt a Word csak kérésre számolja
  // újra, ezért a dokumentum megnyitáskori frissítésre kerül megjelölésre —
  // enélkül a kész dolgozatban is a sablon tartalomjegyzéke látszana.
  // (A séma szerint az elem a hdrShapeDefaults elé tartozik.)
  const settingsPath = 'word/settings.xml'
  let settings = await zip.file(settingsPath).async('string')
  if (!settings.includes('<w:updateFields')) {
    const marker = '<w:hdrShapeDefaults>'
    settings = settings.includes(marker)
      ? settings.replace(marker, `<w:updateFields w:val="true"/>${marker}`)
      : settings.replace('</w:settings>', '<w:updateFields w:val="true"/></w:settings>')
    zip.file(settingsPath, settings)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))

  console.log(`\nKész: ${path.relative(ROOT, OUT)}`)
  console.log(`  ${figureState.figNo} ábra, ${figureState.tabNo} táblázat-felirat, ${figureState.media.length} beágyazott kép`)
  // A méret kiírása azért kell, mert egy álló tájolású képernyőkép a
  // szövegtükör szélességére igazítva magasabb lenne a lapnál. A korlátozás
  // némán történik, tehát csak itt látszik, ha egy kép a maximumra ütközött.
  for (const s of imageSizes) {
    const jel = (s.capped ? '  (magasságra korlátozva)' : '') +
                (s.scale !== 1 ? `  (${Math.round(s.scale * 100)}%-ra véve)` : '')
    console.log(`      ${s.file.padEnd(26)} ${s.w.toFixed(1)} × ${s.h.toFixed(1)} cm${jel}`)
  }
  if (figureState.missing.length) {
    console.log(`  ! ${figureState.missing.length} ábra HELYŐRZŐVEL került be (a sorszámozás helyes marad):`)
    for (const f of figureState.missing) console.log(`      thesis/figures/${f}`)
  }
  console.log('  A sablon érintetlen maradt.\n')
}

main().catch(e => { console.error(e); process.exit(1) })
