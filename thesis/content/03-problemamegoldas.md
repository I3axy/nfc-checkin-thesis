<!-- ===========================================================================
     3. PROBLÉMAMEGOLDÁS
     Ez a dolgozat lényegi része: a SAJÁT szakmai hozzájárulás.
     Cél: kb. 5000–7000 szó (a 2. fejezettel együtt 7000–10 000).
     Előírás: a teljes programkód NEM ide, hanem a Mellékletekbe kerül.
     Ide csak az a néhány részlet jöhet, ami a megértéshez elengedhetetlen.
     Az ábrákra hivatkozni kell a szövegben (pl. "az 1. ábrán látható módon").
     =========================================================================== -->

# Problémamegoldás

Ebben a fejezetben a megvalósított rendszer bemutatása következik, a tervezés
természetes sorrendjét követve: a követelményektől az architekturális
döntéseken és az adatmodellen át az egyes alkalmazások működéséig. A cél nem
csupán az elkészült megoldás leírása, hanem a mögötte álló döntések indoklása
is; ahol a fejlesztés közben derült ki, hogy egy korábbi elképzelés nem
tartható, ott ez külön jelzésre kerül. A programkód terjedelmi okokból a
Mellékletekbe került.

## Követelmények meghatározása

### Funkcionális követelmények

A követelmények három szerepkör szerint tagolódnak, mivel a rendszer
használatának körülményei és az egyes felhasználók igényei eltérőek.

**A dolgozóval kapcsolatos követelmények:**

- A munkaidő kezdetének és végének rögzítése NFC-kártya érintésével történjen.
- A rendszer automatikusan állapítsa meg, hogy érkezésről vagy távozásról van-e szó.
- A művelet eredményéről egyértelmű, több méter távolságból is jól érzékelhető visszajelzést adjon.
- Elfelejtett vagy nem elérhető NFC-kártya esetén biztosítson alternatív azonosítási lehetőséget.
- A dolgozó a saját jelenléti adatait a termináltól függetlenül is megtekinthesse.
- A dolgozó távolléti kérelmet nyújthasson be.
- A benyújtott kérelem állapota nyomon követhető legyen, és az elbírálás előtt visszavonható maradjon.
- A rendszer értesítse a dolgozót a kérelem elbírálásáról.
- A korábbi értesítések utólag is megtekinthetők legyenek.

**A vezetővel kapcsolatos követelmények:**

- A vezetői felület valós időben jelenítse meg a telephelyen tartózkodó dolgozókat.
- A rendszer biztosítson visszakereshető jelenléti naplót.
- A napló adatai időszak, dolgozó és műszak szerint szűrhetők legyenek.
- A rendszer tegye lehetővé a jelenléti adatok időszakos összesítését.
- Az összesített adatok táblázatkezelő programmal feldolgozható formátumban exportálhatók legyenek.
- A vezető kezelhesse a dolgozók adatait, a hiányzásokat és a vállalat beállításait.
- A vezető jóváhagyhassa vagy elutasíthassa a távolléti kérelmeket.
- Elutasítás esetén az indoklás eljusson a kérelmezőhöz.
- A rendszer támogassa a jelenléti adatok természetes nyelvű összegzését és értékelését.

**A rendszerrel szemben támasztott követelmények:**

- A nyitva maradt munkanapokat a vállalat által meghatározott időpontban automatikusan zárja le.
- Az automatikus lezárás időpontja műszakonként külön-külön beállítható legyen.
- A rendszer napi összesítőt készítsen a vezetők számára.
- A rendszer kezelje az alkalmi látogatókat is, akik nem rendelkeznek állandó NFC-kártyával.

### Nem funkcionális követelmények

A minőségi jellemzők közül négy bizonyult meghatározónak.

**Rendelkezésre állás.** A beléptetés a legkritikusabb funkció: kiesése esetén a
munkavégzés adminisztrációja ellehetetlenül. A telepítés helye — csarnok,
telephelyi bejárat — gyakran gyenge lefedettségű, ezért a hálózatkimaradást
rendes üzemmenetként kell kezelni: a beléptetésnek kapcsolat nélkül is teljes
értékűen működnie kell, a tárolt eseményeknek pedig ismétlés nélkül kell
továbbítódniuk a kapcsolat helyreállásakor.

**Válaszidő.** A kártya érintésétől a visszajelzésig eltelt időnek két
másodpercen belül kell maradnia. Ennél hosszabb várakozás után a dolgozó
bizonytalanná válik, és újra odaérinti a kártyát — ami szükségtelen ismételt
esemény.

**Adatbiztonság és a cégek elkülönítése.** A rendszer több cég adatát kezeli
ugyanabban az adatbázisban, és egyik cég adata sem lehet elérhető a másik
számára — úgy, hogy ez ne az alkalmazáskód helyességén múljon. A kezelt adatok
körét az adattakarékosság elvéhez igazodva a feladat ellátásához szükséges
minimumra kell szorítani.

**Bővíthetőség és hordozhatóság.** A külső szolgáltatások — a nyelvi modell és a
levélküldő — előbb-utóbb cserélődnek, ezért mindegyik egy-egy jól körülhatárolt
ponton kapcsolódik a rendszerhez, így a csere nem érinti a felületet. Az
alkalmazások telepítés nélkül, böngészőből használhatók.

## A rendszer architektúrája

Az első és legmeghatározóbb tervezési döntés az volt, hogy a rendszer nem
egyetlen, hanem három különálló alkalmazásból áll, közös háttérrendszerrel. A
felépítés az 1. ábrán látható.

![A rendszer architektúrája](architektura.png)

### A három alkalmazás szétválasztása

A kézenfekvőbb megoldás egyetlen alkalmazás készítése lett volna, amely a
bejelentkezett felhasználó szerepköre alapján más-más felületet jelenít meg.
Ez a megközelítés három érv miatt került elvetésre.

Az eltérő használati mód a legfontosabb szempont. A beléptető alkalmazás
falra szerelt, folyamatosan bekapcsolt eszközön fut, egyetlen képernyőt jelenít
meg, és felhasználói bejelentkezés nélkül üzemel — az azonosítást maga a kártya
végzi. A vezetői felület ezzel szemben asztali böngészőben, hitelesített
munkamenetben, összetett táblázatokkal és diagramokkal dolgozik. E két
felhasználási mód között gyakorlatilag nincs közös felületi elem.

A második érv a támadási felület csökkentése. Amennyiben ugyanaz az alkalmazás
tartalmazná a vezetői funkciókat is, a kimutatásokhoz és a dolgozói adatokhoz
tartozó programkód is eljutna a nyilvános helyen üzemelő beléptető eszközre,
még akkor is, ha a felület elrejtve marad. A szétválasztással oda kizárólag az
a kód kerül, amelyre a beléptetéshez ténylegesen szükség van.

A harmadik szempont a független telepíthetőség. A három alkalmazás eltérő
ütemben változik: a beléptető a legstabilabb, a vezetői felület viszont
folyamatosan bővül. Az elkülönítés miatt az utóbbi módosítása nem igényli a
beléptető eszközök frissítését — ezek ugyanis falra szerelve, nehezen
hozzáférhetően üzemelnek.

A három alkalmazás szerepét a 2. táblázat foglalja össze.

@@TABLE A három alkalmazás szerepe és üzemi körülményei

| Alkalmazás | Eszköz | Azonosítás | Fő feladat | Hálózat nélkül |
|---|---|---|---|---|
| Beléptető terminál | falra szerelt Android készülék | NFC-kártya vagy PIN | jelenléti esemény rögzítése | teljes értékűen működik |
| Dolgozói alkalmazás | saját mobiltelefon | PIN | saját adatok, távollét-kérelmek | nem működik |
| Vezetői felület | asztali böngésző | e-mail és jelszó | kimutatások, beállítások, elbírálás | nem működik |

A táblázat két sora magyarázatot kíván. A dolgozói alkalmazásban a PIN kizárólag
azonosít, jelenlétet nem igazol — ennek okát a 3.5.1. alfejezet tárgyalja. A
hálózatfüggetlenség pedig csak a terminálra vonatkozik: a kimutatás néhány
perccel később is megtekinthető, egy elmaradt érkezési bejegyzés viszont
pótolhatatlan.

