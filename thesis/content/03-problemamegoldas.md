<!-- ===========================================================================
     3. PROBLÉMAMEGOLDÁS
     Ez a dolgozat lényegi része: a SAJÁT szakmai hozzájárulás.
     Cél: kb. 5000–7000 szó (a 2. fejezettel együtt 7000–10 000).
     Előírás: a teljes programkód NEM ide, hanem a Mellékletekbe kerül.
     Ide csak az a néhány részlet jöhet, ami a megértéshez elengedhetetlen.
     Az ábrákra hivatkozni kell a szövegben (pl. "az 1. ábrán látható módon").
     =========================================================================== -->

# Problémamegoldás

Ebben a fejezetben a megvalósított rendszer bemutatása következik, a
követelmények meghatározásától a tesztelés eredményeinek értékeléséig. A
tárgyalás a tervezés természetes sorrendjét követi: először a rendszerrel
szemben támasztott elvárások kerülnek rögzítésre, majd az ezekből következő
architekturális döntések, ezt követően az adatmodell, végül az egyes
alkalmazások működése.

A bemutatás célja nem csupán az elkészült megoldás leírása, hanem a mögötte
álló döntések indoklása is. Ahol a fejlesztés közben derült ki, hogy
egy korábbi elképzelés nem tartható, ott ez a körülmény külön jelzésre kerül,
mivel a tervezési döntések felülvizsgálata a fejlesztési folyamat szerves része.
A programkód terjedelmi okokból a Mellékletekbe került; a szövegben csak azok a
részletek szerepelnek, amelyek nélkül az adott megoldás nem érthető meg.

## Követelmények meghatározása

### Funkcionális követelmények

A követelmények meghatározása a rendszert használó három szerepkör
elkülönítésével történt. A szerepkörönkénti bontás azért indokolt, mert a
használat körülményei alapvetően eltérnek: a dolgozó néhány másodpercet tölt a
rendszerrel a munkanap két végpontján, a vezető ezzel szemben hosszabb ideig,
asztali eszközön dolgozik vele.

**A dolgozóval kapcsolatos követelmények.** A rendszernek lehetővé kell tennie
a munkaidő kezdetének és végének rögzítését az NFC-kártya érintésével, oly
módon, hogy a művelet iránya — belépés vagy kilépés — automatikusan
meghatározásra kerüljön, és ne igényeljen külön választást a dolgozótól. A
visszajelzésnek egyértelműnek és több méter távolságból is értelmezhetőnek kell
lennie, mivel a berendezés jellemzően falra szerelt eszközön üzemel. A kártya
otthon felejtése nem akadályozhatja meg a munkakezdést, ezért tartalék
azonosítási módra van szükség. A dolgozónak emellett hozzá kell férnie a saját
jelenléti adataihoz, mégpedig a munkahelyi terminálhoz kötöttség nélkül: a
tervezett távollétet jellemzően nem a műszak közben, hanem otthonról jelenti be.
A távollét bejelentése **kérelem**, nem tény rögzítése, ezért a dolgozónak
követnie kell tudnia a kérelem sorsát, és az elbírálásig vissza kell tudnia
vonni azt. A döntésről a rendszernek értesítenie kell a kérelmezőt, mégpedig
úgy, hogy az értesítés visszamenőleg is megtekinthető maradjon: a dolgozó
nem feltétlenül nyitja meg az alkalmazást a döntés napján, egy elmulasztott,
múló üzenet pedig ugyanoda vezetne, mint az értesítés hiánya.

**A vezetővel kapcsolatos követelmények.** A vezetői felületnek valós időben
kell megjelenítenie, hogy az adott pillanatban kik tartózkodnak a telephelyen. A
jelenléti eseményekről visszakereshető naplót kell vezetnie, amelyben időszak,
dolgozó és műszak szerint lehet szűrni. Szükséges továbbá az adatok időszakos
összesítése és külső táblázatkezelőbe történő kivitele, mivel a bérszámfejtés
jellemzően ilyen formátumot igényel. A vezetőnek kezelnie kell tudnia a
dolgozók adatait, a hiányzásokat, valamint a cégre vonatkozó beállításokat.
Döntenie kell továbbá a dolgozói távollét-kérelmekről; elutasítás esetén az
indoklásnak el kell jutnia a kérelmezőhöz. A
rendszernek végül a felhalmozott adatokból természetes nyelvű értékelést is elő
kell tudnia állítani, csökkentve ezzel a kimutatások értelmezéséhez szükséges
időt.

**A rendszerrel szemben támasztott követelmények.** Bizonyos műveleteknek
felhasználói beavatkozás nélkül kell végbemenniük. A nyitva maradt munkanapokat
a cég által beállított órában automatikusan le kell zárni, mivel a kilépés
rögzítésének elmulasztása a tapasztalatok szerint gyakori. A zárás időpontja
műszakonként eltérhet — az éjszakás műszak reggel végez, a nappali délután —,
ezért egyetlen közös óra nem elegendő. A vezetők számára
napi összesítő értesítést kell küldeni. Kezelni kell továbbá az alkalmi
látogatókat, akik nem rendelkeznek állandó kártyával.

### Nem funkcionális követelmények

A minőségi jellemzők közül négy bizonyult meghatározónak.

**Rendelkezésre állás.** A beléptetés a rendszer legkritikusabb funkciója:
kiesése esetén a munkavégzés adminisztrációja ellehetetlenül. A telepítés helye
— csarnok, telephelyi bejárat — a szakirodalmi áttekintésben említett módon
gyakran gyenge lefedettségű, ezért a hálózatkimaradást nem hibaállapotként,
hanem rendes üzemmenetként kell kezelni. Ebből következően az alkalmazásnak
kapcsolat nélkül is el kell indulnia, fel kell ismernie a kártyát, meg kell
határoznia a művelet irányát, és az eseményt későbbi továbbításra el kell
tárolnia. A kapcsolat helyreállásakor a tárolt események továbbításának
duplikáció nélkül kell megtörténnie.

**Válaszidő.** A kártya érintésétől a visszajelzés megjelenéséig eltelt időnek
két másodpercen belül kell maradnia. Ennél hosszabb várakozás esetén a dolgozó
bizonytalanná válik a művelet sikerességét illetően, és a kártyát ismét
odaérinti, ami szükségtelen ismételt eseményt eredményez.

**Adatbiztonság és a cégek elkülönítése.** Mivel a rendszer több cég adatait
kezeli ugyanabban az adatbázisban, biztosítani kell, hogy egyik cég adata se
legyen elérhető a másik számára. A követelmény lényeges eleme, hogy ez az
elkülönítés ne kizárólag az alkalmazás kódjának helyességén múljon: egyetlen
elfelejtett szűrőfeltétel nem vezethet adatszivárgáshoz. A dolgozókról kezelt
adatok körét az adattakarékosság elvéhez igazodva a feladat ellátásához
szükséges minimumra kell szorítani.

