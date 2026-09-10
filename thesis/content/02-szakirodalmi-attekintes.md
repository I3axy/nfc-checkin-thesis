<!-- ===========================================================================
     2. SZAKIRODALMI ÁTTEKINTÉS
     Előírás: a teljes szöveg 20–30%-a  ->  cél kb. 2000–2800 szó.
     Ez NEM a saját munka bemutatása, hanem mások megoldásainak áttekintése.
     A hivatkozások számozása a SZÖVEGBELI megjelenés sorrendjében megy.
     =========================================================================== -->

# Szakirodalmi áttekintés

A munkaidő-nyilvántartás automatizálása több évtizedes múltra tekint vissza, a
megoldások mégis folyamatosan változnak, ahogy az azonosítási technológiák és a
szoftverarchitektúrák fejlődnek. Ebben a fejezetben azok az elméleti alapok és
létező megoldások kerülnek bemutatásra, amelyek a dolgozat tárgyát képező
rendszer megértéséhez szükségesek. Először az azonosítási technológiák
összehasonlítása történik meg, majd a választott NFC technológia részletes
tárgyalása. Ezt követi a jelenlegi piaci és kutatási megoldások áttekintése,
a webalkalmazás-architektúrák vizsgálata, végül a mesterséges intelligencia
vezetői kimutatásokban betöltött szerepének bemutatása.

## Az azonosítási technológiák áttekintése

Minden jelenléti rendszer alapkérdése, hogy miként azonosítja a belépő személyt.
Az azonosítás módja határozza meg a rendszer megbízhatóságát, költségét és a
visszaélésekkel szembeni ellenálló képességét, ezért a technológia
megválasztása az egyik legfontosabb tervezési döntés.

A legegyszerűbb megoldást a vonalkód és a QR-kód jelenti. Előállításuk
gyakorlatilag ingyenes, egy nyomtatott kártya vagy egy telefon képernyője is
elegendő hozzájuk. Éppen ez az egyszerűség jelenti a legnagyobb gyengeségüket
is: a kód egyetlen fényképpel lemásolható, majd tetszőleges számú példányban
felhasználható. Jelenléti rendszerben ez azt jelenti, hogy egy dolgozó a
kollégájának átküldheti a saját kódját, aki így helyette is jelenlétet
regisztrálhat.

A mágnescsíkos kártyák a bankkártyák elterjedésével váltak ismertté. Az
adathordozó fizikai érintkezést igényel az olvasóval, ami mechanikai kopáshoz és
az élettartam csökkenéséhez vezet. Biztonsági szempontból szintén korlátozottak,
mivel a mágnescsík tartalma viszonylag egyszerű eszközökkel kiolvasható és
átírható.

A rádiófrekvenciás azonosítás (RFID) érintés nélküli működést tesz lehetővé,
így megszünteti a mechanikai kopás problémáját. Az RFID gyűjtőfogalom, amely
több frekvenciasávot és szabványcsaládot foglal magában; a hozzáférés-vezérlésben
elsősorban a 13,56 MHz-es sáv terjedt el [1]. Az ebbe a sávba tartozó NFC
(Near Field Communication) technológia a rövid hatótávolsága miatt kifejezetten
alkalmas beléptetési feladatokra, mivel a kártyát tudatosan az olvasóhoz kell
érinteni.

A biometrikus azonosítás — ujjlenyomat, arcfelismerés vagy íriszvizsgálat —
elvi előnye, hogy az azonosító nem adható át másnak, így a helyettesítéssel
elkövetett visszaélés kizárható. Alkalmazását ugyanakkor jelentős adatvédelmi
megfontolások korlátozzák: a biometrikus adat az Európai Unió általános
adatvédelmi rendelete értelmében a személyes adatok különleges kategóriájába
tartozik [2], kezeléséhez szigorúbb feltételek teljesülése szükséges. Ehhez járul a
magasabb hardverköltség, valamint a téves elutasítás és a téves elfogadás
kockázata, amely ipari környezetben — szennyezett kéz, védőkesztyű mellett —
számottevően romolhat.

