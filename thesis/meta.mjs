// =============================================================================
// A dolgozat adatlapja — ami a sablon ELŐLAPJAIN szerepel
// =============================================================================
// A sablon címlapja, absztraktja, jelmagyarázata és "A szakdolgozat témája"
// szakasza helyőrző szöveget tartalmaz. A build ezeket cseréli le az itt
// megadott értékekre, a sablon formázásának érintése nélkül.
//
// A cseréhez a build a helyőrző SZÖVEGÉT keresi, nem a bekezdés sorszámát.
// Ha a sablon egyszer módosul, a build hangosan hibát jelez, ahelyett hogy
// némán kihagyná a kitöltést.
//
// LEADÁS ELŐTT ELLENŐRIZENDŐ:
//   * a szerb és angol cím fordítása
//   * a mentor nevének írásmódja
//   * a nyilatkozat keltezése
// =============================================================================

export const META = {
  // ── Címlap ────────────────────────────────────────────────────────────────
  titleHu: 'NFC-alapú jelenléti nyilvántartó rendszer fejlesztése',
  titleSr: 'Razvoj sistema za evidenciju prisutnosti zasnovanog na NFC tehnologiji',
  titleEn: 'Development of an NFC-based attendance tracking system',

  student:  'Barát Balázs',
  mentor:   'dr. Zlatko Čović',
  indexNo:  '26223081',
  place:    'Szabadka',
  year:     '2026',

  // A nyilatkozat keltezése. A pontos nap a leadáskor írandó be.
  dateLine: 'Szabadkán, kelt 2026. ______________',

  // ── Absztrakt (a sablon szerint 100–200 szó) ──────────────────────────────
  abstract:
    'A szakdolgozat egy NFC-alapú jelenléti nyilvántartó rendszer tervezését ' +
    'és megvalósítását mutatja be. A feladat abból a problémából indult ki, ' +
    'hogy a kézzel vezetett jelenléti ív utólag módosítható és nehezen ' +
    'ellenőrizhető, a meglévő zárt rendszerek költségesek, hálózatkimaradás ' +
    'esetén pedig használhatatlanná válnak. A megvalósított rendszer három ' +
    'webalkalmazásból áll — beléptető terminál, dolgozói önkiszolgáló felület ' +
    'és vezetői irányítópult —, amelyek közös, több bérlős háttérrendszert ' +
    'használnak. A beléptetés a dolgozó kártyájának érintésével történik, a ' +
    'művelet iránya pedig automatikusan meghatározásra kerül. A terminál ' +
    'hálózati kapcsolat nélkül is működik: az eseményeket helyben tárolja, és ' +
    'a kapcsolat helyreállásakor ismétlés nélkül továbbítja. A kártya ' +
    'átadásával elkövethető visszaélés ellen a belépéskor készített ' +
    'fényképfelvétel véd, a cégek adatainak elkülönítését pedig adatbázis ' +
    'szintű hozzáférés-szabályozás biztosítja. A vezetői felület valós idejű ' +
    'állapotot, időszakos kimutatásokat, táblázatkezelőbe történő kivitelt és ' +
    'nyelvi modell által készített szöveges összefoglalót nyújt. A dolgozat ' +
    'a tervezési döntéseket az elvetett alternatívákkal együtt tárgyalja, és ' +
    'külön fejezetben mutatja be a megoldás korlátait.',

  // 3–5 kulcsszó, ábécésorrendben
  keywords: [
    'hálózatfüggetlen működés',
    'jelenléti nyilvántartás',
    'NFC',
    'több bérlős architektúra',
    'webalkalmazás',
  ],

  // ── Jelmagyarázat ─────────────────────────────────────────────────────────
  // Csak olyan rövidítés kerülhet ide, amely ténylegesen előfordul a szövegben.
  legend: [
    ['API',   'Alkalmazásprogramozási felület (angolul: Application Programming Interface)'],
    ['HTTPS', 'Titkosított hipertext-átviteli protokoll (angolul: Hypertext Transfer Protocol Secure)'],
    ['IEC',   'Nemzetközi Elektrotechnikai Bizottság (angolul: International Electrotechnical Commission)'],
    ['ISO',   'Nemzetközi Szabványügyi Szervezet (angolul: International Organization for Standardization)'],
    ['JSON',  'JavaScript-objektumjelölés (angolul: JavaScript Object Notation)'],
    ['LLM',   'Nagy nyelvi modell (angolul: Large Language Model)'],
    ['NFC',   'Rövid hatótávolságú kommunikáció (angolul: Near Field Communication)'],
    ['PIN',   'Személyes azonosító szám (angolul: Personal Identification Number)'],
    ['PWA',   'Progresszív webalkalmazás (angolul: Progressive Web Application)'],
    ['QR',    'Gyorsválasz-kód (angolul: Quick Response code)'],
    ['RFID',  'Rádiófrekvenciás azonosítás (angolul: Radio Frequency Identification)'],
    ['SHA',   'Biztonságos kivonatoló algoritmus (angolul: Secure Hash Algorithm)'],
    ['SQL',   'Strukturált lekérdezőnyelv (angolul: Structured Query Language)'],
    ['UHF',   'Ultramagas frekvencia (angolul: Ultra High Frequency)'],
    ['UID',   'Egyedi azonosító (angolul: Unique Identifier)'],
    ['URL',   'Egységes erőforrás-azonosító (angolul: Uniform Resource Locator)'],
  ],

  // ── Köszönetnyilvánítás (legfeljebb 100 szó; a sablon szerint elhagyható) ──
  // Egyelőre a sablon eredeti útmutató szövege áll itt: a személyes rész a
  // leadás előtt írandó meg. A véleményezésre küldött változatban így
  // egyértelmű, hogy ez a fejezet még nem készült el.
  thanks:
    'Ez a fejezet személyes megjegyzéseket tartalmaz (köszönetnyilvánítások és ' +
    'hasonlók). Terjedelme legfeljebb 100 szó. Nem kötelező jellegű, tehát ' +
    'kihagyható.',

  // ── A szakdolgozat témája (a mentor határozza meg) ─────────────────────────
  topic:
    'A szakdolgozat feladata egy NFC-technológiára épülő jelenléti ' +
    'nyilvántartó rendszer megtervezése és megvalósítása webes ' +
    'alkalmazásként. A rendszernek a munkavállalók érkezését és távozását ' +
    'kártyaérintéssel kell rögzítenie, több cég adatait egymástól elkülönítve ' +
    'kell kezelnie, és hálózati kapcsolat hiányában is működőképesnek kell ' +
    'maradnia. Kezelnie kell továbbá a távollét-kérelmek jóváhagyási ' +
    'folyamatát, valamint vezetői kimutatásokat és automatikus értesítéseket ' +
    'kell nyújtania. A várható eredmény egy működő, több alkalmazásból álló ' +
    'rendszer, amelyben az egyes tervezési döntések — az azonosítás módja, a ' +
    'hálózatfüggetlen működés megvalósítása és a visszaélés elleni védelem — ' +
    'önálló megoldásokat tükröznek, és a dolgozatban indoklással együtt ' +
    'kerülnek bemutatásra.',
}