A három alkalmazás közös háttérrendszerrel dolgozik, amely az adatbázist, a
hitelesítést, a fájltárolást és a szerveroldali függvények futtatását
biztosítja. Az üzleti logika biztonsági szempontból érzékeny része — a
beléptetés érvényesítése, a felhasználók létrehozása, a szöveges összefoglaló
előállítása — nem a böngészőben futó alkalmazásokban, hanem szerveroldali
függvényekben helyezkedik el, mivel a kliensoldali kód a felhasználó által
megtekinthető és módosítható, ezért érdemi ellenőrzésre nem alkalmas.

<!-- Az ábrafájlt a thesis/figures/ mappába kell tenni. A felirat és a
     sorszám automatikusan az ábra alá kerül. -->

### Az alkalmazott technológiák

A technológiai döntéseket két körülmény határolta be. Egyrészt a beléptetéshez
szükséges Web NFC felület kizárólag böngészőben érhető el, ami eleve webes
megvalósítást ír elő. Másrészt a fejlesztést egyetlen személy végezte, ezért
azok a megoldások kerültek előnybe, amelyek a járulékos üzemeltetési munkát a
lehető legkisebbre szorítják.

A felhasználói felület React könyvtárral készült [14]. A rendszer állapota
folyamatosan változik — érkezik egy új esemény, lezárul egy nap, megszületik
egy döntés —, és a React deklaratív megközelítése éppen az ilyen,
állapotvezérelt felületekhez való: a megjelenítés az adatból következik. Ehhez
járul, hogy a három alkalmazás közös megjelenítési elemeit komponensként elég
egyszer megírni.

Az építőeszköz a Vite, amely a forrás módosításakor nem a teljes alkalmazást,
hanem csak az érintett modult építi újra [15]. Ez NFC-vel dolgozva külön előnyt
jelent, mivel a hibakeresés valódi eszközön, ismételt kártyaérintésekkel
történik, tehát a fordítási várakozás minden próbánál újra jelentkezne.

A háttérrendszer a Supabase szolgáltatáscsomagra épül, amelynek alapja a
PostgreSQL adatbázis-kezelő. A döntés lényege nem a kényelem, hanem az, hogy a
szolgáltatás nem rejti el az adatbázist [16]: a sorszintű biztonság, a generált
oszlopok, a részleges egyedi indexek és az ütemezett feladatok mind
használhatók, és ezek a rendszer több pontján meghatározó szerepet kaptak. A
2.4. alfejezetben tárgyalt szolgáltatói kötődés kockázata ezzel mérsékelhető:
az adatbázis szabványos PostgreSQL, tehát az adatok és a séma átvihetők. A
csomagból emellett a hitelesítés a vezetői belépést kezeli, a fájltároló az
ellenőrző fényképeket, a valós idejű szolgáltatás pedig az adatbázis
változásait továbbítja a vezetői felületnek.

A szerveroldali függvények Deno futtatókörnyezetben futnak. Ezekbe került az
üzleti logika azon része, amelyet a kliensre bízni nem lehet: a beléptetés
érvényesítése, a felhasználók létrehozása, a hiányzás-kérelmek feldolgozása és
a nyelvi modell hívása — utóbbinál az API-kulcs így soha nem kerül a
böngészőbe. Az ütemezett feladatokat a `pg_cron` bővítmény végzi az adatbázison
belül, tehát nincs újabb üzemeltetendő komponens, és a feladat ugyanabban a
tranzakciós környezetben fut, mint az adat, amelyen dolgozik. A
hálózatfüggetlen működéshez a böngésző IndexedDB tárolója szolgál a Dexie
könyvtár közvetítésével, az alkalmazás hálózat nélküli indulását pedig
*service worker* biztosítja.

Az eszközök kiforrottsága csökkenti a fejlesztési kockázatot, ára viszont, hogy
a rendszer viselkedése részben nem módosítható összetevőktől függ — ezt a
3.1.2. alfejezet elszigetelési követelménye tartja kezelhető szinten.

## Az adatmodell

Az adatbázis öt tábla köré szerveződik. A logikai séma a 2. ábrán látható.

![Az adatbázis logikai sémája](adatbazis-feher.png)

A `companies` tábla a rendszert használó cégeket tartja nyilván. Ez a tábla
a több bérlős működés kiindulópontja: minden további tábla ide hivatkozik
vissza. A cégnév és az URL-ben használható rövid azonosító mellett a
munkaidő-szabályok is itt kaptak helyet — a munkanap kezdete, a késésnek
számító küszöb, az automatikus kiléptetés órája, valamint a fényképes
ellenőrzés két kapcsolója. Ezek azért a cég sorában szerepelnek, és nem
alkalmazásszintű beállításként, mert cégenként eltérhetnek, és a beléptetés
kiértékelésekor a szervernek amúgy is be kell töltenie a cég sorát.

A `profiles` tábla a személyeket írja le, szerepkörtől függetlenül: a
dolgozókat, a vezetőket, az adminisztrátorokat és az alkalmi látogatókat is. A
szerepkört külön mező hordozza, megszorítással korlátozva a megengedett
értékekre. A név két összetevőben tárolódik — vezetéknév és keresztnév —,
mert a rendezés, a megszólítás és az adatkarbantartás mind a két rész
ismeretét igényli. A teljes név generált oszlopként áll elő a kettőből,
tehát származtatott érték, amely soha nem térhet el az összetevőitől; a nevet
olvasó korábbi lekérdezések így változtatás nélkül működnek tovább.

A táblában szerepel az NFC-kártya azonosítója, a tartalék belépéshez használt
PIN, a telefonszám és az elektronikus levélcím, továbbá az opcionális műszak
vagy részleg megjelölése. Az alkalmi látogatóknál lejárati időpont is tartozik
a bejegyzéshez, amely után a kártya érvénytelen.

Két egyediségi megkötés érdemel figyelmet. A kártyaazonosító cégen belül
egyedi, nem globálisan: két különböző cég használhat azonos azonosítójú
kártyát, hiszen egymás rendszeréhez nincs közük. A PIN esetében az egyediséget
*részleges* index biztosítja, amely csak a kitöltött értékekre vonatkozik —
enélkül a PIN nélküli dolgozók ütköznének egymással, mivel valamennyiüknél
üres az érték.

Az `events` tábla a jelenléti eseményeket tárolja: minden sor egy belépés
vagy egy kilépés, időbélyeggel. Külön mező jelzi, hogy a bejegyzés vezetői kézi
javítás eredménye-e, és megjegyzés is fűzhető hozzá — így az automatikus
kiléptetés vagy az utólagos korrekció megkülönböztethető a valódi
kártyaérintéstől. A fényképes ellenőrzés képének elérési útja szintén itt
szerepel.

A tábla legfontosabb sajátossága a `client_event_id` mező, amelyet nem a
szerver, hanem a kliens állít elő. A rá épített részleges egyedi index zárja
ki, hogy egy megismételt küldés kettőzött bejegyzést hozzon létre — a
részlegesség pedig azért kell, mert a hálózaton keresztüli, közvetlen
beléptetésnél ez az azonosító üresen marad, és az üres értékek egyébként
ütköznének egymással. A mögötte álló megfontolást a 3.4.4. alfejezet
tárgyalja.

Az `absences` tábla a hiányzásokat tartja nyilván, naponként egy sorban.
Ez a döntés magyarázatot igényel, hiszen kézenfekvőbbnek tűnne a kezdő és a
záró dátum tárolása egyetlen sorban. A napokra bontás mellett két érv szólt.
Egyrészt a naptárnézet, a havi összesítő és a kimutatások mind napi bontásban
dolgoznak, tehát az időszakot úgyis fel kellene bontaniuk. Másrészt így az
átfedések kizárása egyetlen egyediségi megkötéssel megoldható — egy dolgozóhoz
egy napon legfeljebb egy hiányzás tartozhat —, míg időszakokkal ez lényegesen
összetettebb ellenőrzést kívánna. A megoldás ára, hogy az egybefüggő időszakot
megjelenítéskor össze kell vonni; ezt a felület végzi.

A tábla hordozza a kérelem állapotát is: a dolgozó által beküldött hiányzás
elbírálásra vár, a vezető által rögzített azonnal érvényes. Az elutasítás
indoklása szintén itt tárolódik, mivel az a döntéshez tartozik.

A `notifications` tábla a dolgozónak szóló értesítéseket őrzi. A megjelenítés
adatai JSON szerkezetben szerepelnek, mert a szöveg megfogalmazása — és annak
nyelve — a felület dolga, míg az adatbázisban a tény tárolódik. Az olvasottság
időbélyegként jelenik meg, nem logikai értékként, így az is megállapítható,
mikor jutott az értesítés a címzetthez.