A négy technológia főbb jellemzőit az 1. táblázat veti össze.

@@TABLE Az azonosítási technológiák összehasonlítása

| Technológia | Hardverköltség | Másolhatóság | Mechanikai kopás | Adatvédelmi kockázat |
|---|---|---|---|---|
| Vonalkód, QR-kód | alacsony | egyszerű (fénymásolat) | jelentős | alacsony |
| Mágnescsík | közepes | egyszerű | jelentős | alacsony |
| NFC | alacsony | eszközigényes | nincs | alacsony |
| Biometria | magas | nem értelmezhető | nincs | magas (különleges adat) |

Az áttekintésből látható, hogy egyetlen technológia sem jelent minden
szempontból optimális megoldást. Az NFC azért képez kedvező kompromisszumot,
mert érintésmentes, mechanikailag nem kopik, hardverköltsége alacsony, és a
mai mobiltelefonok jelentős része beépített olvasóval rendelkezik. Az a
gyengesége, hogy az azonosító önmagában nem titkos, kiegészítő intézkedésekkel
mérsékelhető — ezt a kérdéskört a 2.2. alfejezet tárgyalja részletesen.

## Az NFC technológia

Az NFC a 13,56 MHz-es frekvencián működő, rövid hatótávolságú kommunikációs
technológia, amely az RFID induktív csatolású változatából fejlődött ki [1]. A
két eszköz közötti adatátvitel elektromágneses indukcióval valósul meg: az
olvasó váltakozó mágneses teret hoz létre, amely a kártya antennájában feszültséget
indukál. Ennek köszönhetően a passzív kártyáknak nincs szükségük saját
energiaforrásra, ami rendkívül hosszú élettartamot és alacsony előállítási
költséget eredményez.

Az elméleti hatótávolság mintegy tíz centiméter, a gyakorlatban azonban
jellemzően négy centiméter alatt marad [1]. Ez a korlát jelenléti rendszerben nem
hátrány, hanem előny: a rövid hatótávolság biztosítja, hogy a regisztráció
kizárólag szándékos művelet eredménye lehessen, szemben a nagyobb hatótávolságú
UHF-es RFID megoldásokkal, ahol egy elhaladó személy kártyája akaratlanul is
kiolvasásra kerülhet.

A technológia szabványosítása két fő dokumentumcsaládra épül. Az érintés nélküli
közelségi kártyák fizikai és átviteli rétegét az ISO/IEC 14443 szabvány
határozza meg [3], míg az eszközök közötti kommunikáció felületét az ISO/IEC
18092 szabvány írja le [4]. Az adatátviteli sebesség 106, 212 vagy 424 kbit/s
lehet — ez a jelenléti adatok továbbításához bőségesen elegendő, hiszen
mindössze néhány bájtnyi azonosító átviteléről van szó.

Az NFC-eszközök három üzemmódban működhetnek. Olvasó/író módban az eszköz
passzív címkéket olvas ki vagy ír; ezt a módot alkalmazza a dolgozat tárgyát
képező rendszer is. Kártyaemulációs módban maga az eszköz viselkedik
kártyaként, ezen alapulnak a mobilfizetési megoldások. A pont-pont módban
két aktív eszköz cserél adatot egymással.

A gyakorlatban használt kártyatípusok közül a MIFARE család terjedt el a
legszélesebb körben. Fontos ugyanakkor megjegyezni, hogy a MIFARE Classic
kártyákban alkalmazott Crypto-1 titkosítási eljárást a kutatók visszafejtették,
és gyakorlatban is kivitelezhető támadásokat mutattak be ellene [5]. Ettől
függetlenül is igaz, hogy a kártya azonosítója (UID) nem tekinthető titkos
információnak: az ütközésfeloldás során titkosítás nélkül kerül átvitelre [3],
és írható azonosítójú kártyára átmásolható.