**Bővíthetőség és hordozhatóság.** A rendszernek fel kell készülnie arra, hogy
egyes külső szolgáltatások — például a szöveges összefoglalást előállító
nyelvi modell vagy az elektronikus levelek küldését végző szolgáltatás —
lecserélésre kerülnek. Az ilyen függőségeket ezért a rendszer egy-egy jól
körülhatárolt pontján kell elhelyezni, hogy cseréjük ne érintse a felhasználói
felületet. Az alkalmazásoknak külön telepítés nélkül, böngészőből
használhatónak kell lenniük.

## A rendszer architektúrája

A követelmények áttekintése után az első és egyben legmeghatározóbb tervezési
döntés az volt, hogy a rendszer nem egyetlen, hanem három különálló
alkalmazásból áll, amelyek közös háttérrendszert használnak. A felépítés az 1.
ábrán látható.

![A rendszer architektúrája](architektura.png)

A kézenfekvőbb megoldás egyetlen alkalmazás készítése lett volna, amely a
bejelentkezett felhasználó szerepköre alapján más-más felületet jelenít meg.
Ez a megközelítés három érv miatt került elvetésre.

Az **eltérő használati mód** a legfontosabb szempont. A beléptető alkalmazás
falra szerelt, folyamatosan bekapcsolt eszközön fut, egyetlen képernyőt jelenít
meg, és felhasználói bejelentkezés nélkül üzemel — az azonosítást maga a kártya
végzi. A vezetői felület ezzel szemben asztali böngészőben, hitelesített
munkamenetben, összetett táblázatokkal és diagramokkal dolgozik. E két
felhasználási mód között gyakorlatilag nincs közös felületi elem, összevonásuk
tehát nem egyszerűsítené, hanem bonyolítaná a kódot.

A második érv a **támadási felület** csökkentése. A beléptető alkalmazás
nyilvánosan hozzáférhető eszközön fut, amelyhez elvileg bárki hozzáférhet.
Amennyiben ugyanaz az alkalmazás tartalmazná a vezetői funkciókat is, a
kimutatásokhoz és a dolgozói adatokhoz tartozó programkód is eljutna erre az
eszközre, még akkor is, ha a felület elrejtve marad. A szétválasztással a
beléptető eszközre kizárólag az a kód kerül, amelyre a beléptetéshez ténylegesen
szükség van.

A harmadik szempont a **független telepíthetőség**. A három alkalmazás eltérő
ütemben változik: a beléptető alkalmazás a legstabilabb, mivel a működése
egyszerű és jól körülhatárolt, a vezetői felület viszont folyamatosan bővül. Az
elkülönítés lehetővé teszi, hogy a vezetői felület módosítása ne igényelje a
beléptető eszközök frissítését, ami üzemszerű körülmények között kifejezetten
előnyös, hiszen ezek az eszközök nehezen hozzáférhetők.

Az egyes alkalmazások szerepe a következőképpen alakult. A **beléptető
alkalmazás** olvassa a kártyát, dönti el a művelet irányát, és jeleníti meg a
visszajelzést; ez az egyetlen olyan része a rendszernek, amelynek hálózat
nélkül is teljes értékűen működnie kell. A **dolgozói alkalmazás**
önkiszolgáló felületet biztosít: a dolgozó megtekintheti a saját jelenléti
adatait, és távollétet kérvényezhet. A **vezetői felület** a rendszer
adminisztratív központja, ez az egyetlen alkalmazás, amely hagyományos,
jelszavas bejelentkezést használ.

A dolgozói alkalmazás szerepének pontos meghatározása a fejlesztés során
módosult. Az eredeti elképzelés szerint a dolgozó a kártyáját a saját
telefonjához érintve azonosította volna magát, sőt felmerült, hogy a telefon
váltsa ki magát a kártyát a terminál előtt. Ez utóbbi azonban nem
megvalósítható: a Web NFC felület kizárólag olvasó/író üzemmódot támogat, a
kártyaemulációhoz szükséges *Host Card Emulation* pedig natív rendszerszintű
felület, amely böngészőből nem érhető el.

A korlát felismerése tisztább szereposztáshoz vezetett. A jelenlét rögzítése
kizárólag a beléptető alkalmazásban történik, a dolgozói alkalmazás pedig
kizárólag önkiszolgáló portál, amely PIN-kóddal azonosít. Ennek gyakorlati
haszna, hogy a felület a munkahelytől függetlenül, otthonról is használható —
márpedig a szabadságkérelem jellemzően nem műszak közben születik. A PIN itt
tehát azonosításra szolgál, nem jelenlét igazolására; ugyanaz az adat két
eltérő biztonsági szerepben jelenik meg, és ezt a megkülönböztetést a
szerveroldal is érvényesíti: a dolgozói alkalmazás felől jelenléti esemény
nem hozható létre.

A három alkalmazás közös háttérrendszerrel dolgozik, amely az adatbázist, a
hitelesítést, a fájltárolást és a szerveroldali függvények futtatását biztosítja.
Az üzleti logika azon része, amely biztonsági szempontból érzékeny — a
beléptetés érvényesítése, a felhasználók létrehozása, a szöveges összefoglaló
előállítása — nem a böngészőben futó alkalmazásokban, hanem szerveroldali
függvényekben helyezkedik el. Ennek oka, hogy a kliensoldali kód a felhasználó
által megtekinthető és módosítható, ezért érdemi ellenőrzés végrehajtására nem
alkalmas.

<!-- Az ábrafájlt a thesis/figures/ mappába kell tenni. A felirat és a
     sorszám automatikusan az ábra alá kerül. -->

### Az alkalmazott technológiák

A technológiai döntéseket két körülmény határolta be. Egyrészt a beléptetéshez
szükséges Web NFC felület kizárólag böngészőben érhető el, ami eleve webes
megvalósítást ír elő. Másrészt a fejlesztést egyetlen személy végezte, ezért
azok a megoldások kerültek előnybe, amelyek a járulékos üzemeltetési munkát a
lehető legkisebbre szorítják.

**A felhasználói felület** React könyvtárral készült [12]. A választás fő
indoka, hogy a rendszer állapota folyamatosan változik — érkezik egy új esemény, lezárul
egy nap, megszületik egy döntés —, és a React deklaratív megközelítése éppen az
ilyen, állapotvezérelt felületekhez való: a megjelenítés az adatból következik,
nem külön léptetett műveletekből. Ehhez járul, hogy a három alkalmazás közös
megjelenítési elemeket használ, amelyek komponensként egyszer írhatók meg.

Az építőeszköz a Vite, amely fejlesztés közben az egyes modulokat a böngésző
natív modulkezelőjén keresztül szolgálja ki, és így a forrás módosításakor nem
a teljes alkalmazást, hanem csak az érintett modult kell újraépítenie [13]. Ez
NFC-vel dolgozva külön előnyt jelent, mivel a hibakeresés valódi eszközön,
ismételt kártyaérintésekkel történik, tehát a fordítási várakozás minden egyes
próbánál újra jelentkezne.