Valamennyi táblában szerepel a cégazonosító, akkor is, ha az elvben
levezethető volna a kapcsolódó sorokból. A látszólagos redundancia szándékos: a
következő alfejezetben tárgyalt biztonsági szabályok így egyetlen mező
vizsgálatával kiértékelhetők, kapcsolás nélkül.

### A több bérlős (multi-tenant) felépítés

A 2.4. alfejezetben ismertetett három minta közül a közös táblás megoldás
került alkalmazásra, amelyben a sorokat bérlőazonosító különbözteti meg. Ez a
leggazdaságosabb változat, ugyanakkor a legnagyobb figyelmet igénylő is:
egyetlen hiányzó szűrőfeltétel elegendő ahhoz, hogy az egyik cég adata a másik
számára láthatóvá váljon.

Éppen ezért az elkülönítés nem az alkalmazás kódjára van bízva. A védelem a
PostgreSQL sorszintű biztonságára épül, amely a szűrést az adatbázisban
kényszeríti ki. A szabály akkor is érvényesül, ha a lekérdezésből véletlenül
kimarad a feltétel — a hiba tehát nem eredményez adatszivárgást, hanem üres
találati halmazt.

Az alábbi szabály a jelenléti események olvasását engedélyezi:

```
create policy "events: read own company"
  on events for select to authenticated
  using (company_id = auth_company_id());
```

A szabály lelke az `auth_company_id()` segédfüggvény, amely a bejelentkezett
felhasználó munkamenetéből indulva megkeresi a hozzá tartozó profilt, és
visszaadja annak cégazonosítóját. A függvény azért kapott *definer* jogosultsági
módot, mert magának a profilnak az olvasásához is szabályt kellene
kiértékelnie, ami körkörös hivatkozáshoz vezetne.

Ugyanezen a mintán további két segédfüggvény áll rendelkezésre a felhasználó
profilazonosítójára és szerepkörére. Ezekkel a szabályok az egyszerű cégszintű
elkülönítésnél árnyaltabb feltételeket is megfogalmazhatnak: a hiányzások
módosítása például vezetői szerepkörhöz kötött, míg olvasni a saját cég
valamennyi bejegyzését lehet.

Kiemelendő, hogy a beléptető és a dolgozói alkalmazás nem ezen az úton fér az
adatokhoz. Ezek az alkalmazások nem rendelkeznek bejelentkezett
munkamenettel — a dolgozóknak nincs belépési fiókjuk —, ezért kéréseiket
szerveroldali függvények szolgálják ki, amelyek megemelt jogosultsággal futnak,
és a sorszintű szabályokat megkerülik. Az elkülönítés itt tehát a függvény
kódjában valósul meg: a cég azonosítója minden esetben a kártyához vagy a
PIN-hez tartozó profilból származik, sosem a kérés törzséből. Ez a
megkülönböztetés lényeges: a sorszintű biztonság a bejelentkező vezetőket
védi a saját hibáiktól, a szerveroldali függvények kapuőr szerepe pedig a
bejelentkezés nélküli alkalmazásokat.

### A profilok és a hitelesítés szétválasztása

Az adatmodell egyik meghatározó döntése, hogy a személyeket leíró tábla
elsődleges kulcsa független a hitelesítési rendszer felhasználó-azonosítójától.
Ez a döntés nem a tervezőasztalon született, hanem a fejlesztés közben, egy
hibából kiindulva.

Az eredeti séma a profil azonosítóját közvetlenül a hitelesítési rendszer
felhasználójához kötötte, ahogyan azt a szolgáltatás mintapéldái is javasolják.
A megoldás a vezetőknél működött, a dolgozók felvételénél viszont hibára
futott: minden új dolgozóhoz belépési fiókot kellett volna létrehozni, enélkül
ugyanis a profil azonosítója hivatkozási megkötést sértett.

A hiba mögött fogalmi ellentmondás állt. A rendszerben ugyanis a dolgozónak
nincs és nem is lehet belépési fiókja: az azonosítást a kártya végzi, nem
felhasználónév és jelszó. Egy fiók létrehozása elektronikus levélcímet
igényelne, ami fizikai munkakörökben gyakran nem áll rendelkezésre, és
felesleges személyes adatot is kezelne.

A megoldás a két fogalom szétválasztása lett. A profil önálló, saját azonosítót
kap, és egy kitölthető, de nem kötelező mező köti — ha van ilyen — a
hitelesítési rendszer felhasználójához. Ezt a mezőt kizárólag a vezetők és az
adminisztrátorok sora tölti ki; a dolgozóknál és a látogatóknál üresen marad.
Ennek következménye, hogy a jogosultsági szabályok nem közvetlenül a munkamenet
azonosítójával dolgoznak, hanem azon keresztül keresik meg a profilt. A
kerülőút ára egy további lekérdezés, haszna viszont az, hogy a személy és a
belépési mód egymástól függetlenül kezelhető: egy dolgozó később vezetővé
léptethető pusztán azzal, hogy a profilja fiókhoz kapcsolódik, és a hozzá
tartozó jelenléti előzmény érintetlen marad.

Az eset tanulsága, hogy a dokumentációban szereplő minta hallgatólagos
előfeltevéssel élt: azzal, hogy minden nyilvántartott személy egyben
bejelentkező felhasználó is. Ez a jelen rendszerben nem teljesül, mivel a
nyilvántartott személyek többsége soha nem jelentkezik be — a mintát ezért nem
átvenni, hanem az eltérő előfeltevéshez igazítani kellett.

A fiókkal rendelkező kisebbségre egy további megkötés vonatkozik: a jelszó
kizárólag a fiók címére küldött, egyszer felhasználható hivatkozáson át
cserélhető. A művelethez így a postafiókhoz való hozzáférés is szükséges, ami
egy őrizetlenül hagyott, bejelentkezett gép esetén érdemi különbség.

## A beléptető alkalmazás

A beléptető alkalmazás az egyetlen felület, amelyen jelenléti esemény
keletkezhet. Működése ugyanakkor a legszűkebb: egyetlen képernyőt
jelenít meg, felhasználói bejelentkezést nem ismer, és kezelése kimerül a
kártya odaérintésében. Ez az alfejezet a megvalósítás hat meghatározó
kérdéskörét tárgyalja.

### Az NFC-kártya olvasása

A kártya kiolvasását a 2.2. alfejezetben ismertetett Web NFC felület végzi. Az
olvasás engedélyhez kötött: a böngésző a művelet megkezdésekor megerősítést kér
a felhasználótól, és az engedély csak felhasználói művelet — jelen esetben
gombnyomás — hatására kérhető. Ez indokolja, hogy az alkalmazás nem
automatikusan, hanem kifejezett indítás után kezd olvasni.

Az engedély megadását követően az olvasó folyamatosan figyel, és minden
érzékelt kártyáról értesítést ad. Az értesítés a rendszer szempontjából
egyetlen lényeges adatot tartalmaz: a kártya sorozatszámát, amely az
azonosításra szolgáló egyedi érték.

A sorozatszám feldolgozásánál egy egyszerűnek látszó, mégis lényeges részlet
igényel figyelmet. Ugyanaz a kártya különböző eszközökön, illetve különböző
felületeken eltérő írásmóddal jelenhet meg: kisbetűvel vagy nagybetűvel, a
bájtok között elválasztójellel vagy anélkül. Amennyiben a nyilvántartásba az
egyik alak kerül be, a beléptetéskor pedig a másik érkezik, az összehasonlítás
sikertelen lesz, és a rendszer ismeretlen kártyaként utasítja el az érvényes
azonosítót.

A megoldás az azonosító egységesítése, amely nagybetűssé alakítja, és minden
nem alfanumerikus jelet eltávolít belőle. Az eljárás lényege nem maga a művelet,
hanem az, hogy minden érintett ponton azonos módon kell megtörténnie: a
beléptető alkalmazásban, a szerveroldali függvényben és a vezetői felület
adatrögzítésénél egyaránt. Ha bármelyik eltérne, a hiba csak bizonyos
kártyáknál jelentkezne, ami a hibakeresést jelentősen megnehezítené.

A visszamenőleges működés érdekében a szerver az egységesített alak mellett a
kettesével tagolt írásmódot is elfogadja, mivel a korábban, kézzel rögzített
azonosítók ebben a formában kerültek az adatbázisba.

### A be- és kiléptetés logikája