Ez a megállapítás közvetlen tervezési következménnyel jár. Amennyiben a rendszer
kizárólag az UID-re alapozza az azonosítást, a kártya lemásolásával a jelenlét
meghamisítható. A kockázat több módon mérsékelhető: titkosított kölcsönös
hitelesítést támogató kártyatípus alkalmazásával, második azonosítási tényező
bevezetésével, vagy a belépés pillanatában készített fénykép rögzítésével.
Az utóbbi megoldás előnye, hogy nem igényel drágább hardvert, és utólagos
ellenőrzést tesz lehetővé.

A webes alkalmazások szempontjából lényeges fejlemény a Web NFC felület,
amely lehetővé teszi, hogy a böngészőben futó alkalmazás közvetlenül hozzáférjen
az eszköz NFC-olvasójához [6]. A felület jelentősége abban áll, hogy natív
alkalmazás fejlesztése és telepítése nélkül készíthető beléptető megoldás.
Korlátja, hogy jelenleg kizárólag a Chromium alapú böngészők Android
rendszeren futó változatai támogatják, továbbá a felület csak biztonságos
környezetben (HTTPS protokollon keresztül) érhető el.

## Jelenléti nyilvántartó rendszerek

A munkaidő rögzítésének legrégebbi módszere a papíralapú jelenléti ív, amely
máig jelen van a kisebb vállalkozásoknál. Előnye a nulla bevezetési költség,
hátránya viszont számottevő: az adatok utólagos feldolgozása kézi munkát
igényel, a bejegyzések visszamenőleg módosíthatók, és a bérszámfejtéshez
szükséges összesítés hibalehetőségekkel terhelt.

Az elektronikus megoldások két nagy csoportra oszthatók. Az önálló terminálok
saját hardverrel, beépített olvasóval és megjelenítővel rendelkeznek. Előnyük a
megbízhatóság és a zárt működés, hátrányuk a magas beszerzési ár, valamint az,
hogy az adatok kinyerése gyakran a gyártó saját szoftverén keresztül lehetséges.
A mobileszköz-alapú megoldások ezzel szemben meglévő okostelefonokat vagy
táblagépeket használnak olvasóként, így a hardverköltség jelentősen csökken, a
rendszer pedig rugalmasabban telepíthető.

Egy megvalósított rendszer részletesen dokumentált példája világítja meg, mit
old meg és mit hagy nyitva ez a megközelítés [7]. A hivatkozott munka
intézményi jelenlét-nyilvántartást automatizál: a dolgozó a PN532 típusú
olvasóhoz érinti a kártyáját, a rendszer pedig a kártya egyedi azonosítóját a
valós idejű órától kapott időbélyeggel együtt előbb helyben, memóriakártyán
rögzíti, majd rádiós kapcsolaton továbbítja a távoli adatbázisba. A felépítés
lényeges vonása tehát, hogy a rögzítés és a továbbítás elválik egymástól.

A szerzők méréseket is közölnek. A jelenléti ív aláírása dolgozónként
mintegy harminc másodpercet vett igénybe, a kártya beolvasása és a
visszajelzés megjelenítése ezzel szemben kettőt, a berendezés pedig fél
másodperc múlva készen állt a következő kártya fogadására. Száz fő
beléptetése a papíralapú eljárással ötven percig tartott, a kártyással ötven
másodpercig; az adat távoli kiszolgálóra juttatása további egy másodpercet
igényelt. A megoldás korlátait a szerzők maguk is felsorolják: az alkalmazott
rádiós modul hatótávolsága rövid, a hálózat pont-pont kapcsolatra
korlátozódott, a méréseket pedig mindössze hét kártyából álló mintán
végezték.

A példa két tanulsággal szolgál a jelen dolgozat szempontjából. Egyrészt
megerősíti a helyi rögzítés és a késleltetett továbbítás létjogosultságát,
amely a hálózatfüggetlen működés alapgondolata. Másrészt rávilágít arra, amit a
hivatkozott munka nem tárgyal: a kártya átruházhatóságából fakadó visszaéléssel
nem foglalkozik, holott a beléptetés gyorsításából származó nyereség önmagában
nem teszi hitelesebbé a nyilvántartást.