**A háttérrendszer** a Supabase szolgáltatáscsomagra épül, amelynek alapja a
PostgreSQL adatbázis-kezelő. A döntés lényege nem a kényelem, hanem az, hogy a
szolgáltatás nem rejti el az adatbázist [14]: közvetlen SQL-hozzáférés áll
rendelkezésre, a sorszintű biztonság, a generált oszlopok, a részleges egyedi
indexek és az ütemezett feladatok mind használhatók. Ezek a rendszer több
pontján meghatározó szerepet kaptak, ahogyan az a következő alfejezetekből
kiderül. A 2.4. alfejezetben tárgyalt szolgáltatói kötődés kockázata ezzel
mérsékelhető: az adatbázis szabványos PostgreSQL, tehát az adatok és a séma
átvihetők.

A csomag további elemei közül a **hitelesítés** a vezetői belépést kezeli, a
**fájltároló** a fényképes ellenőrzés képeit, a **valós idejű szolgáltatás**
pedig az adatbázis változásait továbbítja a vezetői felületnek, így a jelenléti
állapot lekérdezés nélkül frissül.

A **szerveroldali függvények** Deno futtatókörnyezetben futnak. Ezekbe került az
üzleti logika azon része, amelyet a kliensre bízni nem lehet: a beléptetés
érvényesítése, a felhasználók létrehozása, a hiányzás-kérelmek feldolgozása és a
nyelvi modell hívása. Utóbbinál külön szempont, hogy az API-kulcs a
szolgáltatás beállításai között tárolható, és így soha nem kerül a böngészőbe.

**Az ütemezett feladatokat** a `pg_cron` bővítmény végzi, tehát az adatbázison
belül, nem külső ütemezőben. Ennek gyakorlati haszna, hogy nincs újabb
üzemeltetendő komponens, és a feladat ugyanabban a tranzakciós környezetben fut,
mint az adat, amelyen dolgozik.

**A hálózatfüggetlen működéshez** a böngésző IndexedDB tárolója szolgál, a
Dexie könyvtár közvetítésével, amely a nyers felület alacsony szintű,
eseményvezérelt kezelése helyett ígéret-alapú felületet ad. Az alkalmazás
hálózat nélküli indulását *service worker* biztosítja.

A felsorolt eszközök közös vonása, hogy mindegyik kiforrott, dokumentált és
széles körben alkalmazott megoldás. Ez a fejlesztési kockázatot csökkenti, ára
viszont az, hogy a rendszer viselkedése részben olyan komponensektől függ,
amelyek belső működése nem módosítható. Ezt a függőséget a 3.1.2. alfejezetben
rögzített elszigetelési követelmény tartja kezelhető szinten.

## Az adatmodell

Az adatbázis öt tábla köré szerveződik. A logikai séma a 2. ábrán látható.

![Az adatbázis logikai sémája](adatbazis-sema.png)

**A `companies` tábla** a rendszert használó cégeket tartja nyilván. Ez a tábla
a több bérlős működés kiindulópontja: minden további tábla ide hivatkozik
vissza. A cégnév és az URL-ben használható rövid azonosító mellett a
munkaidő-szabályok is itt kaptak helyet — a munkanap kezdete, a késésnek
számító küszöb, az automatikus kiléptetés órája, valamint a fényképes
ellenőrzés két kapcsolója. Ezek azért a cég sorában szerepelnek, és nem
alkalmazásszintű beállításként, mert cégenként eltérhetnek, és a beléptetés
kiértékelésekor a szervernek amúgy is be kell töltenie a cég sorát.

**A `profiles` tábla** a személyeket írja le, szerepkörtől függetlenül: a
dolgozókat, a vezetőket, az adminisztrátorokat és az alkalmi látogatókat is. A
szerepkört külön mező hordozza, megszorítással korlátozva a megengedett
értékekre. A név két összetevőben tárolódik — vezetéknév és keresztnév —,
mert a rendezés, a megszólítás és az adatkarbantartás mind a két rész
ismeretét igényli. A teljes név **generált oszlopként** áll elő a kettőből,
tehát nem külön karbantartott adat, hanem származtatott érték, amely soha nem
térhet el az összetevőitől. Ennek gyakorlati haszna, hogy a nevet olvasó
korábbi lekérdezések változtatás nélkül működnek tovább.

A táblában szerepel az NFC-kártya azonosítója, a tartalék belépéshez használt
PIN, a telefonszám és az elektronikus levélcím, továbbá az opcionális műszak
vagy részleg megjelölése. Az alkalmi látogatóknál egy lejárati időpont is
rögzítésre kerül, amely után a kártya érvénytelenné válik.

Két egyediségi megkötés érdemel figyelmet. A kártyaazonosító cégen belül
egyedi, nem globálisan: két különböző cég használhat azonos azonosítójú
kártyát, hiszen egymás rendszeréhez nincs közük. A PIN esetében az egyediséget
*részleges* index biztosítja, amely csak a kitöltött értékekre vonatkozik —
enélkül a PIN nélküli dolgozók ütköznének egymással, mivel valamennyiüknél
üres az érték.

**Az `events` tábla** a jelenléti eseményeket tárolja: minden sor egy belépés
vagy egy kilépés, időbélyeggel. Külön mező jelzi, hogy a bejegyzés vezetői kézi
javítás eredménye-e, és megjegyzés is fűzhető hozzá — így az automatikus
kiléptetés vagy az utólagos korrekció megkülönböztethető a valódi
kártyaérintéstől. A fényképes ellenőrzés képének elérési útja szintén itt
szerepel.

A tábla legfontosabb sajátossága a `client_event_id` mező, amelyet nem a
szerver, hanem a kliens állít elő. Erre a hálózatfüggetlen működés miatt van
szükség: ha a válasz elveszik azután, hogy a szerver már feldolgozta a kérést,
az ismételt küldés duplikált bejegyzést hozna létre. A mezőre épített
**részleges egyedi index** ezt kizárja, a részlegesség pedig azért kell, mert a
kártyás beléptetés közvetlen, hálózaton keresztüli útján ez az azonosító
kitöltetlen marad, és az üres értékek egyébként ütköznének. A megoldás a 2.4.
alfejezetben tárgyalt idempotencia gyakorlati megvalósítása.

**Az `absences` tábla** a hiányzásokat tartja nyilván, **naponként egy sorban**.
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

**A `notifications` tábla** a dolgozónak szóló értesítéseket őrzi. A megjelenítés
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
PostgreSQL **sorszintű biztonságára** épül, amely a szűrést az adatbázisban
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

A hiba mögött fogalmi ellentmondás állt. A rendszerben ugyanis **a dolgozónak
nincs és nem is lehet belépési fiókja**: az azonosítást a kártya végzi, nem
felhasználónév és jelszó. Egy fiók létrehozása elektronikus levélcímet
igényelne, ami fizikai munkakörökben gyakran nem áll rendelkezésre, és
felesleges személyes adatot is kezelne. A hitelesítési fiókhoz kötött séma
tehát olyan feltételt támasztott, amely a rendszer működési modelljével
ellentétes.

A megoldás a két fogalom szétválasztása lett. A profil önálló, saját azonosítót
kap, és egy kitölthető, de nem kötelező mező köti — ha van ilyen — a
hitelesítési rendszer felhasználójához. Ezt a mezőt kizárólag a vezetők és az
adminisztrátorok sora tölti ki; a dolgozóknál, a látogatóknál üresen marad.