A követelmények szerint a dolgozónak nem kell megadnia, hogy érkezik vagy
távozik: a rendszernek ezt magának kell megállapítania. A megvalósítás ennek
megfelelően váltakozó logikát követ, amely a személy legutolsó eseményét
veszi alapul. Amennyiben az belépés volt, a következő esemény kilépés lesz, és
fordítva; ha egyáltalán nincs korábbi esemény, a művelet belépésként
értelmeződik.

A megoldás előnye, hogy a dolgozó számára nem igényel döntést, és így nem is
téveszthető el. Ára az, hogy a helyes működés a korábbi események
teljességétől függ: egy elmulasztott kilépés a következő napi belépést
fordítja ellenkezőjére. Éppen ezért szükséges a 3.7.1. alfejezetben tárgyalt
automatikus kiléptetés, amely a nyitva maradt napokat lezárja, és ezzel a
váltakozó logika kiindulóállapotát helyreállítja.

A második lényeges kérdés az ismételt érintés kezelése. A dolgozó
bizonytalanság esetén — például mert nem vette észre a visszajelzést —
másodszor is odaérinti a kártyát, ami két egymást követő eseményt hozna létre,
és a ledolgozott idő számítását elrontaná. A rendszer ezért öt másodperces
ablakon belül nem rögzít újabb, azonos irányú eseményt, hanem hibával utasítja
el a kérést.

Az öt másodperc arányossági kompromisszum eredménye. Rövidebb ablak nem
zárná ki megbízhatóan a téves ismétlést, hosszabb viszont akadályozná azt a
valós helyzetet, amikor a dolgozó néhány perc múlva ténylegesen távozik.

```
const { data: recent } = await supabase
  .from('events')
  .select('id')
  .eq('user_id', profile.id)
  .eq('type', eventType)
  .gte('timestamp', new Date(Date.now() - 30_000).toISOString())
  .maybeSingle()

if (recent) return json({ error: 'Duplicate event', code: 'DUPLICATE' }, 409)
```

A szűrés a szerveren fut, nem a kliensben. Egy cég több terminált is
üzemeltethet, és két különböző eszközön leadott érintést csak a közös
háttérrendszer lát egyszerre. A feltétel az esemény irányára is szűr: a
belépés utáni másodperceken belüli kilépés így nem akad fenn rajta, hiszen az
nem téves ismétlés, hanem szándékos művelet.

A visszajelzés kialakítását a használat körülményei határozták meg. A
képernyő teljes felülete színt vált — belépésnél zöldre, kilépésnél pirosra —,
és nagy betűmérettel írja ki a nevet és a művelet irányát, ahogy azt a 3. ábra
mutatja. A készülék falra szerelve, szemmagasság fölött vagy alatt helyezkedik
el, a visszajelzést tehát több méter távolságból, futó pillantással is
értelmezni kell tudni. Az információt nem kizárólag a szín hordozza: a szöveg
önmagában is egyértelmű, ami színtévesztés mellett is olvashatóvá teszi. Három
másodperc után a képernyő magától visszaáll olvasásra kész állapotba, így a
következő dolgozónak nincs teendője.

![A beléptető alkalmazás alapállapota, valamint a belépés és a kilépés visszajelzése](scanner-visszajelzes.jpg)

### Fényképes ellenőrzés

A 2.3. alfejezetben tárgyalt visszaélési lehetőség — a kártya átadása egy
kollégának — ellen a rendszer a belépés pillanatában készített fényképfelvétellel
védekezik. Fontos pontosan rögzíteni, hogy ez nem arcfelismerés: a rendszer
nem tárol biometrikus mintát, és nem hasonlítja össze a felvételt korábbi
képekkel. A megoldás nem megakadályozza, hanem utólag ellenőrizhetővé, és ezzel
kockázatossá teszi a visszaélést.

A megkülönböztetés adatvédelmi szempontból meghatározó: a 2.1. alfejezetben
tárgyalt biometrikus sablon különleges kategóriájú adat, míg a zárt tárolóban,
korlátozott hozzáféréssel őrzött fényképfelvétel lényegesen kisebb terheléssel
jár — az elrettentő hatás mellett.

A funkció cégenként, a kártyás és a PIN-alapú belépésre külön-külön
kapcsolható. Ennek indoka az azonosítási módok eltérő természete: a kártya
birtoklást igazol, a PIN viszont tudást, amely szóban is átadható, tehát
könnyebben vezet visszaéléshez.

A megvalósítás legérdekesebb része a folyamat kétlépéses felépítése. Az
azonnali, a kártyaolvasással egyidejű fényképezés felesleges felvételeket
eredményezne: az alkalmazás a kérés elküldése előtt nem tudja, hogy az adott
céghez tartozik-e fényképkötelezettség, sőt azt sem, hogy a kártya egyáltalán
érvényes-e. Az első kérés ezért csak az azonosítót küldi el; a szerver
ellenőrzi a kártyát, megállapítja a művelet irányát, majd — ha a cég beállítása
ezt megkívánja — nem hoz létre eseményt, hanem jelzi, hogy fényképre van
szükség. Az alkalmazás ekkor kapcsolja be a kamerát, és a felvétellel együtt
küldi el a második kérést, amely nyomán az esemény ténylegesen létrejön. A
folyamatot a 4. ábra szemlélteti.

![A fényképes ellenőrzés kétlépéses folyamata](fenykep-folyamat.png)

A felépítés lényeges következménye, hogy félbehagyott bejegyzés nem
keletkezhet. Ha a dolgozó a fényképezést megszakítja, vagy a kamera használatát
megtagadja, a rendszerben nem marad fénykép nélküli, mégis rögzített esemény. A
duplikáció-szűrés szintén csak a második kérésben fut le, tehát az előkészítő
kérés nem használja el az öt másodperces ablakot.

A képek nyilvánosan nem elérhető tárolóba kerülnek, cégenként és személyenként
elkülönített útvonalon. A vezetői felület a megjelenítéshez időkorlátos, aláírt
hivatkozást kér, amely rövid idő elteltével érvényét veszti. Így a felvétel a
tároló címének ismeretében sem érhető el illetéktelenül.

### Hálózatfüggetlen működés

A nem funkcionális követelmények között megfogalmazott elvárás szerint a
beléptetésnek hálózati kapcsolat nélkül is működnie kell. Ez a rendszer
műszakilag legösszetettebb része, mivel négy egymástól független kérdést vet
fel, és mindegyikre külön válasz szükséges.

**Az első kérdés a kártya felismerése.** Kapcsolat nélkül a szerver nem
kérdezhető meg arról, hogy az adott azonosító melyik dolgozóhoz tartozik. A
megoldás egy helyben tárolt névjegyzék, amelyet az alkalmazás kapcsolat
esetén rendszeresen frissít, és amely a kártyaazonosítókat a hozzájuk tartozó
névvel és szerepkörrel párosítja. Lényeges, hogy a névjegyzék kizárólag a
megjelenítéshez szükséges adatokat tartalmazza — nevet és szerepkört —, tehát
az eszköz elvesztése esetén sem kerül ki belőle jelenléti előzmény vagy
elérhetőség.

**A második kérdés a művelet irányának meghatározása.** A váltakozó logikához a
személy legutolsó eseményének ismerete szükséges, ez viszont a szerveren
tárolódik. Az alkalmazás ezért kártyánként nyilvántartja a legutóbb ismert
irányt is. A nyilvántartás a névjegyzék frissítésekor a szerver adataiból áll
elő, majd a rendszer ráolvassa a még el nem küldött, helyben rögzített
eseményeket. Erre azért van szükség, mert a szerver azokról még nem tud: nélküle
egy offline belépés után a következő érintés ismét belépésként értelmeződne.

**A harmadik kérdés a rögzített események megőrzése.** A kapcsolat hiányában
keletkező eseményeket az alkalmazás a böngésző beágyazott adatbázisában, sorban
tárolja. A tétel a művelet iránya mellett a rögzítés tényleges időpontját
viszi magával, nem a későbbi továbbításét. Ha az időbélyeget a szerver adná,
egy több órás kimaradás után minden esemény a helyreállás időpontjára esne, és
a ledolgozott idő használhatatlan lenne.

**A negyedik kérdés a visszajátszás helyessége.** A kapcsolat helyreállásakor az
alkalmazás a sor tételeit egyenként küldi el, és itt jelentkezik a 2.4.
alfejezetben tárgyalt hibalehetőség: a válasz elveszhet azután, hogy a szerver a
kérést már feldolgozta, az újraküldés pedig ugyanazt az eseményt másodszor is
rögzítené.