A kereskedelmi forgalomban elérhető rendszerek jellemzően előfizetéses
konstrukcióban, zárt forráskóddal érhetők el. Ez több szempontból is korlátozó:
a felhasználó nem ellenőrizheti az adatkezelés módját, a rendszer testreszabása
a gyártó közreműködésétől függ, a szolgáltatás megszűnése esetén pedig az
adatok hordozhatósága kérdéses.

A jelenléti rendszerek visszatérő problémája a szakirodalomban *buddy punching*
néven ismert visszaélés, amelynek során az egyik dolgozó a távollévő kollégája
helyett regisztrálja a jelenlétet. A jelenség azért nehezen kezelhető, mert nem
a rendszer technikai hibájából, hanem az azonosító átruházhatóságából fakad. A
védekezés lehetséges irányai a biometrikus azonosítás, a helymeghatározás
alapú ellenőrzés, valamint a belépéskor készített fényképfelvétel. Az utolsó
megoldás sajátossága, hogy önmagában nem akadályozza meg a visszaélést, hanem
utólag ellenőrizhetővé és ezáltal kockázatossá teszi azt.

Az adatkezelés jogi kereteit az általános adatvédelmi rendelet határozza meg
[2], amelynek egyik alapelve az adattakarékosság: kizárólag a célhoz
feltétlenül szükséges adatok kezelhetők. Jelenléti rendszer esetében ez azt jelenti, hogy a
be- és kilépés időpontjának rögzítése indokolt, a dolgozó folyamatos
helymeghatározása vagy tevékenységének megfigyelése azonban már nem. Ez a
szempont a rendszer tervezésekor is figyelembe veendő, például úgy, hogy a
fényképfelvétel kizárólag a regisztráció pillanatában készül, és zárt
tárolóban, korlátozott hozzáféréssel kerül elhelyezésre.

## Webalkalmazás-architektúrák

A webes technológiák fejlődésével a böngészőben futó alkalmazások képességei
megközelítették a natív alkalmazásokét. A progresszív webalkalmazás (PWA)
fogalma olyan webalkalmazást jelöl, amely telepíthető az eszközre, teljes
képernyőn futtatható, és hálózati kapcsolat nélkül is működőképes marad. Ennek
technikai alapját a *service worker* képezi: egy háttérben futó szkript, amely
elfogadja az alkalmazás hálózati kéréseit, és eldönti, hogy azokat a hálózatról
vagy a helyi gyorsítótárból szolgálja ki [8].

A hálózatfüggetlen (offline-first) tervezés ennél tovább megy: nem
kivételes állapotként kezeli a kapcsolat hiányát, hanem alapértelmezésként. Az
ilyen alkalmazás először mindig a helyi tárolóval dolgozik, és a szerverrel való
egyeztetés a háttérben, alkalomadtán történik meg. A böngészőben erre a célra az
IndexedDB áll rendelkezésre, amely strukturált adatok tárolására és
indexelésére alkalmas beágyazott adatbázis.

A megközelítés központi kérdése a szinkronizáció helyessége. Amennyiben a
kapcsolat helyreállása után az elmentett műveletek visszajátszásra kerülnek, két
hibalehetőséggel kell számolni. Egyrészt a válasz elveszhet azután, hogy a
szerver már feldolgozta a kérést; az ismételt küldés ilyenkor duplikált
bejegyzést hozna létre. Ez idempotens művelettel előzhető meg, azaz úgy, hogy
ugyanazon művelet többszöri végrehajtása is egyetlen eredményt hoz létre — a
gyakorlatban a kliens által előállított egyedi azonosítóval és az adatbázis
oldalán érvényesített egyediségi megkötéssel. Másrészt az események sorrendje
felborulhat, ezért az eredeti időbélyeget a kliensnek kell rögzítenie és
továbbítania, nem pedig a szervernek a feldolgozás pillanatában. Az így
kialakuló, átmenetileg eltérő, majd fokozatosan egyező állapotot a szakirodalom
eventual consistency néven tárgyalja [9].