A megoldás következménye, hogy a jogosultsági szabályok nem közvetlenül a
munkamenet azonosítójával dolgoznak, hanem azon keresztül keresik meg a
profilt. Ezt végzik a korábban bemutatott segédfüggvények. A kerülőút ára egy
további lekérdezés, haszna viszont az, hogy a személy és a belépési mód
egymástól függetlenül kezelhető: egy dolgozó később vezetővé léptethető pusztán
azzal, hogy a profilja fiókhoz kapcsolódik, és a hozzá tartozó jelenléti előzmény
érintetlen marad.

Az eset tanulsága, hogy a dokumentációban szereplő minta hallgatólagos
előfeltevéssel élt: azzal, hogy minden nyilvántartott személy egyben
bejelentkező felhasználó is. Ez a feltevés a szolgáltatás szokásos
felhasználási módjában teljesül, a jelen rendszerben azonban nem, mivel a
nyilvántartott személyek többsége soha nem jelentkezik be. A mintát ezért nem
átvenni, hanem az eltérő előfeltevéshez igazítani kellett.

## A beléptető alkalmazás

A beléptető alkalmazás a rendszer legkritikusabb eleme: ez az egyetlen felület,
amelyen jelenléti esemény keletkezhet, és kiesése esetén a munkaidő
adminisztrációja megáll. Működése ugyanakkor a legszűkebb: egyetlen képernyőt
jelenít meg, felhasználói bejelentkezést nem ismer, és kezelése kimerül a
kártya odaérintésében. Ez az alfejezet a megvalósítás négy meghatározó
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

A megoldás az azonosító **egységesítése**, amely nagybetűssé alakítja, és minden
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
megfelelően **váltakozó** logikát követ, amely a személy legutolsó eseményét
veszi alapul. Amennyiben az belépés volt, a következő esemény kilépés lesz, és
fordítva; ha egyáltalán nincs korábbi esemény, a művelet belépésként
értelmeződik.

A megoldás előnye, hogy a dolgozó számára nem igényel döntést, és így nem is
téveszthető el. Ára az, hogy a helyes működés a korábbi események
teljességétől függ: egy elmulasztott kilépés a következő napi belépést
fordítja ellenkezőjére. Éppen ezért szükséges a 3.7.1. alfejezetben tárgyalt
automatikus kiléptetés, amely a nyitva maradt napokat lezárja, és ezzel a
váltakozó logika kiindulóállapotát helyreállítja.

A második lényeges kérdés az **ismételt érintés** kezelése. A dolgozó
bizonytalanság esetén — például mert nem vette észre a visszajelzést —
másodszor is odaérinti a kártyát, ami két egymást követő eseményt hozna létre,
és a ledolgozott idő számítását elrontaná. A rendszer ezért harminc másodperces
ablakon belül nem rögzít újabb, azonos irányú eseményt, hanem hibával utasítja
el a kérést.

A harminc másodperc arányossági kompromisszum eredménye. Rövidebb ablak nem
zárná ki megbízhatóan a téves ismétlést, hosszabb viszont akadályozná azt a
valós helyzetet, amikor a dolgozó néhány perc múlva ténylegesen távozik.
Lényeges, hogy a szűrés a szerveren történik, nem a kliensben: a beléptető
eszközök száma nem korlátozott, és két különböző eszközön leadott érintést csak
a közös háttérrendszer láthat egyszerre.

A **visszajelzés** kialakítását a használat körülményei határozták meg. A
képernyő teljes felülete színt vált — belépésnél zöldre, kilépésnél pirosra —,
és nagy betűmérettel jeleníti meg a nevet, valamint a művelet irányát. Ennek oka,
hogy a készülék falra szerelve, a dolgozó szemmagassága fölött vagy alatt
helyezkedik el, tehát a visszajelzést több méter távolságból, futó pillantással
is értelmezhetővé kell tenni. Az információt nem kizárólag a szín hordozza: a
szöveg önmagában is egyértelmű, ami színtévesztés esetén is olvashatóvá teszi.
A képernyő három másodperc elteltével automatikusan visszatér olvasásra kész
állapotba, így a következő dolgozónak nem kell semmit tennie.

### Fényképes ellenőrzés

A 2.3. alfejezetben tárgyalt visszaélési lehetőség — a kártya átadása egy
kollégának — ellen a rendszer a belépés pillanatában készített fényképfelvétellel
védekezik. Fontos pontosan rögzíteni, hogy ez **nem arcfelismerés**: a rendszer
nem tárol biometrikus mintát, és nem hasonlítja össze a felvételt korábbi
képekkel. A megoldás nem megakadályozza, hanem utólag ellenőrizhetővé, és ezzel
kockázatossá teszi a visszaélést.

A megkülönböztetés adatvédelmi szempontból meghatározó. Az arcfelismeréshez
szükséges biometrikus sablon az általános adatvédelmi rendelet szerint a
személyes adatok különleges kategóriájába tartozik, kezelése tehát szigorúbb
feltételekhez kötött. Egy fényképfelvétel ezzel szemben — amely az esemény
dokumentálására szolgál, és zárt tárolóban, korlátozott hozzáféréssel őrződik —
lényegesen kisebb adatvédelmi terheléssel jár, miközben az elrettentő hatás
nagyrészt megmarad.

A funkció cégenként külön kapcsolható, mégpedig a kártyás és a PIN-alapú
belépésre külön-külön. Ennek indoka az azonosítási módok eltérő természete: a
kártya birtoklást igazol, a PIN viszont tudást, amely szóban is átadható. Egy
megosztott PIN tehát könnyebben vezet visszaéléshez, ezért indokolt lehet a
fényképet akkor is megkövetelni, ha a kártyás belépésnél nem szükséges.

A megvalósítás legérdekesebb része a folyamat **kétlépéses** felépítése. A
kézenfekvő megoldás az volna, hogy az alkalmazás a kártya beolvasása után
azonnal fényképet készít, majd mindkettőt egyszerre küldi el. Ez azonban
felesleges felvételeket eredményezne: az alkalmazás a kérés elküldése előtt nem
tudja, hogy az adott céghez tartozik-e fényképkötelezettség, sőt azt sem, hogy
a kártya egyáltalán érvényes-e.

A megvalósított folyamat ezért a következő. Az első kérés csak az azonosítót
küldi el. A szerver ellenőrzi a kártyát, megállapítja a művelet irányát, majd —
ha a cég beállítása ezt megkívánja — nem hoz létre eseményt, hanem jelzi, hogy
fényképre van szükség. Az alkalmazás ekkor kapcsolja be a kamerát, és a
felvétellel együtt küldi el a második kérést, amely nyomán az esemény
ténylegesen létrejön.