A megoldás az idempotens művelet. A tétel a sorba kerüléskor egyedi
azonosítót kap (`client_event_id`), amelyre az adatbázisban egyedi index épül,
így a második beszúrás megkötéssértéssel elbukik — a szerver pedig ezt nem
hibaként kezeli, hanem sikeres választ ad. A helyes végállapot tehát nem az
üzenetküldés megbízhatóságán múlik, hanem azon, hogy az ismétlés következmény
nélkül maradjon.

A visszajátszás sorrendtartó, és a hibákat kétfelé osztja. Végleges hibánál
— például ha a kártyát időközben törölték — a tétel kikerül a sorból. Átmeneti
hibánál a tétel marad, és a feldolgozás megszakad: a hibás tétel átugrása
felborítaná az események sorrendjét, és a váltakozó irány hibás állapotba
kerülne. A négy kérdésre adott választ az 5. ábra foglalja össze.

![A hálózatfüggetlen működés négy kérdése és megoldásuk](offline-mukodes.png)

#### Az alkalmazás indulása hálózat nélkül

A fenti megoldások mindegyike azt feltételezi, hogy az alkalmazás fut. Ez
azonban nem magától értetődő: ha az eszköz újraindul vagy az oldal frissítésre
kerül, a böngészőnek a hálózatról kellene betöltenie az alkalmazást, ami
kapcsolat nélkül nem lehetséges.

A megoldást a 2.4. alfejezetben ismertetett *service worker* adja, amely a
kimenő kéréseket elfogja, és eldönti, hogy azokat a hálózatról vagy a helyi
gyorsítótárból szolgálja ki. Az alkalmazás váza így telepítéskor a
gyorsítótárba kerül, és onnan hálózat nélkül is betölthető.

Itt egy nem nyilvánvaló akadály merült fel: az építőeszköz a kimeneti fájlok
nevébe tartalomfüggő azonosítót illeszt, hogy a böngésző a frissítést biztosan
észrevegye, ezért a fájlnevek minden építéskor megváltoznak, és előre, név
szerint nem sorolhatók fel a gyorsítótárazandó elemek között.

A megoldás kétrétegű. Az állandó nevű belépési pont telepítéskor kerül a
gyorsítótárba, a változó nevű állományok pedig használat közben, az első
betöltésükkor — olyan eljárással, amely a tárolt példányt azonnal kiszolgálja,
de a hálózati választ a háttérben lekéri, és azzal frissíti. Így az alkalmazás
egyszerre indul gyorsan és marad naprakész.

A megközelítés helyessége nem volt magától értetődő: a korábbi változat
telepítéskor semmit sem tárolt, ezért a hálózat nélküli újratöltés üres
képernyőt eredményezett — a hiba tárgyalása a 3.8. alfejezetben folytatódik.

### PIN-alapú tartalék belépés

A kártyaalapú azonosítás gyakorlati gyengesége, hogy a kártya otthon
felejthető. Ilyenkor a dolgozó nem tudja rögzíteni az érkezését, a hiányzó
bejegyzést pedig utólag a vezetőnek kell pótolnia. Ez nemcsak többletmunka:
a pótolt időpont már nem mérés, hanem emlékezet. A rendszer ezért tartalék
azonosítási módot kínál, amelyben a dolgozó a beléptető eszköz
számbillentyűzetén megadott PIN-kóddal jelzi a jelenlétét.

A megoldás egyetlen felhasználói döntést enged meg: a PIN beírását. Névsor nem
jelenik meg, és ennek nem kényelmi oka van. A készülék nyilvános helyen, falra
szerelve üzemel, tehát a teljes névsor kiírása minden arra járó számára
megmutatná a cég alkalmazottait — ez adatvédelmi szempontból indokolatlan, a
lista pedig nagyobb létszámnál használhatatlanul hosszúvá válna.

Ebből azonban egy nem nyilvánvaló műszaki következmény adódik. Mivel a szerver
kizárólag magát a PIN-t kapja meg, a hozzá tartozó személyt a tárolt érték
alapján kell megtalálnia. A jelszavaknál bevett eljárás — véletlenszerű sóval
képzett, egyirányú lenyomat — erre nem alkalmas, mert ugyanahhoz a bemenethez
minden bejegyzésnél más tárolt értéket rendel, így a keresés csak minden egyes
bejegyzés külön megvizsgálásával volna elvégezhető.

A megvalósítás ezért determinisztikus, a cég azonosítójával sózott SHA-256
lenyomatot tárol. Ugyanaz a PIN ugyanabban a cégben mindig azonos értéket ad,
tehát a keresés egyetlen indexelt lekérdezéssel elvégezhető. A nyers PIN sehol
nem tárolódik, és mivel a só a cégazonosító, két különböző cégben megadott
azonos PIN eltérő értékre képződik le.

```
async function hashPin(companyId, pin) {
  const data = new TextEncoder().encode(`${companyId}:${pin}`)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
```

Ez a néhány sor három helyen fut: a beléptető függvényben, a dolgozói adatokat
kiszolgáló függvényben és a vezetői felületen, ahol a PIN beállítása történik.
Betű szerint azonosnak kell lenniük — a bemenet összefűzésétől a hexadecimális
alak kisbetűs írásmódjáig —, mert bármelyik eltérése esetén a beállított PIN
nem találna profilt, a hiba pedig nem a beállításkor, hanem csak a
beléptetéskor jelentkezne.

A választás kompromisszumát indokolt nyíltan kimondani. Négy–hat számjegyű
PIN-ből összesen alig több mint egymillió különböző létezik, tehát az adatbázis
kikerülése esetén a tárolt értékek kimerítő próbálgatással visszafejthetők; a
sózás ezt a munkát cégenként külön elvégzendővé teszi, de nem teszi
lehetetlenné. A PIN ezért nem tekinthető jelszóval egyenértékű védelemnek, és a
rendszer nem is használja annak: önmagában nem ad hozzáférést a vezetői
felülethez.

A fennmaradó kockázatot két megkötés mérsékli. Az egyik az adatmodellben
tárgyalt egyediség: egy cégen belül két dolgozónak nem lehet azonos PIN-je,
különben a beütött kód több személyhez vezetne, és a rendszer nem tudná
eldönteni, kinek az érkezését rögzítse. A másik a 3.4.3. alfejezetben
előírható fényképkötelezettség.

### A kártya párosítása

A kártyaazonosító nyilvántartásba vétele eredetileg kizárólag a vezető
feladata volt. Ez a megoldás némán hibázik: egyetlen elgépelt karakter
esetén a kártya működik, csak éppen rossz személyhez rendelve, és a hiba addig
rejtve marad, amíg valaki össze nem veti a naplót a valósággal.

A rendszer ezért felajánlja a párosítást. Ha a PIN-nel belépő dolgozóhoz még
nem tartozik kártya, a beléptető a sikeres belépés után felszólítja, hogy
érintse oda; az azonosító így nem gépelésből, hanem magából a kártyából
származik. A felajánlás szándékosan a belépés után jelenik meg, tehát a
jelenlét rögzítése nem függ attól, hogy a dolgozó végigviszi-e a műveletet.

Ez az egyetlen adatmódosítás, amelyre a PIN jogosít, és szűkre szabott: üres
mezőt tölthet ki, meglévőt nem írhat felül, és a cégen belül már használt
azonosítót nem vehet át. Egy kiszivárgott PIN tehát nem alkalmas a kolléga
kártyájának elvételére; legrosszabb esetben kártya nélküli profilhoz rendel
egyet — ezt a párosítás időbélyege megőrzi, az érintett pedig azonnal észleli,
hiszen ő maga már nem tud párosítani. A lehetőség cégenként kikapcsolható.

## A dolgozói alkalmazás

A dolgozói alkalmazás célja, hogy a munkavállaló a saját jelenléti adatait a
vezető megkérdezése nélkül megtekinthesse, és a tervezett távollétét
bejelenthesse. A felület kizárólag a bejelentkezett személy adatait mutatja, és
mobiltelefonon történő használatra készült.

### Az azonosítás kérdése

Az eredeti elképzelés szerint a dolgozó a saját telefonját érintette volna a
beléptető eszközhöz, amely így elektronikus belépőkártyaként működött volna.
A megoldás vonzereje kézenfekvő: a telefon a kártyánál lényegesen ritkábban
marad otthon.