A háttérrendszerek területén az utóbbi években elterjedt a BaaS
(*Backend as a Service*) modell, amely kész szolgáltatásként kínálja az
adatbázist, a hitelesítést, a fájltárolást és a szerveroldali függvények
futtatását. Előnye a lényegesen rövidebb fejlesztési idő, hátránya a
szolgáltatóhoz való kötődés.

Több cég egyidejű kiszolgálása esetén a több bérlős (multi-tenant)
adatmodell kialakítása külön mérlegelést igényel. Három bevett minta létezik:
bérlőnként külön adatbázis, közös adatbázison belül külön séma, illetve közös
táblák bérlőazonosítóval megkülönböztetett sorokkal [10]. Az első a legerősebb
elkülönítést adja, de a legdrágább üzemeltetni; a harmadik a
leggazdaságosabb, viszont a legnagyobb figyelmet igényli, mivel egyetlen
hiányzó szűrőfeltétel adatszivárgáshoz vezethet.

Ez utóbbi kockázat csökkenthető a sorszintű biztonság (Row Level Security)
alkalmazásával, amelyet a PostgreSQL adatbázis-kezelő is támogat. Ennek lényege,
hogy a szűrési szabály nem az alkalmazás kódjában, hanem az adatbázisban kerül
meghatározásra, így akkor is érvényesül, ha a lekérdezésből véletlenül kimarad a
feltétel [11]. A védelem ezáltal a rendszer olyan rétegébe kerül, amely a
fejlesztői hibától függetlenül hat.

## Mesterséges intelligencia alkalmazása vezetői kimutatásokban

A jelenléti rendszerek hagyományosan táblázatokban és diagramokon jelenítik meg
az összegyűjtött adatokat. Ez a megjelenítési forma pontos, ugyanakkor a
következtetés levonását teljes egészében a felhasználóra hárítja: a vezetőnek
kell felismernie, hogy egy adott érték szokatlan-e, és hogy a különböző mutatók
együttesen milyen képet rajzolnak ki.

A nagy nyelvi modellek (Large Language Model, LLM) megjelenése ezen a
ponton kínál új lehetőséget. Ezek a modellek nagy mennyiségű szövegen tanított,
transzformer architektúrájú neurális hálózatok, amelyek képesek úgynevezett
*few-shot* módon, azaz kifejezetten az adott feladatra irányuló betanítás nélkül
is elfogadható eredményt adni, pusztán a bemenetben megfogalmazott utasítás
alapján [12]. A gyakorlati jelentőség abban áll, hogy egy strukturált
adathalmaz természetes nyelvű összefoglalásához nem szükséges saját modellt
tanítani; elegendő az adatokat és az elvárt kimenet leírását a modellnek
átadni.

Vezetői kimutatások esetében ez a képesség két területen hasznosítható. Az
adatösszefoglalás során a modell a számokból folyó szöveget állít elő, ami
csökkenti a kimutatás értelmezéséhez szükséges időt. Az eltérések
kiemelésével pedig felhívható a figyelem azokra a mutatókra, amelyek az
előző időszakhoz képest számottevően megváltoztak. A megközelítés különösen ott
értékes, ahol a vezető nem rendszeresen, hanem alkalomszerűen tekinti át az
adatokat, és nincs meg benne az az összehasonlítási alap, amelyhez a látott
értékeket viszonyíthatná.

Az alkalmazásnak ugyanakkor több lényeges korlátja van, amelyeket a tervezés
során figyelembe kell venni.

A legsúlyosabb kockázatot a konfabuláció — a szakirodalomban gyakran
*hallucináció* néven tárgyalt jelenség — jelenti: a modell olyan állítást is
megfogalmazhat, amely nyelvileg meggyőző, tartalmilag viszont nem támasztja alá
a bemenet [13]. Munkaidő-nyilvántartásban ez közvetlen kárt okozhat, hiszen egy
kitalált adat munkajogi következménnyel járó döntés alapjául szolgálhat. A
kockázat mérséklésének bevett módja, hogy a modell kizárólag a ténylegesen
átadott adatokra támaszkodhat, és az utasítás kifejezetten megtiltja a
kiegészítést vagy a becslést.