A felépítés lényeges következménye, hogy félbehagyott bejegyzés nem
keletkezhet. Ha a dolgozó a fényképezést megszakítja, vagy a kamera használatát
megtagadja, a rendszerben nem marad fénykép nélküli, mégis rögzített esemény. A
duplikáció-szűrés szintén csak a második kérésben fut le, tehát az előkészítő
kérés nem használja el a harminc másodperces ablakot.

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
megoldás egy helyben tárolt **névjegyzék**, amelyet az alkalmazás kapcsolat
esetén rendszeresen frissít, és amely a kártyaazonosítókat a hozzájuk tartozó
névvel és szerepkörrel párosítja. Lényeges, hogy a névjegyzék kizárólag a
megjelenítéshez szükséges adatokat tartalmazza — nevet és szerepkört —, tehát
az eszköz elvesztése esetén sem kerül ki belőle jelenléti előzmény vagy
elérhetőség.

**A második kérdés a művelet irányának meghatározása.** A váltakozó logikához a
személy legutolsó eseményének ismerete szükséges, ez viszont a szerveren
tárolódik. Az alkalmazás ezért kártyánként nyilvántartja a legutóbb ismert
irányt is. A nyilvántartás a névjegyzék frissítésekor a szerver adataiból áll
elő, majd a rendszer **ráolvassa** a még el nem küldött, helyben rögzített
eseményeket. Erre azért van szükség, mert a szerver azokról még nem tud: nélküle
egy offline belépés után a következő érintés ismét belépésként értelmeződne.

**A harmadik kérdés a rögzített események megőrzése.** A kapcsolat hiányában
keletkező eseményeket az alkalmazás a böngésző beágyazott adatbázisában, sorban
tárolja. A sorba kerülő tétel tartalmazza a művelet irányát és a **rögzítés
tényleges időpontját** — nem azt, amikor később továbbításra kerül. Ez a
megkülönböztetés lényegi: ha az időbélyeget a szerver adná a feldolgozás
pillanatában, egy több órán át tartó hálózatkimaradás után minden esemény a
helyreállás időpontjára esne, és a ledolgozott idő teljesen hibás lenne.

**A negyedik kérdés a visszajátszás helyessége.** A 2.4. alfejezetben
tárgyaltaknak megfelelően a kapcsolat helyreállásakor a sor tételei
egyenként továbbításra kerülnek. Itt merül fel a legkevésbé szembetűnő
hibalehetőség: a válasz elveszhet azután, hogy a szerver a kérést már
feldolgozta. Az alkalmazás ilyenkor sikertelennek tekinti a küldést, és a
tételt a sorban hagyja, a következő próbálkozás pedig ugyanazt az eseményt
másodszor is rögzítené.

A megoldás az **idempotens** művelet. A sorba kerüléskor az alkalmazás egyedi
azonosítót állít elő a tételhez, és azt minden küldéssel együtt továbbítja. Az
adatbázisban erre a mezőre egyedi index épül, így a második beszúrás
megkötéssértéssel elbukik. A szerver ezt a hibát nem tekinti valódi hibának:
felismeri, hogy az esemény már rögzítésre került, és sikeres választ ad, amire
az alkalmazás a tételt eltávolítja a sorból. A helyes végállapot tehát nem az
üzenetküldés megbízhatóságán múlik, hanem azon, hogy az ismétlés
következmények nélkül maradjon.

A visszajátszás **sorrendtartó**, és a hibákat két csoportra bontja. Végleges
hiba esetén — például ha a kártya időközben törlésre került — a tétel
eltávolításra kerül, mivel ismételt küldése sem vezetne eredményre. Átmeneti
hiba, azaz szerveroldali üzemzavar vagy hálózati hiba esetén viszont a tétel a
sorban marad, és a feldolgozás megszakad. Utóbbi azért lényeges: ha a
feldolgozás a hibás tétel átugrásával folytatódna, az események sorrendje
felborulna, és a váltakozó irány hibás állapotba kerülne.

#### Az alkalmazás indulása hálózat nélkül

A fenti megoldások mindegyike azt feltételezi, hogy az alkalmazás fut. Ez
azonban nem magától értetődő: ha az eszköz újraindul vagy az oldal frissítésre
kerül, a böngészőnek a hálózatról kellene betöltenie az alkalmazást, ami
kapcsolat nélkül nem lehetséges.

A megoldást a 2.4. alfejezetben ismertetett *service worker* adja, amely a
kimenő kéréseket elfogja, és eldönti, hogy azokat a hálózatról vagy a helyi
gyorsítótárból szolgálja ki. Az alkalmazás váza így telepítéskor a
gyorsítótárba kerül, és onnan hálózat nélkül is betölthető.

Ennek megvalósításánál egy nem nyilvánvaló akadály merült fel. Az építőeszköz a
kimeneti fájlok nevébe tartalomfüggő azonosítót illeszt, hogy a böngésző a
frissítést biztosan észrevegye. Ebből következően a fájlnevek minden építéskor
megváltoznak, tehát előre, név szerint nem lehet felsorolni őket a
gyorsítótárazandó elemek között.

A megoldás kétrétegű. Az alkalmazás belépési pontja — amelynek neve állandó —
telepítéskor kerül a gyorsítótárba. A változó nevű állományok ezzel szemben
**használat közben**, az első betöltésükkor tárolódnak el, mégpedig olyan
eljárással, amely a gyorsítótárban lévő példányt azonnal kiszolgálja, de a
hálózati választ a háttérben lekéri, és azzal frissíti a tárolt változatot. Így
az alkalmazás egyszerre indul gyorsan és marad naprakész.

A megközelítés helyessége a fejlesztés során nem volt magától értetődő: a
korábbi változat telepítéskor semmit sem tárolt, így a hálózat nélküli
újratöltés üres képernyőt eredményezett — miközben a hálózatfüggetlen működés
minden más eleme hibátlanul üzemelt. A hiba azért maradt sokáig észrevétlen,
mert csak akkor jelentkezett, ha a kapcsolat megszakadása **és** az oldal
újratöltése egyszerre következett be. A jelenség tárgyalása a 3.8.
alfejezetben, a tesztelés eredményei között folytatódik.

### PIN-alapú tartalék belépés

A kártyaalapú azonosítás gyakorlati gyengesége, hogy a kártya otthon
felejthető. Ilyenkor a dolgozó nem tudja rögzíteni az érkezését, a hiányzó
bejegyzést pedig utólag a vezetőnek kell pótolnia. Ez nemcsak többletmunka:
a pótolt időpont már nem mérés, hanem emlékezet. A rendszer ezért tartalék
azonosítási módot kínál, amelyben a dolgozó a beléptető eszköz
számbillentyűzetén megadott PIN-kóddal jelzi a jelenlétét.

A megoldás egyetlen felhasználói döntést enged meg: a PIN beírását. Névsor
nem jelenik meg, és a dolgozónak nem kell kiválasztania magát a listából.
Ennek nem kényelmi oka van. A készülék nyilvános helyen, falra szerelve
üzemel, tehát a teljes névsor kiírása minden arra járó számára megmutatná a
cég alkalmazottait — ez adatvédelmi szempontból indokolatlan, a lista pedig
nagyobb létszámnál használhatatlanul hosszúvá válna.

