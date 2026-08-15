# Szakdolgozat — írás és fordítás

A dolgozat szövege **Markdownban** él a `content/` mappában, és egy szkript
állítja elő belőle a `.docx`-et a **hivatalos sablon stílusaival**.

Az eredeti sablon (`../sablon/`) **soha nem módosul** — a generátor csak olvassa.

## Használat

```bash
cd thesis
npm install          # egyszer
npm run build        # -> out/szakdolgozat.docx
npm run words        # csak szószám-jelentés, nem generál fájlt
```

A `npm run build` minden futáskor kiírja a fejezetenkénti szószámot és azt,
hogy a **2.+3. fejezet** hol áll az előírt **7000–10 000 szavas** tartományban.

## Mit vesz át a sablonból változatlanul

Nyers XML-ként másolva, tehát bitre azonosan:

- címlap, hallgatói nyilatkozat, absztrakt, tartalomjegyzék (Word-mező),
  jelmagyarázat, köszönetnyilvánítás, „A szakdolgozat témája”
- a záró `sectPr`: lapméret (A4), margók, élőfej/élőláb
  — ennek módosítását a sablon kifejezetten tiltja
- az összes stílusdefiníció és a felsorolás-számozás

A generátor csak az **„1. Bevezető"-től a Mellékletek végéig** ír tartalmat.

## Markdown jelölések

| Jelölés | Word stílus | Megjegyzés |
|---|---|---|
| `# Cím` | Heading1 | számozott főfejezet |
| `## Cím` | Heading2 | |
| `### Cím` | Heading3 | |
| `#### Cím` | Heading4 | |
| `#! Cím` | Heading1nonumbering | számozatlan (pl. „Irodalom") |
| sima szöveg | Normal | az üres sorig egy bekezdésbe olvad |
| `- tétel` | ListParagraph | pontozott (a sablon numId 7) |
| `1. tétel` | ListParagraph | számozott (a sablon numId 10) |
| `> szöveg` | Normal, behúzva | hosszabb idézet, kisebb betű |
| ` ```…``` ` | Normal program code | ` ```framed ` a keretes változat |
| `![Felirat](kep.png)` | Normal figure-table + Caption | a felirat az ábra **alá** kerül, automatikus sorszámmal |
| `@@TABLE Felirat` | Caption | a felirat a táblázat **fölé** kerül |
| `\| a \| b \|` | Normal figure-table | csőtáblázat; a második sor az elválasztó (`\|---\|---\|`), az első sor fejléc lesz |
| `@@BIB` | Bibliography | innentől minden sor irodalomjegyzék-stílusú |
| `@@PAGEBREAK` | — | kézi oldaltörés |
| `<!-- … -->` | — | **útmutató, nem kerül a dokumentumba és a szószámba sem** |

Félkövér: `**szöveg**`, dőlt: `*szöveg*`, kód a szövegben: `` `kód` ``.

## Ábrák

A képfájlok a `figures/` mappába kerülnek, és a fájlnévvel hivatkozol rájuk.
Ha egy kép hiányzik, a build figyelmeztet, de nem áll le.

A képek automatikusan a szövegtükör szélességére kicsinyülnek, ha szélesebbek.

A `figures/abrak.html` böngészőben megnyitva legenerálja az architektúra- és az
adatbázisséma-ábrát; a gombokkal letöltött PNG-ket ugyanide kell menteni.

## Címlap és előlapok

A címlap, az absztrakt, a jelmagyarázat, a köszönetnyilvánítás és a témaleírás
adatai a **`meta.mjs`** fájlban állnak. A build ezekre cseréli a sablon
helyőrzőit — a sablon maga változatlan marad. Ha egy helyőrzőt nem talál, a
build kiírja, melyiket.

## Amit a végén kézzel kell elvégezni Wordben

A generátor **statikus** ábra- és táblázatszámozást ír (`1. ábra: …`),
mert az „Insert Caption" és a „Cross-reference" valódi Word-mezőket használ.

Ezért a leadás előtt:

1. A tartalomjegyzék frissítése. A build megjelöli a dokumentumot frissítendőnek,
   így a Word megnyitáskor rákérdez; ha nem, kattintás a tartalomjegyzékre → F9 →
   *Update entire table*.
2. A nyilatkozat keltezésének kitöltése (a `meta.mjs`-ben helykitöltő áll).
3. Ha a mentor élő hivatkozásokat kér az ábrákhoz, azokat egyszer végig kell
   kattintani. Ha a statikus számozás megfelel, nincs vele dolog.
4. A tényleges szószám ellenőrzése: a 2.+3. fejezetet kijelölve
   *Véleményezés → Szavak száma*. A build kétféle becslést ad, de a hivatalos
   szám a Wordé.

## Terjedelmi előírások (a sablonból)

- **2. + 3. fejezet együtt: 25–50 oldal, 7000–10 000 szó**
- a 2. fejezet a teljes szöveg 20–30%-a → kb. 2000–2800 szó
- a bevezető legfeljebb másfél oldal
- az absztrakt 100–200 szó
- minden fejezet új oldalon kezdődik (a build ezt automatikusan megteszi)
- IEEE-hivatkozás, a **szövegbeli megjelenés** sorrendjében számozva
- legalább **egy valódi szakkönyv** kell az irodalomjegyzékbe
- a teljes forráskód a Mellékletekbe megy, nem a 3. fejezetbe
