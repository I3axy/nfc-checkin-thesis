// =============================================================================
// Közös OOXML-segédek
// =============================================================================
// Azok a műveletek, amelyekre a dolgozat (build.mjs) és a borítólap
// (borito.mjs) egyaránt támaszkodik: a sablon bekezdéseinek megtalálása és a
// szövegük cseréje a bekezdés formázásának megtartásával.
//
// Miért kell külön modul: mindkét generátor UGYANAZOKAT a helyőrzőket tölti ki
// (cím, hallgató, mentor, leckekönyvszám, hely és év). Ha a két oldalon külön
// másolat élne, egy javítás elmaradhatna az egyiken — és a borítón szereplő
// adat eltérne a címlapétól.
// =============================================================================

export const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const paraText = p =>
  [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('')

// A bekezdések határai. A <w:pPr> nem illeszkedik, mert utána nem szóköz
// vagy '>' áll. Az önzáró (üres) bekezdést külön jelöljük — abban nincs mit
// cserélni.
export function paragraphs(xml) {
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

// A bekezdés futamainak cseréje. A futam lehet sima szöveg, vagy { t, i } alak,
// ahol az i a dőlt szedést kéri — a sablon a kulcsszavakat így szedi.
//
// Miért az ÖSSZES futam cserélődik: a sablon helyőrzői több futamra vannak
// tördelve (a szerkesztő a "vezeték és UTÓnév" szöveget is szétvágta), sőt a
// cím még kitöltendő mezőt (FILLIN) is tartalmaz. A bekezdés tulajdonságai
// (<w:pPr>, azaz a stílus) megmaradnak.
//
// A sablon futamai szerb nyelvre vannak jelölve; magyar szövegnél ez téves
// helyesírás-ellenőrzést eredményezne, ezért minden új futam hu-HU jelölést kap.
export function setParaRuns(p, runs) {
  const open = p.match(/^<w:p[^>]*>/)[0]
  const pPr = (p.match(/^<w:p[^>]*>(<w:pPr>[\s\S]*?<\/w:pPr>)/) ?? ['', ''])[1]
  const body = runs
    .filter(r => (typeof r === 'string' ? r : r.t) !== '')
    .map(r => {
      const text = typeof r === 'string' ? r : r.t
      const dolt = typeof r === 'string' ? false : Boolean(r.i)
      return `<w:r><w:rPr>${dolt ? '<w:i/><w:iCs/>' : ''}<w:lang w:val="hu-HU"/></w:rPr>` +
             `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
    })
    .join('')
  return open + pPr + body + '</w:p>'
}

export const setParaText = (p, text) => setParaRuns(p, [text])