Ebből azonban egy nem nyilvánvaló műszaki következmény adódik. Mivel a szerver
kizárólag magát a PIN-t kapja meg, a hozzá tartozó személyt a tárolt **érték
alapján** kell megtalálnia. A jelszavaknál bevett eljárás — véletlenszerű
sóval képzett, egyirányú lenyomat — erre nem alkalmas, mert ugyanahhoz a
bemenethez minden bejegyzésnél más tárolt értéket rendel. Ilyen tárolás mellett
a keresés csak úgy volna elvégezhető, hogy a rendszer minden dolgozó
bejegyzését egyenként megvizsgálja, ami a létszámmal arányosan lassuló és
nehezen védhető megoldás.

A megvalósítás ezért determinisztikus, a cég azonosítójával sózott SHA-256
lenyomatot tárol. Ugyanaz a PIN ugyanabban a cégben mindig azonos értéket ad,
tehát a keresés egyetlen indexelt lekérdezéssel elvégezhető. A nyers PIN
sehol nem tárolódik. A cégazonosító sóként való használata azt eredményezi,
hogy két különböző cégben megadott azonos PIN eltérő tárolt értékhez vezet,
így az egyik adatállomány ismerete a másikhoz nem nyújt segítséget.

A választás kompromisszumát indokolt nyíltan kimondani. Négy–hat számjegyű
PIN-ből legfeljebb egymillió különböző létezik, tehát az adatbázis
kikerülése esetén a tárolt értékek kimerítő próbálgatással visszafejthetők.
A sózás ezt a munkát cégenként külön elvégzendővé teszi, de nem teszi
lehetetlenné. A PIN ezért nem tekinthető jelszóval egyenértékű védelemnek,
és a rendszer nem is használja annak: adatmódosításra nem jogosít, és önmagában
nem ad hozzáférést a vezetői felülethez.

A fennmaradó kockázatot két további megkötés mérsékli. Az első adatbázis
szintű: egy cégen belül két dolgozónak nem lehet azonos PIN-je. Ezt részleges
egyediségi megkötés érvényesíti, amely csak a kitöltött értékekre vonatkozik,
tehát a PIN nélküli dolgozók nem ütköznek egymással. A megkötés nélkül a
beütött kód több személyhez is vezethetne, és a rendszer nem tudná eldönteni,
kinek az érkezését rögzítse. A második a 3.4.3. alfejezetben tárgyalt
fényképkötelezettség, amely a PIN-es belépésre külön előírható: a PIN
elmondható egy kollégának, a fényképfelvétel viszont a visszaélést utólag
ellenőrizhetővé teszi.

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
szolgáltatás, böngészőből viszont nem hívható [5]. A képesség tehát nem a
megvalósítás minőségén, hanem a platform határain múlik.

A korlát felismerése a dolgozói alkalmazás szerepének újrafogalmazásához
vezetett. Az alkalmazás nem beléptető eszköz, hanem önkiszolgáló felület: a
jelenléti esemény továbbra is kizárólag a beléptető alkalmazásban, kártyával
vagy PIN-nel keletkezhet.

Ebből következett az azonosítás módjának megváltoztatása is. A korábbi változat
a kártya odaérintésével azonosított, ami két problémát hordozott. Egyrészt a
dolgozó csak akkor férhetett hozzá a saját adataihoz, ha a kártya nála volt —
holott a felület éppen otthonról, a kártya nélkül a leghasznosabb. Másrészt
fogalmi zavart keltett, hogy ugyanaz a mozdulat a két alkalmazásban mást
jelentett: az egyikben munkaidőt rögzített, a másikban csak megjelenítette azt.

A megvalósított azonosítás ezért a 3.4.5. alfejezetben bemutatott PIN-re épül.
Lényeges megkülönböztetés, hogy a dolgozói alkalmazásban megadott PIN **nem**
hoz létre jelenléti eseményt. A felületre való belépés és a munkaidő rögzítése
két különböző művelet, és a rendszer ezeket nem vonja össze — ellenkező esetben
a dolgozó otthonról is rögzíthetné az érkezését.

### A felület felépítése

A felület három nézetre tagolódik: a mai nap, a napló és a hiányzások. A
nézetek között a fejlécben elhelyezett választóval, valamint oldalirányú
húzással lehet váltani, mivel az utóbbi a mobilalkalmazásokban megszokott, és
egykezes használat mellett kényelmesebb.

A mai nap nézete a belépés és a kilépés időpontját, valamint az eddig
ledolgozott időt mutatja. A napló ehhez képest visszatekintő: egy hét, illetve
egy hónap bontásban jeleníti meg a napokat és a hozzájuk tartozó óraszámot. A
két időtáv közötti váltás lehetősége nem díszítő elem, hanem eltérő kérdésekre
ad választ. A heti nézet a *mennyit dolgoztam ezen a héten* kérdésre felel, a
havi pedig a hónap egészének alakulására; egyetlen rögzített időszak a másikat
mindig használhatatlanná tenné.

A napi óraszám kiszámítása annyiban nem magától értetődő, hogy egy naphoz
több be- és kilépés is tartozhat: az ebédszünetre távozó dolgozó négy eseményt
hoz létre. A számítás ezért az eseményeket sorrendben párba állítja, és a párok
hosszát összegzi. A napközbeni távollét így nem számít bele a ledolgozott
időbe, a nyitva maradt utolsó belépés pedig a jelen pillanatig tart.

A felület személyes adatot jelenít meg olyan eszközön, amely könnyen kikerül a
tulajdonosa látóteréből. Ezért kétperces tétlenség után magától
bejelentkezetlen állapotba tér vissza. A visszaszámlálás minden érintésre
újraindul, tehát a használatot nem zavarja.

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
állapota függő, **és** a kérelmező a saját sorát vonja vissza. A gomb elrejtése
a felületen csupán kényelmi kiegészítés; a szabály betartatása nem bízható a
kliensre, mert a kérés a felület megkerülésével is összeállítható.

Hasonló megfontolásból történik a szerveren a megadott időszak napokra bontása
is. A dolgozó kezdő és záró dátumot ad meg, és jelezheti, hogy a hétvégék
kimaradjanak-e; a napok listáját azonban a szerver állítja elő. Ennek két oka
van. Egyrészt az adatbázis a hiányzást napi bontásban tárolja, mivel a
naptárnézet, az összesítők és a jelenléti kimutatás egyaránt napokkal dolgozik.
Másrészt ha a bontást a kliens végezné, minden felület — a dolgozói alkalmazás
és a vezetői felület — külön valósítaná meg ugyanazt a szabályt, és a két
megvalósítás előbb-utóbb eltérne egymástól.

A részben átfedő időszakok kezelése külön figyelmet igényelt. Ha a dolgozó
olyan tartományt küld be, amelynek egyes napjaira már van rögzített hiányzás, a
művelet nem hiúsul meg: a rendszer a már meglévő napokat kihagyja, a többit
pedig rögzíti. A teljes elutasítás formailag védhető volna, a gyakorlatban
azonban a dolgozót arra kényszerítené, hogy maga derítse ki, melyik nap
ütközik. A kérelem hossza felső korlátot kap, ami a hibás vagy szándékosan
eltúlzott tartomány ellen véd.

### Értesítések