A tervezés korai szakaszában azonban kiderült, hogy ez webes technológiával nem
valósítható meg. A 2.2. alfejezetben ismertetett Web NFC felület kizárólag
olvasásra és írásra képes; ahhoz, hogy a készülék maga viselkedjen kártyaként,
kártyaemulációra volna szükség, amely az operációs rendszer szintjén elérhető
szolgáltatás, böngészőből viszont nem hívható [6]. A képesség tehát nem a
megvalósítás minőségén, hanem a platform határain múlik.

A korlát felismerése a dolgozói alkalmazás szerepének újrafogalmazásához
vezetett: az alkalmazás nem beléptető eszköz, hanem önkiszolgáló felület.

Ebből következett az azonosítás módjának megváltoztatása is. A korábbi változat
a kártya odaérintésével azonosított, ami két problémát hordozott. Egyrészt a
dolgozó csak akkor férhetett hozzá a saját adataihoz, ha a kártya nála volt —
holott a felület éppen otthonról, a kártya nélkül a leghasznosabb. Másrészt
fogalmi zavart keltett, hogy ugyanaz a mozdulat a két alkalmazásban mást
jelentett: az egyikben munkaidőt rögzített, a másikban csak megjelenítette azt.

A megvalósított azonosítás ezért a 3.4.5. alfejezetben bemutatott PIN-re épül.
Lényeges megkülönböztetés, hogy a dolgozói alkalmazásban megadott PIN nem
hoz létre jelenléti eseményt. A felületre való belépés és a munkaidő rögzítése
két különböző művelet, és a rendszer ezeket nem vonja össze — ellenkező esetben
a dolgozó otthonról is rögzíthetné az érkezését.

### A felület felépítése

A felület három nézetre tagolódik: a mai nap, a napló és a hiányzások (6. ábra).
Váltani a fejléc választójával vagy oldalirányú húzással lehet; az utóbbi
mobilon megszokott, és egy kézzel is kényelmes.

![A dolgozói alkalmazás mai és napló nézete](worker-app.jpg){90%}

A mai nap a belépés és a kilépés időpontját, valamint az eddig ledolgozott időt
mutatja. A napló visszatekintő: hét vagy hónap bontásban sorolja a
napokat és az óraszámokat. A két időtáv eltérő kérdésre válaszol, ezért
egyetlen rögzített időszak az egyiket mindig használhatatlanná tenné. A
szerver mindkét nézethez egyszerre küldi a harmincegy napnyi eseményt, így a
váltás nem igényel újabb kérést.

A napi óraszám számítása annyiban nem magától értetődő, hogy egy naphoz több
be- és kilépés is tartozhat: az ebédszünetre távozó dolgozó négy eseményt hoz
létre. A `groupByDay` az eseményeket sorrendben párba állítja, és a párok
hosszát összegzi, tehát a napközbeni távollét kimarad. A nyitva maradt utolsó
belépés a jelen pillanatig tart — enélkül a még bent lévő dolgozó nullát látna.

A felület személyes adatot mutat olyan eszközön, amely könnyen kikerül a
tulajdonosa látóteréből, ezért kétperces tétlenség után magától kilép. A
visszaszámlálás minden érintésre újraindul, így a használatot nem zavarja.

### A távollét-kérelem életciklusa

A rendszer korábbi változatában a dolgozó által beküldött hiányzás azonnal
rögzített ténnyé vált. Ez a működés a valós folyamattal ellentétes: a szabadság
kiadása engedélyhez kötött, tehát a bejelentés kérelem, amelyről a vezetőnek
döntenie kell.

A megvalósított életciklus ennek megfelelően három állapotot ismer. A beküldött
kérelem függő állapotba kerül, majd a vezető döntése nyomán jóváhagyottá vagy
elutasítottá válik; elutasítás esetén indoklás is fűzhető hozzá. A kérelmet a
dolgozó az elbírálásig visszavonhatja.

A visszavonás korlátozása nem a felület elrejtésével valósul meg. A
szerveroldali művelet csak akkor hajtódik végre, ha az érintett bejegyzés
állapota függő, és a kérelmező a saját sorát vonja vissza. A gomb elrejtése
a felületen csupán kényelmi kiegészítés; a szabály betartatása nem bízható a
kliensre, mert a kérés a felület megkerülésével is összeállítható.

Hasonló megfontolásból történik a szerveren a megadott időszak napokra bontása
is. A dolgozó kezdő és záró dátumot ad meg, és jelezheti, hogy a hétvégék
kimaradjanak-e; a napok listáját azonban a szerver állítja elő. Ha a bontást a
kliens végezné, minden felület — a dolgozói alkalmazás és a vezetői felület —
külön valósítaná meg ugyanazt a szabályt, és a két megvalósítás előbb-utóbb
eltérne egymástól.

A részben átfedő időszakok kezelése külön figyelmet igényelt. Ha a dolgozó
olyan tartományt küld be, amelynek egyes napjaira már van rögzített hiányzás, a
művelet nem hiúsul meg: a rendszer a már meglévő napokat kihagyja, a többit
pedig rögzíti. A teljes elutasítás formailag védhető volna, a gyakorlatban
azonban a dolgozót arra kényszerítené, hogy maga derítse ki, melyik nap
ütközik. A kérelem hossza felső korlátot kap, ami a hibás vagy szándékosan
eltúlzott tartomány ellen véd.

### Értesítések

A döntésről a kérelmezőnek tudomást kell szereznie. Enélkül a folyamat felemás
marad: a vezető dönt, a dolgozó viszont csak akkor értesül róla, ha magától
megnyitja a megfelelő nézetet. Az értesítés ezért tárolt bejegyzés, nem múló
üzenet: visszamenőleg is megtekinthető, és a rendszer külön jelöli, mi az, ami
még olvasatlan.

A megvalósítás lényeges eleme, hogy az értesítést nem a vezetői felület hozza
létre, hanem adatbázis-esemény. Ha a felület felelne érte, akkor minden más
úton született döntés — közvetlen adatbázis-művelet, tömeges jóváhagyás vagy
egy későbbi felület — értesítés nélkül maradna. Az adatbázisban elhelyezett
szabály ezzel szemben minden útvonalra egyaránt érvényes [11].

Az eseménykezelő megvalósítása egy további kérdést vetett fel. Egy kéthetes
szabadság tíz napi bejegyzést jelent, amelyekről a vezető egyetlen művelettel
dönt, a soronként lefutó eseménykezelő pedig ilyenkor tíz különálló értesítést
hozna létre ugyanarról a döntésről. A megoldás az utasítás szintű
eseménykezelő, amely a PostgreSQL átmeneti tábláin keresztül a teljes
módosításhalmazt egyszerre látja:

```
create trigger absences_notify_decision
  after update on absences
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function notify_absence_decision();
```

A `new_rows` így a döntéssel érintett összes napot tartalmazza, amelyből egy
csoportosítás állítja elő az összevont értesítést — a kezdő és a záró nappal,
valamint a napok számával. A csoportosítás kulcsa a dolgozó, a döntés iránya és
az indoklás együtt, mert két különböző kérelemről ugyanabban a másodpercben is
születhet döntés, és azokról külön értesítésnek kell szólnia.

Az értesítés nem kész szöveget, hanem strukturált adatot tárol, mert a
megfogalmazás a felület feladata: a nyelv és a megjelenítés formája ott
változhat, a tárolt tény viszont változatlan marad.

A megjelenítés a fejléc harang ikonjával történik, amely olvasatlan értesítés
esetén jelölést és darabszámot kap. A lista a teljes képernyőt elfoglalja, nem
lebegő panelben nyílik meg (7. ábra): mobilon a lebegő panel a tartalom jelentős
részét eltakarná, a mögötte lévő felület pedig véletlen érintésre is reagálna.

![Az értesítések nézete egy elutasított kérelem indoklásával](worker-ertesitesek.jpg)

A panel megnyitása olvasottnak jelöli az addigi értesítéseket, a felületen
azonnal, a szerveren pedig egy háttérben induló kéréssel. Ha ez a kérés
elbukik, a bejegyzés a következő belépéskor újra olvasatlanként jön vissza. Ez
a biztonságos irány: egy fölöslegesen újra jelzett értesítés kellemetlen, egy
észrevétlenül elveszett viszont pont azt a célt hiúsítaná meg, amiért az egész
funkció készült.

## A vezetői felület

A vezetői felület a rendszer legösszetettebb alkalmazása: ez kezeli a
dolgozókat, a beállításokat és a kimutatásokat. Az alábbiakban négy olyan
része következik, amely önálló műszaki döntést igényelt.

### Valós idejű állapotkövetés

