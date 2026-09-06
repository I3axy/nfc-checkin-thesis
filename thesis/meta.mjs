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
  // A sablon HÁROM címhelyet tartalmaz: magyar, szerb (LATIN betűkkel) és
  // angol. A cirill betűs változatnak a címlapon nincs helye — ha máshol
  // (pl. jelentkezési lapon) szükséges, innen másolható:
  //
  //   Развој информационог система за евиденцију присуства применом NFC и
  //   PWA технологија
  //
  titleHu: 'Információs jelenlétkezelő rendszer fejlesztése NFC és PWA technológiák alkalmazásával',
  titleSr: 'Razvoj informacionog sistema za evidenciju prisustva primenom NFC i PWA tehnologija',
  titleEn: 'Development of an Information System for Attendance Tracking Using NFC and PWA Technologies',

  student:  'Barát Balázs',
  // A mentor a visszaküldött dokumentumban vezetéknév-keresztnév sorrendre
  // javította a saját nevét, a címlapon és a köszönetnyilvánításban egyaránt.
  mentor:   'dr. Čović Zlatko',
  indexNo:  '26223081',
  place:    'Szabadka',
  year:     '2026',

  // A nyilatkozat keltezése.
  // FIGYELEM: ez a szöveg egy 1668 twip (2,94 cm) széles táblázatcellába
  // kerül. Bármit írunk ide a sablon eredeti szövegén felül, az több sorba
  // tördelődik és szétfeszíti az aláírás-táblázatot. A dátumnak a MELLETTE
  // lévő cella van fenntartva — oda a kinyomtatott példányon kézzel kerül,
  // az aláírással együtt.
  dateLine: 'Szabadkán, kelt',

  // ── Absztrakt (a sablon szerint 100–200 szó) ──────────────────────────────
  abstract:
    'A szakdolgozat egy NFC-alapú jelenléti nyilvántartó rendszer tervezését ' +
    'és megvalósítását mutatja be. A feladat abból a problémából indult ki, ' +
    'hogy a kézzel vezetett jelenléti ív utólag módosítható és nehezen ' +
    'ellenőrizhető, a meglévő zárt rendszerek költségesek, hálózatkimaradás ' +
    'esetén pedig használhatatlanná válnak. A megvalósított rendszer három ' +
    'progresszív webalkalmazásból (PWA) áll — beléptető terminál, dolgozói ' +
    'önkiszolgáló felület ' +
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
  // A mentor által javított szöveg, betű szerint átvéve.
  thanks:
    'Köszönettel tartozom mentoromnak, dr. Čović Zlatkónak a szakdolgozat ' +
    'készítése során nyújtott iránymutatásért, és azért, hogy a felmerülő ' +
    'kérdésekkel bármikor fordulhattam hozzá. Köszönöm a Szabadkai Műszaki ' +
    'Szakfőiskola oktatóinak az elmúlt években végzett munkájukat. Végül ' +
    'köszönöm a családomnak a türelmet azokban a hónapokban, amikor a ' +
    'fejlesztés a szabad estéket is elvitte.',

  // ── A szakdolgozat témája (a mentor határozza meg) ─────────────────────────
  // A mentor a visszaküldött dokumentumban pontozott felsorolásra cserélte a
  // korábbi folyó szöveget, mert a véleményezésre küldött példány még nem a
  // kész, sablon szerinti dokumentum volt. A leadott változatban ismét folyó
  // szöveg áll, de a felsorolás két olyan pontjával kiegészítve, amely a
  // korábbi szövegből hiányzott: a kapcsolat nélkül keletkezett események
  // későbbi szinkronizálása, valamint a tesztelés és az eredmények értékelése.
  // Az üres sor bekezdéshatárt jelöl.
  topic:
    'A szakdolgozat feladata egy NFC-technológiára épülő jelenléti nyilvántartó ' +
    'rendszer megtervezése és megvalósítása webes alkalmazásként. A feladat abból ' +
    'a gyakorlati problémából indul ki, hogy a kézzel vezetett jelenléti ív ' +
    'utólag módosítható és a bejegyzés valódisága nem ellenőrizhető, a zárt, ' +
    'célhardverre épülő beléptető rendszerek viszont költségesek, nehezen ' +
    'alakíthatók, és hálózatkimaradás esetén használhatatlanná válnak. A ' +
    'megoldásnak ezért telepítés és célhardver nélkül, a bejáratnál elhelyezett, ' +
    'NFC-képes eszközön futó webalkalmazásként kell működnie.\n\n' +
    'A rendszernek a munkavállalók érkezését és távozását kártyaérintéssel kell ' +
    'rögzítenie, a művelet irányát pedig a korábbi eseményekből önállóan kell ' +
    'meghatároznia. Több cég adatait egymástól elkülönítve és biztonságosan kell ' +
    'kezelnie, és hálózati kapcsolat hiányában is működőképesnek kell maradnia — ' +
    'a kapcsolat nélkül keletkezett eseményeket a kapcsolat helyreállásakor, ' +
    'ismétlés nélkül kell továbbítania. Kezelnie kell továbbá a távollét-kérelmek ' +
    'benyújtási és jóváhagyási folyamatát, a dolgozók számára önkiszolgáló ' +
    'felületet, a vezetők számára pedig időszakos kimutatásokat, valós idejű ' +
    'állapotképet és automatikus értesítéseket kell nyújtania.\n\n' +
    'A feladat része három olyan kérdés önálló megoldása, amely a szakirodalomban ' +
    'is visszatérő nehézség: a kártya átadásával elkövethető visszaélés kizárása, ' +
    'a hálózatfüggetlen működés megvalósítása, valamint a cégek adatainak olyan ' +
    'elkülönítése, amely nem az alkalmazáskód helyességén múlik. Emellett tartalék ' +
    'azonosítási módot kell biztosítani az otthon felejtett kártya esetére.\n\n' +
    'A várható eredmény egy működő, több alkalmazásból álló rendszer, amelyben az ' +
    'egyes tervezési döntések önálló megoldásokat tükröznek, és a dolgozatban az ' +
    'elvetett alternatívákkal és indoklással együtt kerülnek bemutatásra. A ' +
    'dolgozat feladata továbbá az alkalmazott technológiák dokumentálása és ' +
    'szakmai indoklása, a munka pedig a megvalósított rendszer tesztelésével és ' +
    'az elért eredmények értékelésével zárul.',
}
