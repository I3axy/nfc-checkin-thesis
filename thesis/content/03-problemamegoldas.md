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
úgy, hogy az értesítés **visszamenőleg is megtekinthető** maradjon: a dolgozó
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
megvalósítást ír elő. Másrészt a rendelkezésre álló fejlesztői kapacitás egyetlen
személy, ezért az olyan megoldások kerültek előnybe, amelyek a járulékos
üzemeltetési munkát a lehető legkisebbre szorítják.

**A felhasználói felület** React könyvtárral készült. A választás fő indoka,
hogy a rendszer állapota folyamatosan változik — érkezik egy új esemény, lezárul
egy nap, megszületik egy döntés —, és a React deklaratív megközelítése éppen az
ilyen, állapotvezérelt felületekhez való: a megjelenítés az adatból következik,
nem külön léptetett műveletekből. Ehhez járul, hogy a három alkalmazás közös
megjelenítési elemeket használ, amelyek komponensként egyszer írhatók meg.

Az építőeszköz a Vite, amely fejlesztés közben natív ES-modulokat szolgál ki,
így a módosítás és a böngészőben megjelenő eredmény között eltelt idő
számottevően rövidebb, mint a korábbi, teljes csomagolást végző eszközöknél. Ez
NFC-vel dolgozva külön előny, mivel a hibakeresés valódi eszközön, ismételt
kártyaérintésekkel történik.

**A háttérrendszer** a Supabase szolgáltatáscsomagra épül, amelynek alapja a
PostgreSQL adatbázis-kezelő. A döntés lényege nem a kényelem, hanem az, hogy a
szolgáltatás nem rejti el az adatbázist: közvetlen SQL-hozzáférés áll
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

A választások közös vonása, hogy mindegyik esetben egy meglévő, széles körben
használt megoldás került átvételre saját fejlesztés helyett. Egy szakdolgozat
keretei között a szakmai érték nem ezek újraírásában, hanem helyes
összeillesztésükben és a köztük lévő határok pontos meghúzásában rejlik.

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

Két egyediségi megkötés érdemel figyelmet. A kártyaazonosító **cégen belül**
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

Fontos kiemelni, hogy a beléptető és a dolgozói alkalmazás **nem ezen az úton**
fér az adatokhoz. Ezek az alkalmazások nem rendelkeznek bejelentkezett
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
elsődleges kulcsa **független** a hitelesítési rendszer felhasználó-azonosítójától.
Ez a döntés nem a tervezőasztalon született, hanem a fejlesztés közben, egy
hibából kiindulva.

Az eredeti séma a profil azonosítóját közvetlenül a hitelesítési rendszer
felhasználójához kötötte, ahogyan azt a szolgáltatás mintapéldái is javasolják.
A megoldás a vezetőknél működött, a dolgozók felvételénél viszont hibára
futott: minden új dolgozóhoz belépési fiókot kellett volna létrehozni, amivel az
azonosító a hivatkozási megkötést sértette.

A hiba mögött fogalmi ellentmondás állt. A rendszerben ugyanis **a dolgozónak
nincs és nem is lehet belépési fiókja**: az azonosítást a kártya végzi, nem
felhasználónév és jelszó. Egy fiók létrehozása elektronikus levélcímet
igényelne, ami fizikai munkakörökben gyakran nem áll rendelkezésre, és
felesleges személyes adatot is kezelne. A hitelesítési fiókhoz kötött séma
tehát olyan feltételt támasztott, amely a rendszer működési modelljével
ellentétes.

A megoldás a két fogalom szétválasztása lett. A profil önálló, saját azonosítót
kap, és egy **kitölthető, de nem kötelező** mező köti — ha van ilyen — a
hitelesítési rendszer felhasználójához. Ezt a mezőt kizárólag a vezetők és az
adminisztrátorok sora tölti ki; a dolgozóknál, a látogatóknál üresen marad.

A megoldás következménye, hogy a jogosultsági szabályok nem közvetlenül a
munkamenet azonosítójával dolgoznak, hanem azon keresztül keresik meg a
profilt. Ezt végzik a korábban bemutatott segédfüggvények. A kerülőút ára egy
további lekérdezés, haszna viszont az, hogy a személy és a belépési mód
egymástól függetlenül kezelhető: egy dolgozó később vezetővé léptethető pusztán
azzal, hogy a profilja fiókhoz kapcsolódik, és a hozzá tartozó jelenléti előzmény
érintetlen marad.