A döntésről a kérelmezőnek tudomást kell szereznie. Enélkül a folyamat
felemás marad: a vezető dönt, a dolgozó viszont csak akkor értesül róla, ha
magától megnyitja a megfelelő nézetet. Egy héttel korábban elutasított kérelem
így észrevétlen maradhat.

Az értesítés ezért tárolt bejegyzés, nem múló üzenet: visszamenőleg is
megtekinthető, és a rendszer külön jelöli, mi az, ami még olvasatlan.

A megvalósítás lényeges eleme, hogy az értesítést nem a vezetői felület hozza
létre, hanem adatbázis-esemény. Ha a felület felelne érte, akkor minden más
úton született döntés — közvetlen adatbázis-művelet, tömeges jóváhagyás vagy
egy későbbi felület — értesítés nélkül maradna. Az adatbázisban elhelyezett
szabály ezzel szemben minden útvonalra egyaránt érvényes [9].

Az eseménykezelő megvalósítása egy további, nem nyilvánvaló kérdést vetett fel.
Egy kéthetes szabadság tíz napi bejegyzést jelent, amelyekről a vezető egyetlen
művelettel dönt. A soronként lefutó eseménykezelő ilyenkor tíz különálló
értesítést hozna létre ugyanarról a döntésről. A megoldás az utasítás szintű
eseménykezelő, amely a PostgreSQL átmeneti tábláinak segítségével a teljes
módosításhalmazt egyszerre látja, és abból egyetlen, összevont értesítést állít
elő: az első és az utolsó érintett nappal, valamint a napok számával.

Az értesítés nem kész szöveget, hanem strukturált adatot tárol. Ennek indoka,
hogy a megfogalmazás a felület feladata: a nyelv és a megjelenítés formája ott
változhat, a tárolt tény viszont változatlan marad.

A megjelenítés a fejlécben elhelyezett harang ikonnal történik, amely
olvasatlan értesítés esetén jelölést és darabszámot kap. 

Az értesítések listája a teljes képernyőt elfoglalja, nem lebegő panelben
jelenik meg. Mobil képernyőn a lebegő panel a tartalom jelentős részét
eltakarná, a mögötte lévő felület pedig véletlen érintésre is reagálna. A
visszatérést ugyanaz a jelölés szolgálja, mint a vezetői felület menüjének
összecsukását, mivel az azonos jelentésű műveletekhez azonos jelölés
használata csökkenti a megtanulandó elemek számát.

## A vezetői felület

A vezetői felület a rendszer legösszetettebb alkalmazása: ez kezeli a
dolgozókat, a beállításokat és a kimutatásokat, és ez az egyetlen felület,
amelyhez hitelesített bejelentkezés szükséges. Az alábbiakban három olyan
része kerül bemutatásra, amely önálló műszaki döntést igényelt.

### Valós idejű állapotkövetés

A követelmények szerint a telephelyen tartózkodók listájának a beléptetés
pillanatában frissülnie kell. A kézenfekvő megoldás az időzített
újrakérdezés volna, amelynek során a felület rögzített időközönként ismét
lekérdezi az adatokat. Ez azonban rossz választásra kényszerít: a hosszú
időköz késleltetést okoz, a rövid pedig fölösleges terhelést. Az aránytalanság
szemléletes: egy tíz fős cégnél naponta nagyságrendileg húsz jelenléti esemény
keletkezik, percenkénti lekérdezés mellett viszont naponta több mint ezernégyszáz
kérés futna, amelyek túlnyomó többsége változatlan adatot adna vissza.

A megvalósítás ezért a Supabase valós idejű szolgáltatására épül, amely az
adatbázis írási naplóját figyeli, és a bekövetkezett változásokat állandó
kapcsolaton keresztül továbbítja a feliratkozott klienseknek [14]. A felület a
jelenléti események táblájának beszúrásaira iratkozik fel, így az értesítés
nem a kliens kérdezésére, hanem a tényleges adatváltozásra érkezik.

Egy tervezési döntés külön indoklást érdemel. Az értesítés megérkezésekor a
felület nem az érkezett sort illeszti be a helyben tárolt állapotba, hanem
újratölti a nézethez tartozó adatokat. A növekményes beillesztés kétségkívül
gyorsabb volna, ám meg kellene ismételnie mindazt a származtatást, amelyet a
teljes betöltés elvégez: a napi ledolgozott idő számítását, a késés
megállapítását és a bent tartózkodás eldöntését. Két, egymástól függetlenül
karbantartott számítás előbb-utóbb eltér egymástól, az ebből fakadó
következetlenség pedig — mivel csak bizonyos sorrendű események után
jelentkezik — nehezen vehető észre. A teljes újratöltés költsége ehhez képest
elhanyagolható, éppen azért, mert a kiváltó esemény ritka.

A feliratkozás a nézet megszűnésekor bontásra kerül. Ennek elmulasztása
lapváltásonként új kapcsolatot hagyna hátra, ami hosszabb használat során a
kliens és a szolgáltatás oldalán is felhalmozódna.

### Kimutatások és exportálás

A kimutatások két, egymást kiegészítő nézetből állnak: egy kiválasztott dolgozó
időszaki elemzéséből és a teljes létszámra vonatkozó havi összesítőből. Az
elemző nézet a 3. ábrán látható.

![A vezetői felület statisztikai nézete](statisztika.png)

Az elemzés vizsgált időszaka hét nap, harminc nap vagy három hónap lehet. A
megjelenítés a hosszhoz igazodik: a rövidebb időszakok napi bontásban
jelennek meg, a háromhavi nézet viszont heti összevonásban, mivel kilencven
egymás melletti oszlop áttekinthetetlen volna. Ez a döntés jól szemlélteti,
hogy az adat és a megjelenítése nem ugyanaz: az alapadat mindkét esetben napi
bontású, csupán az összegzés mértéke tér el.

A megjelenített mutatók a ledolgozott idő, a munkanapok és a jelenléti napok
száma, a késések száma, az átlagos érkezési időpont, valamint a hiányzások
igazolt és igazolatlan bontásban. Ezek mellett minden mutatóhoz megjelenik az
előző, azonos hosszúságú időszakhoz mért változás. Ez utóbbi nem díszítés: az
abszolút szám önmagában nehezen értelmezhető, mivel a százötven ledolgozott óra
attól függően sok vagy kevés, hogy mihez viszonyítjuk. A késés megállapítása a
cég beállított munkakezdési idejéhez és a hozzá tartozó türelmi időhöz
viszonyítva történik, tehát a mutató cégenként eltérő küszöbbel dolgozik.