A követelmények szerint a telephelyen tartózkodók listájának a beléptetés
pillanatában frissülnie kell. A kézenfekvő megoldás, az időzített
újrakérdezés, rossz választásra kényszerít: a hosszú időköz késleltetést okoz,
a rövid fölösleges terhelést. Az aránytalanság szemléletes: egy tíz fős cégnél
naponta nagyságrendileg húsz jelenléti esemény keletkezik, percenkénti
lekérdezés mellett viszont több mint ezernégyszáz kérés futna, amelyek túlnyomó
többsége változatlan adatot adna vissza.

A megvalósítás ezért a Supabase valós idejű szolgáltatására épül, amely az
adatbázis írási naplóját figyeli, és a bekövetkezett változásokat állandó
kapcsolaton keresztül továbbítja a feliratkozott klienseknek [16]. A felület a
jelenléti események táblájának beszúrásaira iratkozik fel, így az értesítés
nem a kliens kérdezésére, hanem a tényleges adatváltozásra érkezik.

Egy tervezési döntés külön indoklást érdemel. Az értesítés megérkezésekor a
felület nem az érkezett sort illeszti be a helyben tárolt állapotba, hanem
újratölti a nézethez tartozó adatokat. A növekményes beillesztés gyorsabb
volna, ám meg kellene ismételnie mindazt a származtatást, amelyet a teljes
betöltés elvégez: a napi ledolgozott idő számítását, a késés megállapítását és
a bent tartózkodás eldöntését. Két, egymástól függetlenül karbantartott
számítás előbb-utóbb eltér egymástól, az ebből fakadó következetlenség pedig
nehezen vehető észre, mert csak bizonyos sorrendű események után jelentkezik. A
teljes újratöltés költsége ehhez képest elhanyagolható, mert a kiváltó esemény
ritka.

A feliratkozás a nézet megszűnésekor megszakad; enélkül minden lapváltás új
kapcsolatot hagyna hátra.

A nézet a névsort bent, kint és vendég csoportra bontva mutatja, műszak szerint
szűrhetően (8. ábra).

![A vezetői felület állapotnézete](statusz.png)

### A dolgozói adatlap

A dolgozók kezelése lista és adatlap párosaként valósul meg: bal oldalon a
kereshető és bent–kint szerint szűrhető névsor, jobb oldalon a kiválasztott
személy adatlapja, profil, naptár és hiányzások fülre osztva (9. ábra).
Telefonon a kettő nem fér el egymás mellett, ezért ott egyszerre csak az egyik
látszik.

![A vezetői felület dolgozói adatlapja](munkasok.png)

Az adatlap PIN-mezője nem a tárolt értéket mutatja: az a 3.4.5. alfejezetben
leírt módon lenyomatként tárolódik, amelyből az eredeti kód nem állítható
vissza. A vezető ezért csak új PIN-t adhat meg, vagy törölheti a meglévőt.

### Kimutatások és exportálás

A kimutatások két, egymást kiegészítő nézetből állnak: egy kiválasztott dolgozó
időszaki elemzéséből és a teljes létszámra vonatkozó havi összesítőből. Az
elemző nézet a 10. ábrán látható.

![A vezetői felület statisztikai nézete](statisztika-feher.png)

Az elemzés vizsgált időszaka hét nap, harminc nap vagy három hónap lehet. A
megjelenítés a hosszhoz igazodik: a rövidebb időszakok napi bontásban
jelennek meg, a háromhavi nézet viszont heti összevonásban, mivel kilencven
egymás melletti oszlop áttekinthetetlen volna. Az alapadat mindkét esetben napi
bontású; csupán az összegzés mértéke tér el.

A megjelenített mutatók a ledolgozott idő, a munkanapok és a jelenléti napok
száma, a késések száma, az átlagos érkezési időpont, valamint a hiányzások
igazolt és igazolatlan bontásban. Minden mutatóhoz megjelenik az előző, azonos
hosszúságú időszakhoz mért változás is: az abszolút szám önmagában nehezen
értelmezhető, mivel a százötven ledolgozott óra attól függően sok vagy kevés,
hogy mihez viszonyítjuk. A késés megállapítása a cég beállított munkakezdési
idejéhez és türelmi idejéhez viszonyítva történik, tehát a mutató cégenként
eltérő küszöbbel dolgozik.

Az adatok kivitele két formátumban lehetséges, mivel a vezetőnek gyakran nem a
felület a célja, hanem maga az adat, amelyet a bérszámfejtésben használ fel. Az
egyszerűbb a vesszővel tagolt szövegfájl, amelynek elejére a rendszer
bájtsorrend-jelet helyez — enélkül a táblázatkezelők az ékezetes tartalmat
hibás kódolással nyitják meg. A másik a táblázatkezelők natív állománya, amely
az értékek típusát is megőrzi.

Lényeges, hogy az exportált adat ugyanabból a számításból származik, mint a
képernyőn megjelenő. Külön exportlogika esetén a két érték eltérhetne, ami a
kimutatás hitelét ásná alá.

### Mesterséges intelligencia alapú összefoglaló

A kimutatás önmagában számokat közöl, azok értelmezése viszont gyakorlatot
igényel. Egy több mutatót tartalmazó táblázatból nem magától értetődő, mi az
érdemi információ, és mi az, ami az adott időszakban szokásosnak tekinthető. A
rendszer ezért lehetőséget ad arra, hogy a kiválasztott dolgozó adott időszaki
adatairól természetes nyelvű, néhány mondatos értékelés készüljön. A megoldás a
2.5. alfejezetben ismertetett nagy nyelvi modellek szövegalkotó képességére
épül [12].

A megvalósítás legfontosabb kérdése az volt, hogy mi kerüljön elküldésre. A
rendszer kizárólag aggregált számokat továbbít: a ledolgozott perceket, a
munkanapok és jelenléti napok számát, a késések számát, az átlagos érkezést, a
szünetek számát és hosszát, a hiányzások igazolt és igazolatlan bontását,
valamint az előző időszakhoz mért változást. Nevet, elektronikus levélcímet,
kártyaazonosítót és egyedi jelenléti eseményt a kérés nem tartalmaz — a modell
számára a vizsgált személy megkülönböztethetetlen. Ez az adattakarékosság
elvének gyakorlati alkalmazása: a feladat elvégzéséhez a személyazonosság
ismerete nem szükséges, tehát nem is kerül továbbításra.

A modell működését rendszerszintű utasítás határozza meg, amely rögzíti a
terjedelmet, a hangnemet, és kifejezetten előírja, hogy a szöveg kizárólag a
megkapott számokra támaszkodhat. Ennek oka a nyelvi modellek ismert
gyengesége: a szakirodalmi áttekintésben bemutatott módon a modell meggyőző
hangvételű, de megalapozatlan állítást is előállíthat [13]. Itt ez akkor
jelentkezne, ha a modell a munkavégzés minőségéről vagy a késések okáról
fogalmazna meg olyan következtetést, amely a kapott adatokból nem következik.
Az utasítás ezt tiltja, a generálás alacsonyra állított véletlenszerűsége pedig
szűkíti a megfogalmazás szabadságát. A kockázat ezzel csökken, de nem szűnik
meg, ezért az összefoglaló kiegészítő információként, nem pedig döntés
alapjaként jelenik meg.

A hívás nem a böngészőből, hanem szerveroldali függvényből indul: a
szolgáltatás hozzáférési kulcsa a kliensbe kerülve bárki számára kiolvashatóvá
és a cég nevében felhasználhatóvá válna, ezért kizárólag szerveroldali
titokként tárolódik. A függvény emellett ellenőrzi a hívó jogosultságát is: az
összefoglaló csak vezetői vagy rendszergazdai szerepkörrel kérhető le.

A külső szolgáltatás hibakezelése külön tanulsággal szolgált. A kérések
kezdetben kvótatúllépésre hivatkozva bukdácsoltak, és az ok mindaddig rejtve
maradt, amíg a függvény a hibát saját, általános üzenetre cserélte. A tanulság
általánosítható: a külső szolgáltatás hibaüzenetét nem célszerű elnyelni, mert
éppen az az információ vész el, amely a hiba okára mutat.

## Automatizált folyamatok

A rendszer bizonyos műveleteket felhasználói beavatkozás nélkül végez el. Ezek
ütemezését az adatbázisban futó időzítő végzi, tehát nem szükséges hozzá külön
üzemeltetett szolgáltatás. A döntés a nem funkcionális követelmények között
megfogalmazott egyszerűséget szolgálja: minden további önálló összetevő újabb
felügyelendő ponttal bővítené a rendszert.