A második korlát adatvédelmi természetű. A modell működtetése jellemzően
külső szolgáltatónál történik, így minden elküldött adat elhagyja a rendszer
határát. Az adattakarékosság elve ezért itt is érvényes: amennyiben a feladat
összesített értékekből is elvégezhető, személyazonosításra alkalmas adatot nem
indokolt továbbítani.

Harmadrészt a modellhívás költséggel és késleltetéssel jár. A válaszidő
jellemzően több másodperc, ami a felhasználói felület tervezését is
befolyásolja: az összefoglaló nem képezheti az oldal betöltésének feltételét,
hanem külön, a felhasználó által kezdeményezett műveletként célszerű
megvalósítani. Ehhez járul, hogy a szolgáltatás átmenetileg elérhetetlenné
válhat, ezért a rendszer működőképességét nem szabad tőle függővé tenni.

## Következtetések az áttekintésből

Az áttekintésből több olyan hiányosság rajzolódik ki, amely a saját megoldás
követelményeit meghatározza.

Az azonosítási technológiák közül az NFC kedvező kompromisszumot képez, a
kártyaazonosító azonban nem titkos, ezért önmagában nem elegendő. A meglévő
jelenléti rendszerek jellemzően zárt forráskódú, előfizetéses termékek,
amelyek gyakran saját hardvert igényelnek, és az adatkezelés módja kívülről nem
ellenőrizhető. A *buddy punching* jelensége ellen a legtöbb megfizethető
megoldás nem nyújt védelmet.

Külön figyelmet érdemel, hogy a piaci rendszerek a hálózati kapcsolat meglétét
rendszerint adottnak tekintik. Ipari környezetben — csarnokban, telephely
bejáratánál — ez az előfeltevés nem tartható, a beléptetés viszont
kapcsolathiány esetén sem szüneteltethető.

Az áttekintett munkák további közös vonása, hogy a részproblémákat egymástól
elkülönítve tárgyalják. A hálózatfüggetlen működés a webalkalmazás-architektúrák,
a bérlők elkülönítése az adatbázis-tervezés, a visszaélés elleni védekezés pedig
a jelenléti rendszerek irodalmában jelenik meg; olyan megoldás azonban nem került
elő, amely a hármat egyetlen, célhardver nélküli rendszerben egyesítené. A [7]
hivatkozásban bemutatott rendszer például a helyi rögzítés és a késleltetett
továbbítás kérdését megoldja, a kártya átruházhatóságával viszont nem foglalkozik,
több cég párhuzamos kiszolgálása pedig fel sem merül benne.

Hasonló hiányosság mutatkozik az értékelés módjában. A jelenléti rendszereket
bemutató közlemények jellemzően a beolvasás sebességét és a hardver
megbízhatóságát mérik, azt viszont nem vizsgálják, hogy a rögzített adat
mennyiben felel meg a valóságnak. Márpedig a nyilvántartás értéke éppen ezen
múlik: egy gyors, de átruházható azonosítóval működő rendszer pontosan azt a
hibát örökíti tovább, amelyet a papíralapú ív is hordoz. Az áttekintés alapján
tehát nem a mérés sebessége, hanem a bejegyzés hitelessége az a pont, ahol a
meglévő megoldások a leginkább hiányosak.

Ezekből a megállapításokból három követelmény vezethető le, amelyek a
következő fejezetben kidolgozott rendszer tervezését irányították: az
azonosítást kiegészítő, olcsó ellenőrzési lehetőség biztosítása; a hálózati
kapcsolattól független működés; valamint az adatok cégek közötti megbízható
elkülönítése olyan módon, hogy az ne egyetlen alkalmazásréteg helyességén
múljon.