Az adatok kivitele két formátumban lehetséges. A vezetőnek gyakran nem a
felület a célja, hanem maga az adat, amelyet a bérszámfejtésben használ fel; a
kimutatás ezért nem zárt rendszer. Az egyszerűbb formátum a vesszővel tagolt
szövegfájl, amelynek használatakor egy gyakorlati részlet igényel figyelmet: a
magyar nyelvű, ékezetes tartalmat a táblázatkezelők gyakran hibás
karakterkódolással nyitják meg, ha a fájl nem jelzi kifejezetten a kódolást.
A rendszer ezért az állomány elejére bájtsorrend-jelet helyez. A másik
formátum a táblázatkezelők natív állománya, amely a szöveges változattal
szemben megőrzi az értékek típusát is.

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
épül [10].

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
hangvételű, de megalapozatlan állítást is előállíthat [11]. A jelen
alkalmazásban ez akkor
jelentkezne, ha a modell olyan következtetést fogalmazna meg — például a
munkavégzés minőségéről vagy a késések okáról —, amely a kapott adatokból nem
következik. Az utasítás ezt tiltja, a generálás alacsonyra állított
véletlenszerűsége pedig szűkíti a megfogalmazás szabadságát. A kockázat ezzel
csökken, de nem szűnik meg, ezért az összefoglaló a felületen kiegészítő
információként, nem pedig döntés alapjaként jelenik meg.

A hívás nem a böngészőből, hanem szerveroldali függvényből indul. Ennek oka,
hogy a szolgáltatás hozzáférési kulcsa a kliensbe kerülve bárki számára
kiolvashatóvá és a cég nevében felhasználhatóvá válna; a kulcs ezért
kizárólag szerveroldali titokként tárolódik. A függvény emellett ellenőrzi a
hívó jogosultságát is: az összefoglaló csak vezetői vagy rendszergazdai
szerepkörrel kérhető le.

A külső szolgáltatásra épülő megoldás hibakezelése a fejlesztés során külön
tanulsággal szolgált. A szolgáltatás kezdetben minden kérést kvótatúllépésre
hivatkozva utasított el, jóllehet a beállított modellhez a szolgáltató
tájékoztatása szerint tartozott ingyenes keret. Az ok mindaddig rejtve maradt,
amíg a szerveroldali függvény a hibát saját, általános üzenetre cserélte. A
válasz eredeti szövegének továbbításakor derült ki, hogy az adott modellhez
ehhez az előfizetéshez ténylegesen nem tartozott felhasználható keret; a
megoldás egy másik modell beállítása volt. A tanulság általánosítható: a külső
szolgáltatás hibaüzenetét nem célszerű elnyelni, mert éppen az az információ
vész el, amely a hiba okára mutat.

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
bizonyult elégtelennek. Az első nyilvánvaló: a cégek eltérő időben végeznek, egy
közös időpont tehát vagy túl korán zárná le a még dolgozókat, vagy fölöslegesen
későn zárná a már távozottakat. A második ok kevésbé szembetűnő. Az ütemezés
egyezményes világidőben történik, a beállított óra viszont helyi idő szerint
értendő. A két időszámítás közötti eltérés a nyári időszámítás miatt évente
kétszer megváltozik, tehát egy fix időpontra rögzített művelet fél évig egy
órával elcsúszva futna.

A megvalósítás ezért óránként fut le, és minden futáskor összeveti az aktuális
helyi órát a beállítottal. Az időzóna-átváltás ezzel az adatbázisra hárul,
amely a nyári és téli időszámítás váltásának szabályait ismeri, és így a
művelet mindkét időszakban a szándékolt helyi órában megy végbe.

A beállítás a fejlesztés során tovább finomodott. Egyetlen cégszintű óra
ugyanis csak akkor elegendő, ha mindenki azonos műszakban dolgozik: a reggel
hatkor végző éjszakás és a délután kettőkor végző nappali műszak közös órával
nem kezelhető. A cég ezért műszaknevekhez rendelhet órát; amelyik műszak nem
szerepel a hozzárendelésben, arra a cég alapértelmezett órája marad érvényben.
Ez a megoldás visszafelé is működőképes: a korábban beállított érték
változatlanul érvényes, és a műszak nélküli dolgozók is kezelve maradnak.

A hozzárendelés szabadon szerkeszthető szerkezetben tárolódik, ezért érvénytelen
érték is bekerülhet. Ennek kezelése azért lényeges, mert egyetlen lekérdezés
zárja le valamennyi cég nyitott bejegyzését: ha az átalakítás hibára futna, nem
csupán az érintett műszak, hanem minden cég automatikus kiléptetése elmaradna.
A megvalósítás ezért mintaillesztéssel előszűri az értéket, és a nem szám alakú
bejegyzést az alapértelmezésre cseréli. A hiba hatóköre így egyetlen műszakra
korlátozódik, és ott is működőképes viselkedésre esik vissza.

Az így létrejött kilépés megjegyzést kap, a vezetői felület pedig külön
jelöléssel különbözteti meg a valódi kártyaérintéstől. Ez azért szükséges, mert
az automatikus zárás nem a tényleges távozás időpontját rögzíti, hanem a
beállított órát; a két adat összemosása téves következtetésekhez vezetne. A
művelet emellett csak a huszonnégy óránál nem régebbi nyitott bejegyzéseket
zárja le, mivel egy ennél régebbi bejegyzés már nem az adott naphoz tartozik, és
utólagos lezárása valótlan munkaidőt keletkeztetne.

### Napi jelenléti összesítő

A második automatizált folyamat naponta egyszer elektronikus levelet küld a cég
vezetőinek, amely három csoportban foglalja össze a napot: a jelen lévők
érkezési idővel és a késés jelölésével, az igazolt hiányzók a távollét
típusával, végül azok, akik nem jelentkeztek be. A levél formájának
megválasztása tudatos: a vezető nem feltétlenül nyitja meg naponta a felületet,
az elektronikus levél viszont a meglévő munkafolyamatába illeszkedik.

Az ütemezett feladat magát az összesítőt nem állítja elő, csupán elindítja az
erre szolgáló szerveroldali függvényt. Ez a szétválasztás két előnnyel jár. A
levél összeállítása és a levelezőszolgáltatás hívása alkalmazáslogika, amelynek
adatbázis-eljárásba helyezése nehezen karbantartható megoldás volna. Ezen túl
ugyanaz a kód kézzel is elindítható a beállítások lapról, ami a tesztelést
lényegesen egyszerűbbé teszi: az összesítő működése nem csak a következő
ütemezett lefutáskor ellenőrizhető.

## Tesztelés és eredmények

<!-- ~700 szó — ez emeli meg a dolgozat színvonalát:
       - az automatizált egységtesztek (offline sor, szinkronizáció,
         időzóna-kezelés, munkaidő-számítás) és mit igazoltak
       - a kézi, eszközön végzett tesztek forgatókönyvei
       - a fejlesztés során feltárt és javított hibák bemutatása
         (pl. a szolgáltatásfeldolgozó nem tárolt semmit, ezért hálózat
         nélküli újratöltéskor az alkalmazás nem indult el)
       - mérési eredmények: válaszidők, offline szinkronizáció helyessége
     Táblázat-példa (a felirat a táblázat FÖLÉ kerül):
     @@TABLE A tesztesetek és eredményeik összefoglalása -->

## A megoldás korlátai

<!-- ~300 szó: őszinte számvetés. Web NFC csak Android/Chrome alatt;
     a determinisztikus PIN-hash kompromisszuma; a vezetői felület
     asztali eszközre tervezett; az e-mail küldés tesztüzemben egy
     címre korlátozott. Ez nem gyengíti a dolgozatot — a korlátok
     ismerete szakmai érettséget mutat. -->