### Automatikus kiléptetés

A 3.4.2. alfejezetben bemutatott váltakozó logika helyes működése a korábbi
események teljességén múlik. Egy elmulasztott kilépés nem csupán egyetlen napot
tesz hiányossá: a következő napi belépést is ellenkezőjére fordítja, és a hiba
így önmagát tartja fenn. A nyitva maradt napok automatikus lezárása ezért nem
kényelmi szolgáltatás, hanem a rendszer helyes működésének feltétele.

A kézenfekvő megoldás — a napi egyszeri lefutás rögzített időpontban — két okból
bizonyult elégtelennek. Egyrészt a cégek eltérő időben végeznek, egy közös
időpont tehát vagy túl korán zárná le a még dolgozókat, vagy fölöslegesen későn
a már távozottakat. Másrészt az ütemezés egyezményes világidőben történik, a
beállított óra viszont helyi idő szerint értendő, és a kettő közötti eltérés a
nyári időszámítás miatt évente kétszer megváltozik.

A megvalósítás ezért óránként fut le, és minden futáskor összeveti az aktuális
helyi órát a beállítottal. Az időzóna-átváltás ezzel az adatbázisra hárul,
amely a váltás szabályait ismeri.

A beállítás a fejlesztés során tovább finomodott. Egyetlen cégszintű óra
ugyanis csak akkor elegendő, ha mindenki azonos műszakban dolgozik: a reggel
hatkor végző éjszakás és a délután kettőkor végző nappali műszak közös órával
nem kezelhető. A cég ezért műszaknevekhez rendelhet órát; amelyik műszak nem
szerepel a hozzárendelésben, arra a cég alapértelmezett órája marad érvényben,
tehát a korábban beállított érték és a műszak nélküli dolgozók kezelése is
változatlan marad.

A hozzárendelés szabadon szerkeszthető szerkezetben tárolódik, ezért érvénytelen
érték is bekerülhet. Ennek kezelése azért lényeges, mert egyetlen lekérdezés
zárja le valamennyi cég nyitott bejegyzését: egy hibára futó átalakítás minden
cég kiléptetését elmaradttá tenné. A megvalósítás ezért mintaillesztéssel
előszűri az értéket, és a nem szám alakút az alapértelmezésre cseréli.

Az így létrejött kilépést a vezetői felület külön jelöléssel különbözteti meg a
valódi kártyaérintéstől: az automatikus zárás nem a tényleges távozás
időpontját rögzíti, hanem a beállított órát. A művelet emellett csak a
huszonnégy óránál nem régebbi nyitott bejegyzéseket zárja le — a régebbi már
nem az adott naphoz tartozik, lezárása valótlan munkaidőt keletkeztetne.

### Napi jelenléti összesítő

A második automatizált folyamat naponta egyszer elektronikus levelet küld a cég
vezetőinek, amely három csoportban foglalja össze a napot: a jelen lévők
érkezési idővel és a késés jelölésével, az igazolt hiányzók a távollét
típusával, végül azok, akik nem jelentkeztek be. A levél formájának
megválasztása tudatos: a vezető nem feltétlenül nyitja meg naponta a felületet,
az elektronikus levél viszont a meglévő munkafolyamatába illeszkedik.

Az ütemezett feladat magát az összesítőt nem állítja elő, csupán elindítja az
erre szolgáló szerveroldali függvényt. A levél összeállítása alkalmazáslogika,
amelynek adatbázis-eljárásba helyezése nehezen karbantartható volna; ráadásul
ugyanaz a kód így kézzel is indítható a beállítások lapról.

A címzettek köre a 3.3.2. alfejezetben tárgyalt szétválasztás következménye: a
levél azokhoz a vezetői profilokhoz jut el, amelyekhez belépési fiók is
tartozik. Ha ez a kapcsolat hiányzik, a függvény nem csendben hagyja ki az
adott céget, hanem megnevezi az okot, mert a hiány a felületen semmiből nem
látszana.

A cég ezen a körön belül választhatja ki, kik kapják meg a levelet; üres
választás esetén a küldés elmarad. A választás nem jelent szabadon megadható
címet, és ez lényeges megkötés: a küldő végpont hitelesítés nélkül hívható — az
ütemezett feladat így indítja —, ezért a szerver minden mentett címet összevet
a cég vezetői fiókjaival. Enélkül a rendszer tetszőleges címre küldő
levéltovábbítóként volna felhasználható.

## Teszt eredmények és korlátok

Az ellenőrzés két, egymást kiegészítő rétegben történt. A nem magától értetődő
számításokat — a napi ledolgozott idő párokra bontását, a hétvégéket kihagyó
tartománybontást, az azonosítók egységesítését és a helyi óra meghatározását —
futtatható próbák fedik le. A második réteget az eszközön végzett kézi
forgatókönyvek adják: a kártyaolvasás, a kamerahasználat és a hálózat
megszakadása csak valódi készüléken vizsgálható. A kiemelt eseteket a 3.
táblázat foglalja össze.

@@TABLE A kiemelt tesztesetek és eredményeik

| Azonosító | Amit ellenőriz | Elvárt eredmény |
|---|---|---|
| C1 | Kártyás be- és kiléptetés | A művelet iránya külön választás nélkül váltakozik |
| C2 | Ismételt érintés öt másodpercen belül | A második érintés nem hoz létre eseményt |
| C4 | Megszakított fényképezés | Fénykép nélküli esemény nem keletkezik |
| D1 | Kártyafelismerés hálózat nélkül | A dolgozó neve a helyi névjegyzékből megjelenik |
| D2 | Újratöltés kapcsolat nélkül | Az alkalmazás elindul, a függő események megmaradnak |
| D3 | Szinkronizálás a kapcsolat helyreállásakor | Az események ismétlés nélkül, a tényleges időponttal kerülnek be |
| E2 | Belépés a dolgozói alkalmazásba | Jelenléti esemény nem keletkezik |
| F5 | Több napra szóló kérelem elbírálása | Egy döntésről egyetlen értesítés szól |
| H3 | Hibás műszakbeállítás | Az automatikus kiléptetés nem áll le, alapértelmezésre esik vissza |

A feltárt hibák közül kettő érdemel említést, mert egyik sem áll elő a szokásos
használat közben. A *service worker* kezdeti változata telepítéskor semmit nem
tárolt el, ezért kapcsolat nélküli újratöltéskor üres képernyő jelent meg
(3.4.4. alfejezet); a hiba azért maradt észrevétlen, mert a hálózatfüggetlen
működés minden más eleme hibátlanul üzemelt. Az automatikus kiléptetés
eredetileg rögzített időpontban futott, ami a nyári időszámításkor egy órával
elcsúszott volna a beállított helyi órához képest — ez a hiba fél évig
láthatatlan marad, majd az óraátállítás napján, magyarázat nélkül jelentkezik.

A legsúlyosabb korlát a beléptető alkalmazás platformfüggősége: a kártyaolvasó
felület kizárólag Android rendszeren, Chromium alapú böngészőben érhető el. A
falra szerelt, célra kijelölt eszközön ez ritkán jelent akadályt, elvi
korlátként azonban fennáll. A kínálkozó megkerülő megoldás — hogy az iOS a
kártyára írt webcímet magától megnyitja — nem a terminált tenné hordozhatóvá,
hanem ellenőrizetlen készülékre helyezné át a beléptetést, ahol a 3.4.3.
alfejezetben tárgyalt fényképes védelem éppen megszűnne.

További korlátok: a kamera használata után egyes eszközökön az NFC-olvasó
kódbeli újraindítással nem érhető el újra, ezért fényképkötelezettség esetén
automatikus oldalfrissítés következik; a PIN a 3.4.5. alfejezetben kifejtett
okból tartalék mód, nem jelszóval egyenértékű védelem; a havi összesítő
telefonon szűkített nézetben jelenik meg, mert hét oszlop nem fér ki; a
levélküldés pedig egyetlen, előzetesen igazolt címre korlátozódik — ez a
szolgáltatás próbaüzemi feltétele, nem a megvalósítás korlátja. Végül a
fényképes ellenőrzés nem előzi meg a visszaélést, csak utólag teszi
ellenőrizhetővé; a megelőzésre alkalmas biometrikus azonosítás viszont a 2.1.
alfejezetben tárgyalt adatvédelmi következményekkel jár, ezért tudatosan nem
került megvalósításra.
