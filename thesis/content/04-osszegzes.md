<!-- ===========================================================================
     4. ÖSSZEGZÉS
     Előírás: a kitűzött célok teljesülésének bizonyítása. Ha valamit nem
     sikerült megvalósítani, azt INDOKOLNI kell. Végül a továbbfejlesztési
     lehetőségek. Terjedelem: ~600–800 szó.
     Nem számít bele a 2.+3. fejezet szókvótájába.
     =========================================================================== -->

# Összegzés

A dolgozat egy NFC-alapú jelenléti nyilvántartó rendszer tervezését és
megvalósítását mutatta be. Az alábbiakban az 1.2. alfejezetben kitűzött célok
teljesülésének értékelése következik.

**Az első cél a kártyás beléptetés webes megvalósítása volt**, célhardver és
telepítés nélkül. Ez teljesült: a beléptető alkalmazás böngészőben fut, a
kártya kiolvasását a Web NFC felület végzi, a dolgozónak pedig a kártya
odaérintésén kívül semmit nem kell tennie. A művelet irányát a rendszer a
korábbi események alapján maga állapítja meg, a visszajelzés pedig több méter
távolságból is értelmezhető. A megoldás ára a 3.9. alfejezetben tárgyalt
platformfüggőség: a kártyaolvasás jelenleg csak Android rendszeren érhető el.

**A második cél több cég kiszolgálása volt egyetlen rendszerpéldányon**, oly
módon, hogy az adatok elkülönítése ne az alkalmazáskód helyességén múljon. Ez
adatbázis szintű hozzáférés-szabályozással valósult meg: a szűrés nem a
lekérdezésekben, hanem az adatbázisban él, így egyetlen elfelejtett feltétel
sem vezethet másik cég adatainak megjelenéséhez. A cégazonosító minden esetben
a hívó saját adataiból származik, sosem a kliens küldi.

**A harmadik cél a hálózatfüggetlen működés volt.** A beléptető alkalmazás
kapcsolat nélkül is elindul, a kártyát helyben tárolt névjegyzékből ismeri fel,
az eseményeket sorba állítja, és a kapcsolat helyreállásakor továbbítja. Az
ismétlés kizárását nem a kliens, hanem a szerver oldali egyediségi megkötés
biztosítja, mivel a küldés megismétlődhet anélkül, hogy a kliens erről tudna. A
cél megvalósítása során feltárt hiba — az alkalmazás hálózat nélküli
újratöltésének sikertelensége — javításra került, és a 3.8. alfejezetben
bemutatásra is.

**A negyedik cél a visszaélés elleni védelem volt.** A kártya átadásával
elkövethető helyettesítés ellen a belépéskor készített fényképfelvétel véd,
amely cégenként és azonosítási módonként külön kapcsolható. Fontos rögzíteni,
hogy ez nem megelőzés, hanem utólagos ellenőrizhetőség; a megelőzésre alkalmas
biometrikus azonosítás adatvédelmi következményei miatt tudatosan nem került
megvalósításra. Az otthon felejtett kártya esetére a PIN-alapú tartalék belépés
szolgál, amelynek biztonsági kompromisszuma a dolgozatban nyíltan kimondásra
került.

**Az ötödik cél a vezetői funkciók és az automatizált műveletek köre volt.** A
vezetői felület valós időben követi a telephelyen tartózkodók listáját,
időszakos kimutatásokat és havi összesítőt készít, az adatokat táblázatkezelőbe
viszi ki, és nyelvi modell segítségével szöveges értékelést állít elő a
számokból. A távollét-kérelmek jóváhagyási folyamata a beküldéstől az indokolt
elutasításig végigkövethető, a döntésről szóló értesítést pedig
adatbázis-esemény hozza létre, tehát a felület megkerülésével sem maradhat el.
Az automatizált műveletek — a nyitva maradt napok műszakonként beállítható
lezárása és a napi összesítő levél — ütemezetten, beavatkozás nélkül futnak.

A kitűzött célok tehát teljesültek. A megvalósítás során ugyanakkor két
elképzelés felülvizsgálatra szorult. Az eredeti terv szerint a dolgozó a saját
telefonját érintette volna a beléptető eszközhöz; erről a tervezés korai
szakaszában kiderült, hogy webes technológiával nem valósítható meg, mivel a
kártyaemuláció böngészőből nem érhető el. A dolgozói alkalmazás szerepe emiatt
önkiszolgáló felületté fogalmazódott át. A második változás a távollét
kezelését érintette: a kezdeti megoldásban a bejelentés azonnal ténnyé vált,
ami a valós folyamattal ellentétes, ezért a kérelem és a döntés szétválasztásra
került.

## Továbbfejlesztési lehetőségek

A rendszer több irányban fejleszthető tovább. A legkézenfekvőbb a saját
tartomány hitelesítése az elektronikus levelek küldéséhez, amely feloldaná a
jelenlegi címkorlátozást. Indokolt lehet továbbá a beléptető végpont önálló
kulccsal való védelme, mivel az jelenleg hitelesítés nélkül hívható — amit a
kártya nélküli használhatatlansága ellensúlyoz, de nem szüntet meg.

Tartalmi bővítést jelentene a napi összesítő kiterjesztése az éjszakai
műszakra, amelynek munkanapja két naptári napot érint, valamint a
munkaidőkeret és a túlóra nyilvántartása, amely a bérszámfejtéshez közelebb
vinné a rendszert. A dolgozói alkalmazás a jelenlegi webes formában is
telepíthető, natív változata azonban lehetővé tenné az iOS-támogatást és a
rendszerszintű értesítéseket.

Végül érdemes megemlíteni a mesterséges intelligencia alapú összefoglaló
kiterjesztésének lehetőségét a teljes létszámra vonatkozó, havi szintű
elemzésre. Ennek feltétele az adattakarékosság jelenlegi szintjének megtartása:
a modell ekkor sem kaphat személyazonosításra alkalmas adatot.