Ez a döntés jól szemlélteti, hogy a szolgáltatások dokumentációjában szereplő
minták egy tipikus felhasználási módra készülnek. Amennyiben a rendszer
működési modellje ettől eltér — jelen esetben azzal, hogy a felhasználók
többsége soha nem jelentkezik be —, a mintát nem átvenni, hanem a saját
követelményekhez igazítani kell.

## A beléptető alkalmazás

### Az NFC-kártya olvasása

<!-- ~400 szó: Web NFC API, NDEFReader, a serialNumber kiolvasása,
     az UID egységesítése (nagybetűsítés, elválasztók eltávolítása) és hogy
     miért kritikus ez a kliens és a szerver oldalon egyformán. -->

### A be- és kiléptetés logikája

<!-- ~400 szó: az utolsó esemény alapján váltakozó irány, a duplikáció-szűrés
     (30 másodperces ablak), a visszajelzés kialakítása (teljes képernyős
     színkód, hogy több méterről is olvasható legyen). -->

### Fényképes ellenőrzés

<!-- ~400 szó: a visszaélés elleni védelem. A kétlépéses folyamat indoklása:
     a szerver előbb jelzi, hogy fénykép szükséges, és csak a fényképpel
     érkező második kéréskor jön létre az esemény — így nem keletkezik
     félbehagyott bejegyzés. A képek zárt tárolóban, aláírt URL-lel. -->

### Offline működés

<!-- ~900 szó — ez a dolgozat egyik legerősebb műszaki fejezete.
     Alfejezetei:
       - a probléma: hálózatkimaradáskor a beléptetés teljesen leállna
       - helyi névjegyzék (roster) gyorsítótárazása, hogy offline is
         felismerhető legyen a kártya és eldönthető a be/ki irány
       - műveleti sor IndexedDB-ben, az eredeti időbélyeggel
       - idempotens visszajátszás: kliens által generált azonosító és
         egyedi index az adatbázisban -> az ismételt küldés sem duplikál
       - a szolgáltatásfeldolgozó (service worker) szerepe: az alkalmazásnak
         hálózat nélkül is el kell indulnia újratöltés után
       - a szinkronizáció hibakezelése: átmeneti vs. végleges hiba -->

### PIN-alapú tartalék belépés

<!-- ~400 szó: elfelejtett kártya esete. A PIN-t érték szerint kell
     visszakeresni, ezért nem használható véletlen sóval képzett hash;
     helyette cégre sózott, determinisztikus SHA-256. Ennek biztonsági
     következményei és a mérséklés (egyediségi megkötés, külön fénykép-
     kényszer, mert a PIN megosztható). -->

## A dolgozói alkalmazás

<!-- ~600 szó. A tartalom a fejlesztés során bővült, ezért a vázlat frissült:
       - PIN-alapú azonosítás; miért nem a kártya, és miért fontos, hogy
         munkahelytől függetlenül működjön
       - a felület három nézete (mai nap, napló egy hét / egy hónap
         bontásban, hiányzások)
       - a távollét-kérelem életciklusa: beküldés -> elbírálás -> jóváhagyás
         vagy indokolt elutasítás; a kérelem visszavonása az elbírálásig
       - értesítések: a döntést adatbázis-esemény (trigger) rögzíti, nem a
         vezetői felület, ezért nem lehet elfelejteni; utasítás szintű, hogy
         egy több napra szóló döntésről EGY értesítés szóljon. Az értesítés
         tárolt bejegyzés (olvasottság-jelöléssel), nem múló üzenet.
       - a tartomány napokra bontása a SZERVEREN, és miért nem a kliensen
       - tétlenségi kiléptetés: a képernyő személyes adatot mutat -->

## A vezetői felület

### Valós idejű állapotkövetés

<!-- ~300 szó: a Realtime feliratkozás, azonnali frissülés check-inkor. -->

### Kimutatások és exportálás

<!-- ~500 szó: időszakos elemzés, havi összesítő, Excel-export.
     Képernyőkép ide: -->

![A vezetői felület statisztikai nézete](statisztika.png)

### Mesterséges intelligencia alapú összefoglaló

<!-- ~500 szó: a kiválasztott dolgozó adott időszaki teljesítményének
     természetes nyelvű összefoglalása. Mit küld a rendszer a modellnek
     (aggregált számok, nem személyes azonosítók), hogyan épül fel a prompt,
     és hogyan kezeli a rendszer a hibát/késleltetést. -->

## Automatizált folyamatok

<!-- ~500 szó: ütemezett feladatok (pg_cron):
       - automatikus kiléptetés a cég által beállított órában, helyi
         időzóna szerint (nyári/téli időszámítás kezelése)
       - napi jelenléti összesítő e-mail a vezetőknek -->

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
