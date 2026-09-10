<!-- ===========================================================================
     1. BEVEZETŐ
     Előírás: a bevezető fejezet NE legyen hosszabb másfél oldalnál (~500 szó).
     Nem számít bele a 7000–10 000 szavas kvótába (az a 2. és 3. fejezetre él).
     STÍLUS — AZ EGÉSZ DOLGOZATRA ÉRVÉNYES:
     A sablon szó szerint előírja: "A szakdolgozat írásakor javasolt a szenvedő
     igealak használata, mint pl. »megcsinálták«, »megmutatták«."
     Ebből következően E/1 alak (törekszem, elvetettem, megvalósítottam) NEM
     használható. Helyette személytelen szerkezet: "megvalósításra került",
     "a döntés indoka az volt", "az elemzésből következik".
     =========================================================================== -->

# Bevezető

A munkaidő nyilvántartása minden foglalkoztatót érintő, jogszabályban előírt
kötelezettség, elvégzésének módja azonban máig sokféle. A kisebb vállalkozások
jelentős része továbbra is papíralapú jelenléti ívet vezet, míg a nagyobb
szervezetek zárt, célhardverre épülő beléptető rendszereket üzemeltetnek. A két
megoldás között széles rés húzódik: az első olcsó, de megbízhatatlan, a második
megbízható, de költséges és nehezen alakítható.

A rés áthidalására kínál lehetőséget a rövid hatótávolságú kommunikáció, amely
a mindennapi érintéses fizetés elterjedésével ismerőssé vált, és amelyet az
újabb mobiltelefonok külön eszköz nélkül támogatnak. A dolgozat tárgya egy
olyan jelenléti nyilvántartó rendszer, amely ezt a technológiát webes
alkalmazásként teszi használhatóvá, tehát telepítés és célhardver nélkül.

## A probléma leírása

A kézzel vezetett jelenléti ív legfőbb gyengesége, hogy utólag módosítható, és
a bejegyzés valódisága nem ellenőrizhető. A hónap végén pótolt aláírások a
gyakorlatban nem mérést, hanem emlékezetet rögzítenek, ami vitás esetben —
például túlóra elszámolásakor — egyik felet sem védi meg.

A meglévő elektronikus rendszerek ezt a problémát megoldják, más nehézségeket
azonban felvetnek. Beszerzésük jellemzően célhardvert igényel, üzemeltetésük
folyamatos költséggel jár, testreszabásuk pedig a szállítótól függ. Ezen felül
egy részük egyetlen szervezet kiszolgálására készült, így több telephely vagy
több cég párhuzamos kezelése külön példányok üzemeltetését kívánja meg.

Külön kérdés a hálózati kapcsolat. A beléptetés helye — csarnokbejárat,
telephelykapu, építési terület — gyakran éppen ott van, ahol a lefedettség a
leggyengébb. Amennyiben a rendszer működése kapcsolatfüggő, egy néhány perces
kimaradás is elveszett munkaidő-adatot jelent, a dolgozók pedig sorban állnak
a bejáratnál.

Végül a kártyaalapú azonosítás sajátos visszaélési lehetőséget hordoz: a kártya
átadható egy kollégának, aki így a távollévő helyett rögzíti az érkezést. A
jelenség nemzetközi szakirodalomban is dokumentált, kezelése nélkül pedig az
elektronikus nyilvántartás pontossága látszólagos marad.

@@PAGEBREAK

## A szakdolgozat céljai

A dolgozat célja egy olyan rendszer megtervezése és megvalósítása, amely a fenti
problémákra ad választ. A kitűzött célok a következők:

1. NFC-kártyás beléptetés megvalósítása webes alkalmazásként, célhardver és telepítés nélkül, olyan felhasználói folyamattal, amely a dolgozótól egyetlen mozdulaton kívül semmit nem kíván.
2. Több cég adatainak kiszolgálása egyetlen rendszerpéldányon úgy, hogy az adatok elkülönítése ne az alkalmazáskód helyességén múljon.
3. Hálózatfüggetlen működés: a beléptetésnek kapcsolat nélkül is működnie kell, a tárolt eseményeknek pedig a kapcsolat helyreállásakor ismétlés nélkül kell továbbítódniuk.
4. Védekezés a kártya átadásával elkövethető visszaélés ellen, valamint tartalék azonosítási mód biztosítása az otthon felejtett kártya esetére.
5. Vezetői kimutatások, a távollét-kérelmek jóváhagyási folyamata, valamint felhasználói beavatkozást nem igénylő, automatizált napi műveletek megvalósítása.

A dolgozat felépítése ezt a gondolatmenetet követi. A 2. fejezet a téma
szakirodalmi hátterét tekinti át, a 3. fejezet a megvalósított rendszert és a
mögötte álló döntéseket mutatja be, a 4. fejezet pedig a célok teljesülését
értékeli.
