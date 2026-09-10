# -*- coding: utf-8 -*-
"""
Védési bemutató:  python prezentacio.py  ->  out/prezentacio-minta.pptx

Miért generált, és nem kézzel szerkesztett: ugyanaz az elv, mint a dolgozatnál
— a tartalom egy helyen él, a formázás egy helyen dől el, így egy javítás egy
sor átírása, nem húsz dia kézi igazgatása.

Megjelenés: fehér háttér, a főiskola logójának kékje mint egyetlen
kiemelőszín, Cambria címek és Calibri szöveg — ugyanaz a betűpár, mint a
dolgozatban, és minden Office-os gépen megvan.

Animáció: diaváltáskor áttűnés, a diákon belül kattintásra előtűnő elemek.
Kizárólag „áttűnés" (fade) típusú effektus kerül bele, mert az PowerPointban
és LibreOffice-ban is ugyanúgy működik. A python-pptx animációt nem kezel,
ezért az időzítés (p:timing) nyers XML-ként kerül a diára.
"""
import datetime
import io
import os
import re
import zipfile

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIG = os.path.join(HERE, 'figures')
OUT = os.path.join(HERE, 'out', 'prezentacio-minta.pptx')
# A logó a borítólap sablonjából jön, nem külön fájlból: így pontosan az a
# kép, amelyet a főiskola maga használ.
KORICE = os.path.join(ROOT, 'sablon', 'zavrsni_rad_korice_HU_09_02_2023.docx')


# ── Adatok: ugyanonnan, ahonnan a címlap és a borító ─────────────────────────
def _meta():
    src = open(os.path.join(HERE, 'meta.mjs'), encoding='utf8').read()
    get = lambda k: re.search(rf"\b{k}:\s*'([^']*)'", src).group(1)
    return {k: get(k) for k in ('titleHu', 'student', 'mentor', 'place', 'year')}


M = _meta()

# ── Színek és betűk ──────────────────────────────────────────────────────────
# A logó három kék raszteres keveréke (#666699, #336699, #333399); a képpontok
# arányával súlyozott átlaguk ~#404E91, ez a szemmel látott szín.
KEK = RGBColor(0x40, 0x4E, 0x91)
KEK_SOT = RGBColor(0x2E, 0x39, 0x72)
HALVANY = RGBColor(0xEE, 0xF0, 0xF7)
SZOVEG = RGBColor(0x22, 0x25, 0x2E)
HALK = RGBColor(0x5E, 0x62, 0x70)
VONAL = RGBColor(0xD5, 0xD8, 0xE3)
FEHER = RGBColor(0xFF, 0xFF, 0xFF)
FEHER_HALK = RGBColor(0xD9, 0xDD, 0xF0)     # másodlagos szöveg kék alapon
CIM_BETU = 'Cambria'
TORZS_BETU = 'Calibri'

SZ, MA = 13.333, 7.5          # 16:9, hüvelykben
BAL, JOBB = 0.7, 13.333 - 0.7


# ── Szöveg ───────────────────────────────────────────────────────────────────
def R(text, size, *, color=SZOVEG, bold=False, font=TORZS_BETU, spc=None):
    """Egy futam: szöveg a betűstílusával."""
    return (text, dict(size=size, color=color, bold=bold, font=font, spc=spc))


def PT(*runs, align=PP_ALIGN.LEFT, line=None, after=0, before=0):
    """Több futamból álló bekezdés — pl. eltérő méretű számok egy sorban."""
    return {'runs': list(runs), 'align': align, 'line': line, 'after': after, 'before': before}


def P(text, size, *, color=SZOVEG, bold=False, font=TORZS_BETU, spc=None,
      align=PP_ALIGN.LEFT, line=None, after=0, before=0):
    """Egyfutamos bekezdés leírása."""
    return PT(R(text, size, color=color, bold=bold, font=font, spc=spc),
              align=align, line=line, after=after, before=before)


def szoveg(hova, x, y, w, h, bekezdesek, anchor=MSO_ANCHOR.TOP):
    tb = hova.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for i, b in enumerate(bekezdesek):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = b['align']
        if b['line']:
            p.line_spacing = b['line']
        p.space_after, p.space_before = Pt(b['after']), Pt(b['before'])
        for text, st in b['runs']:
            r = p.add_run()
            r.text = text
            f = r.font
            f.name, f.size, f.bold = st['font'], Pt(st['size']), st['bold']
            f.color.rgb = st['color']
            rpr = r._r.get_or_add_rPr()
            # Magyar nyelvjelölés: enélkül a PowerPoint minden szót
            # helyesírási hibaként húzna alá a szerkesztőnézetben.
            rpr.set('lang', 'hu-HU')
            if st['spc'] is not None:
                rpr.set('spc', str(st['spc']))
    return tb


# ── Alakzatok és képek ───────────────────────────────────────────────────────
def teglalap(hova, x, y, w, h, szin, *, kerek=None, vonal=None, vastag=1.0, fedes=None):
    alak = MSO_SHAPE.ROUNDED_RECTANGLE if kerek else MSO_SHAPE.RECTANGLE
    s = hova.add_shape(alak, Inches(x), Inches(y), Inches(w), Inches(h))
    # A python-pptx az alakzatot a téma stílusára köti (p:style), amelyből a
    # LibreOffice árnyékot rajzol, a PowerPoint nem. A stílust eltávolítva a
    # kitöltés és a vonal kizárólag az itt megadott — mindkét programban
    # ugyanúgy néz ki.
    st = s._element.find(qn('p:style'))
    if st is not None:
        s._element.remove(st)
    if kerek:
        s.adjustments[0] = kerek
    if szin is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = szin
        if fedes is not None:
            clr = s._element.spPr.find(qn('a:solidFill')).find(qn('a:srgbClr'))
            etree.SubElement(clr, qn('a:alpha')).set('val', str(int(fedes * 100000)))
    if vonal is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = vonal
        s.line.width = Pt(vastag)
    return s


def kep(hova, nev, x, y, *, w=None, h=None, kerek=None, arnyek=False, vagas_alul=0.0):
    """Kép beillesztése torzítás nélkül.

    A vágás (srcRect) a keret méretét nem változtatja: ha csak levágnánk a
    kép alját, a maradék megnyúlna. Ezért a keret magassága a VÁGOTT
    képarányból számolódik.
    """
    ut = os.path.join(FIG, nev)
    kw, kh = Image.open(ut).size
    arany = kh * (1 - vagas_alul) / kw
    if w is not None:
        h = w * arany
    else:
        w = h / arany
    pic = hova.add_picture(ut, Inches(x), Inches(y), Inches(w), Inches(h))
    if vagas_alul:
        pic.crop_bottom = vagas_alul
    if kerek:
        geom = pic._element.spPr.find(qn('a:prstGeom'))
        geom.set('prst', 'roundRect')
        av = geom.find(qn('a:avLst'))
        if av is None:
            av = etree.SubElement(geom, qn('a:avLst'))
        gd = etree.SubElement(av, qn('a:gd'))
        gd.set('name', 'adj')
        gd.set('fmla', f'val {int(kerek * 100000)}')
    if arnyek:
        eff = etree.SubElement(pic._element.spPr, qn('a:effectLst'))
        sh = etree.SubElement(eff, qn('a:outerShdw'))
        for k, v in (('blurRad', Emu(Inches(0.28))), ('dist', Emu(Inches(0.07))),
                     ('dir', 5400000), ('algn', 't'), ('rotWithShape', 0)):
            sh.set(k, str(v))
        c = etree.SubElement(sh, qn('a:srgbClr'))
        c.set('val', '000000')
        etree.SubElement(c, qn('a:alpha')).set('val', '22000')
    return pic


# ── Dia-keret: fejléc, lábléc, jegyzet, áttűnés ──────────────────────────────
def uj_dia(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])      # üres elrendezés


def fejlec(s, felso, cim):
    szoveg(s.shapes, BAL, 0.55, JOBB - BAL, 0.3, [P(felso.upper(), 12, color=KEK, bold=True, spc=300)])
    szoveg(s.shapes, BAL, 0.85, JOBB - BAL, 0.8, [P(cim, 30, color=KEK_SOT, font=CIM_BETU)])


def lablec(s, n):
    teglalap(s.shapes, BAL, 6.95, JOBB - BAL, 0.012, VONAL)
    szoveg(s.shapes, JOBB - 1, 7.03, 1, 0.25, [P(str(n), 10, color=HALK, align=PP_ALIGN.RIGHT)])


def jegyzet(s, text):
    s.notes_slide.notes_text_frame.text = ' '.join(text.split())


def attunes(s):
    # A p:transition a p:clrMapOvr után áll; egy új diában az az utolsó elem.
    tr = etree.SubElement(s._element, qn('p:transition'))
    tr.set('spd', 'fast')                                   # ~0,5 mp
    etree.SubElement(tr, qn('p:fade'))


# ── Animáció ─────────────────────────────────────────────────────────────────
NS = ('xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"')


def animacio(s, lepesek, dur=450):
    """Kattintásonkénti áttűnés.

    lepesek: kattintásonként egy lista, elemei (alakzat, 'be' | 'ki'). Egy
    kattintáson belül az első elem indítja a lépést, a többi vele együtt fut.

    A szerkezet a PowerPoint saját kimenetét követi: a p:sp alakzatok
    csoportazonosítót (grpId) és build-bejegyzést kapnak — belépéshez 0,
    kilépéshez 1 —, a képek és csoportok nem, ahogy a PowerPoint is írja.
    """
    szam = iter(range(3, 100000))
    katt, bld = [], []
    for lepes in lepesek:
        kulso, belso = next(szam), next(szam)
        hatas = []
        for k, (alak, irany) in enumerate(lepes):
            spid = alak.shape_id
            node = 'clickEffect' if k == 0 else 'withEffect'
            sp = alak._element.tag == qn('p:sp')
            g = 0 if irany == 'be' else 1
            grp = f' grpId="{g}"' if sp else ''
            if sp and (spid, g) not in bld:
                bld.append((spid, g))
            tgt = f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
            lathato = '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>'
            a, b, c = next(szam), next(szam), next(szam)
            if irany == 'be':
                hatas.append(
                    f'<p:par><p:cTn id="{a}" presetID="10" presetClass="entr" presetSubtype="0" '
                    f'fill="hold"{grp} nodeType="{node}"><p:stCondLst><p:cond delay="0"/></p:stCondLst>'
                    f'<p:childTnLst>'
                    f'<p:set><p:cBhvr><p:cTn id="{b}" dur="1" fill="hold"><p:stCondLst>'
                    f'<p:cond delay="0"/></p:stCondLst></p:cTn>{tgt}{lathato}</p:cBhvr>'
                    f'<p:to><p:strVal val="visible"/></p:to></p:set>'
                    f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{c}" dur="{dur}"/>'
                    f'{tgt}</p:cBhvr></p:animEffect>'
                    f'</p:childTnLst></p:cTn></p:par>')
            else:
                hatas.append(
                    f'<p:par><p:cTn id="{a}" presetID="10" presetClass="exit" presetSubtype="0" '
                    f'fill="hold"{grp} nodeType="{node}"><p:stCondLst><p:cond delay="0"/></p:stCondLst>'
                    f'<p:childTnLst>'
                    f'<p:animEffect transition="out" filter="fade"><p:cBhvr><p:cTn id="{b}" dur="{dur}"/>'
                    f'{tgt}</p:cBhvr></p:animEffect>'
                    f'<p:set><p:cBhvr><p:cTn id="{c}" dur="1" fill="hold"><p:stCondLst>'
                    f'<p:cond delay="{dur - 1}"/></p:stCondLst></p:cTn>{tgt}{lathato}</p:cBhvr>'
                    f'<p:to><p:strVal val="hidden"/></p:to></p:set>'
                    f'</p:childTnLst></p:cTn></p:par>')
        katt.append(
            f'<p:par><p:cTn id="{kulso}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
            f'</p:stCondLst><p:childTnLst><p:par><p:cTn id="{belso}" fill="hold"><p:stCondLst>'
            f'<p:cond delay="0"/></p:stCondLst><p:childTnLst>' + ''.join(hatas) +
            '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    bldlst = ''.join(f'<p:bldP spid="{sp}" grpId="{g}" animBg="1"/>' for sp, g in bld)
    xml = (f'<p:timing {NS}><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" '
           f'nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek">'
           f'<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + ''.join(katt) +
           '</p:childTnLst></p:cTn>'
           '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>'
           '</p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/>'
           '</p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>'
           + (f'<p:bldLst>{bldlst}</p:bldLst>' if bldlst else '') + '</p:timing>')
    s._element.append(etree.fromstring(xml))


# ── 1. dia: címdia ───────────────────────────────────────────────────────────
def cimdia(prs):
    s = uj_dia(prs)
    logo = zipfile.ZipFile(KORICE).read('word/media/image1.png')
    s.shapes.add_picture(io.BytesIO(logo), Inches(BAL), Inches(0.6), height=Inches(0.72))

    szoveg(s.shapes, BAL, 2.0, 7.2, 0.3, [P('SZAKDOLGOZAT', 13, color=KEK, bold=True, spc=300)])
    szoveg(s.shapes, BAL, 2.4, 7.2, 1.95, [P(M['titleHu'], 34, color=KEK_SOT, font=CIM_BETU, line=1.02)])
    teglalap(s.shapes, BAL, 4.5, 1.1, 0.045, KEK)
    szoveg(s.shapes, BAL, 4.75, 7.2, 1.7, [
        P(M['student'], 20, bold=True, after=2),
        P(f"Mentor: {M['mentor']}", 15, color=HALK, after=14),
        P('Szabadkai Műszaki Szakfőiskola', 13, color=HALK),
        P(f"{M['place']}, {M['year']}", 13, color=HALK),
    ])

    # A két képernyő a beléptetés két állapota. Az átfedés csak akkora, hogy
    # az alapállapot felirata („Érintsd a kártyát") teljes egészében
    # olvasható maradjon. Az alsó sávot (a telefon navigációs csíkja)
    # levágjuk, mert az nem az alkalmazás része.
    kep(s.shapes, 'scanner-erints-a-kartyat.jpg', 8.3, 1.15, w=2.55,
        kerek=0.07, arnyek=True, vagas_alul=0.06)
    kep(s.shapes, 'belepett.jpg', 10.35, 1.75, w=2.55,
        kerek=0.07, arnyek=True, vagas_alul=0.06)

    attunes(s)
    jegyzet(s, f"""
        Jó napot kívánok! {M['student']} vagyok, a szakdolgozatom címe:
        {M['titleHu']}. Mentorom {M['mentor']}. A következő negyedórában egy
        olyan jelenléti nyilvántartó rendszert mutatok be, amelyben a dolgozó
        egyetlen kártyaérintéssel lép be és ki — ahogy a jobb oldali két
        képernyő mutatja —, telepítés és célhardver nélkül.""")
    return s


# ── 2. dia: a probléma ───────────────────────────────────────────────────────
def problema(prs, n):
    s = uj_dia(prs)
    fejlec(s, 'Bevezetés', 'A probléma')

    kartyak = [
        ('Utólag módosítható papír',
         'A hónap végén pótolt aláírás nem mérés, hanem emlékezet — vitás esetben egyik felet sem védi.'),
        ('Drága, zárt rendszerek',
         'Célhardver és folyamatos előfizetés; a testreszabás a szállítótól függ.'),
        ('Hálózatfüggés',
         'A beléptetés helyén — csarnok, telephelykapu — gyakran a leggyengébb a lefedettség.'),
        ('Átadható kártya',
         'A kolléga a távollévő helyett is beléptet; a nyilvántartás pontossága így csak látszólagos.'),
    ]
    res, y0 = 0.3, 1.9
    w, h = (JOBB - BAL - res) / 2, 2.05
    csoportok = []
    for i, (cim, leiras) in enumerate(kartyak):
        x = BAL + (i % 2) * (w + res)
        y = y0 + (i // 2) * (h + res)
        g = s.shapes.add_group_shape()
        teglalap(g.shapes, x, y, w, h, HALVANY)
        teglalap(g.shapes, x, y, 0.07, h, KEK)
        # A szám és a szöveg a kártya függőleges közepére igazodik, így a
        # rövidebb és hosszabb leírású kártyák egyformán kitöltöttnek hatnak.
        szoveg(g.shapes, x + 0.4, y, 0.6, h, [P(str(i + 1), 34, color=KEK, font=CIM_BETU)],
               anchor=MSO_ANCHOR.MIDDLE)
        szoveg(g.shapes, x + 1.05, y, w - 1.4, h,
               [P(cim, 21, bold=True, after=6), P(leiras, 16, color=HALK, line=1.1)],
               anchor=MSO_ANCHOR.MIDDLE)
        csoportok.append(g)

    lablec(s, n)
    attunes(s)
    animacio(s, [[(g, 'be')] for g in csoportok])
    jegyzet(s, """
        A kiindulópont négy probléma. Az első a papíralapú ív: utólag
        módosítható, és a hónap végén pótolt aláírás nem mérés, hanem
        emlékezet. A második, hogy a meglévő elektronikus rendszerek
        célhardvert és előfizetést igényelnek, a testreszabásuk pedig a
        szállítótól függ. A harmadik a hálózat: a beléptetés helyén gyakran
        éppen a leggyengébb a lefedettség, és egy kimaradás elveszett
        munkaidő-adatot jelent. A negyedik a kártyaátadás — a kolléga a
        távollévő helyett is beléptethet, így az elektronikus nyilvántartás
        pontossága csak látszólagos.""")
    return s


# ── 3. dia: célkitűzések ─────────────────────────────────────────────────────
def celok(prs, n):
    s = uj_dia(prs)
    fejlec(s, 'Bevezetés', 'Célkitűzések')

    # Az 1.2. alfejezet öt célja, ugyanabban a sorrendben — az összegző dián
    # ugyanez a lista tér vissza, a teljesülésükkel. A leírások egy sorosak:
    # két sornál a második gyakran egyetlen szó volna, ami rendetlennek hat.
    sorok = [
        ('Beléptetés egy érintéssel',
         'NFC-kártyás beléptetés webes alkalmazásként, célhardver és telepítés nélkül.'),
        ('Több cég, egy rendszer',
         'Az adatok elkülönítése nem az alkalmazáskód helyességén múlik.'),
        ('Hálózat nélkül is',
         'A tárolt események utólag, ismétlés nélkül jutnak el a szerverre.'),
        ('Védelem a visszaélés ellen',
         'Védekezés a kártyaátadás ellen; tartalék belépés, ha a kártya otthon marad.'),
        ('Vezetői funkciók',
         'Kimutatások, távollét-kérelmek elbírálása, automatikus napi műveletek.'),
    ]
    y0, rh = 1.85, 0.96
    tx, dx = BAL + 0.75, BAL + 4.7
    csoportok = []
    for i, (cim, leiras) in enumerate(sorok):
        y = y0 + i * rh
        g = s.shapes.add_group_shape()
        szoveg(g.shapes, BAL, y, 0.6, rh, [P(str(i + 1), 30, color=KEK, font=CIM_BETU)],
               anchor=MSO_ANCHOR.MIDDLE)
        szoveg(g.shapes, tx, y, dx - tx - 0.2, rh, [P(cim, 20, bold=True)],
               anchor=MSO_ANCHOR.MIDDLE)
        szoveg(g.shapes, dx, y, JOBB - dx, rh, [P(leiras, 16, color=HALK, line=1.1)],
               anchor=MSO_ANCHOR.MIDDLE)
        if i < len(sorok) - 1:
            teglalap(g.shapes, BAL, y + rh - 0.006, JOBB - BAL, 0.012, VONAL)
        csoportok.append(g)

    lablec(s, n)
    attunes(s)
    animacio(s, [[(g, 'be')] for g in csoportok])
    jegyzet(s, """
        Erre a négy problémára öt célt tűztem ki. [kattintás] Kártyás
        beléptetés webes alkalmazásként, célhardver és telepítés nélkül.
        [kattintás] Egy rendszerpéldány több céget szolgál ki, és az adatok
        elkülönítése nem az alkalmazáskód helyességén múlik. [kattintás] A
        beléptetés hálózat nélkül is működik, a tárolt események pedig
        utólag, ismétlés nélkül jutnak el a szerverre. [kattintás] Védekezés
        a kártyaátadás ellen, és tartalék belépés arra az esetre, ha a kártya
        otthon marad. [kattintás] Végül a vezetői oldal: kimutatások, a
        távollét-kérelmek elbírálása és automatikus napi műveletek. Az előadás
        végén ehhez az öt ponthoz térek vissza.""")
    return s


# ── 4. dia: miért NFC? ───────────────────────────────────────────────────────
def miert_nfc(prs, n):
    s = uj_dia(prs)
    fejlec(s, 'Szakirodalmi áttekintés', 'Miért NFC?')

    # Az 1. táblázat, a dolgozattal betű szerint azonos tartalommal.
    fej = ['Technológia', 'Hardverköltség', 'Másolhatóság', 'Mechanikai kopás', 'Adatvédelmi kockázat']
    sorok = [
        ['Vonalkód, QR-kód', 'alacsony', 'egyszerű (fénymásolat)', 'jelentős', 'alacsony'],
        ['Mágnescsík', 'közepes', 'egyszerű', 'jelentős', 'alacsony'],
        ['NFC', 'alacsony', 'eszközigényes', 'nincs', 'alacsony'],
        ['Biometria', 'magas', 'nem értelmezhető', 'nincs', 'magas (különleges adat)'],
    ]
    szel = [2.45, 2.05, 2.75, 2.15]
    szel.append(JOBB - BAL - sum(szel))
    xs = [BAL + sum(szel[:j]) for j in range(len(szel))]
    y0, fh, rh, belso = 1.8, 0.5, 0.62, 0.18

    # A kiemelés a szöveg előtt jön létre, tehát alatta rajzolódik: a halvány
    # kitöltés így nem színezi el a betűket.
    hy = y0 + fh + 2 * rh
    kiemeles = teglalap(s.shapes, BAL - 0.08, hy + 0.05, JOBB - BAL + 0.16, rh - 0.1,
                        KEK, kerek=0.12, vonal=KEK, vastag=2.5, fedes=0.10)

    for j, t in enumerate(fej):
        szoveg(s.shapes, xs[j] + belso, y0, szel[j] - belso, fh,
               [P(t, 13, color=HALK, bold=True)], anchor=MSO_ANCHOR.MIDDLE)
    teglalap(s.shapes, BAL, y0 + fh, JOBB - BAL, 0.02, KEK)
    for i, sor in enumerate(sorok):
        y = y0 + fh + i * rh
        for j, t in enumerate(sor):
            szoveg(s.shapes, xs[j] + belso, y, szel[j] - belso - 0.05, rh,
                   [P(t, 17 if j == 0 else 16, bold=(j == 0))], anchor=MSO_ANCHOR.MIDDLE)
        teglalap(s.shapes, BAL, y + rh, JOBB - BAL, 0.012, VONAL)

    ky, kh, res = 5.1, 1.55, 0.3
    kw = (JOBB - BAL - res) / 2
    kartyak = [
        ('Miért kedvező',
         'Olcsó, érintésmentes, nem kopik, és a mai telefonok jelentős részében van olvasó. '
         'A jellemzően 4 cm alatti hatótávolság miatt csak szándékos érintés regisztrál.'),
        ('A gyengesége',
         'Az azonosító önmagában nem titkos — a kártyaérintés mellé kiegészítő ellenőrzés kell.'),
    ]
    csoportok = []
    for i, (cim, t) in enumerate(kartyak):
        x = BAL + i * (kw + res)
        g = s.shapes.add_group_shape()
        teglalap(g.shapes, x, ky, kw, kh, HALVANY)
        teglalap(g.shapes, x, ky, 0.07, kh, KEK)
        szoveg(g.shapes, x + 0.4, ky, kw - 0.7, kh,
               [P(cim, 18, bold=True, after=4), P(t, 15, color=HALK, line=1.1)],
               anchor=MSO_ANCHOR.MIDDLE)
        csoportok.append(g)

    lablec(s, n)
    attunes(s)
    animacio(s, [[(kiemeles, 'be')], [(csoportok[0], 'be')], [(csoportok[1], 'be')]])
    jegyzet(s, """
        Az első tervezési kérdés az azonosítás módja volt. A táblázat a
        szakirodalmi áttekintésben összevetett négy technológiát mutatja.
        [kattintás] Az NFC sora mutatja, miért esett rá a választás.
        [kattintás] Olcsó, érintésmentes, így nem kopik, és a mai telefonok
        jelentős részében van olvasó. A rövid, jellemzően négy centiméter
        alatti hatótávolság azt biztosítja, hogy csak szándékos érintés
        regisztráljon, és a biometriával szemben nem jár különleges
        kategóriájú személyes adat kezelésével. [kattintás] A gyengesége, hogy
        az azonosító önmagában nem titkos — ezért a kártyaérintés mellé
        kiegészítő ellenőrzés kell; erre a fényképes ellenőrzésnél térek
        vissza.""")
    return s


# ── 5. dia: a kutatási rés ───────────────────────────────────────────────────
def kutatasi_res(prs, n):
    s = uj_dia(prs)
    fejlec(s, 'Szakirodalmi áttekintés', 'A kutatási rés')

    # Bal oldal: a [7] mérései (2.3. alfejezet). A régi érték halvány, az új
    # kék; a „~" a dolgozat „mintegy harminc másodperc" megfogalmazását követi.
    lx, ly, lw, lh = BAL, 1.85, 5.75, 3.35
    ix, iw = lx + 0.45, lw - 0.9
    bal = s.shapes.add_group_shape()
    teglalap(bal.shapes, lx, ly, lw, lh, HALVANY)
    szoveg(bal.shapes, ix, ly + 0.28, iw, 0.3,
           [P('EGY MEGVALÓSÍTOTT RENDSZER MÉRÉSEI', 12, color=KEK, bold=True, spc=200)])
    for y, regi, uj, cimke in (
            (ly + 0.6, '~30 mp', '2 mp', 'dolgozónként: az ív aláírása helyett kártyaolvasás'),
            (ly + 1.75, '50 perc', '50 mp', 'száz fő beléptetése')):
        szoveg(bal.shapes, ix, y, iw, 0.8, [PT(R(regi, 32, color=HALK, font=CIM_BETU),
                                               R('  →  ', 24, color=HALK),
                                               R(uj, 44, color=KEK, font=CIM_BETU))],
               anchor=MSO_ANCHOR.BOTTOM)
        szoveg(bal.shapes, ix, y + 0.84, iw, 0.3, [P(cimke, 14, color=HALK)])
    szoveg(bal.shapes, ix, ly + 3.0, iw, 0.25,
           [P('[7] Yeboah-Boateng és mtsai, IJESE, 2015', 11, color=HALK)])

    rx = lx + lw + 0.45
    jobb = s.shapes.add_group_shape()
    szoveg(jobb.shapes, rx, ly + 0.28, JOBB - rx, 0.3,
           [P('AMIT NYITVA HAGY', 12, color=KEK, bold=True, spc=200)])
    nyitott = [
        ('A kártya átadható',
         'A gyorsabb beléptetés önmagában nem teszi hitelesebbé a nyilvántartást.'),
        ('Egyetlen intézmény',
         'Több cég párhuzamos kiszolgálása fel sem merül.'),
    ]
    for i, (cim, t) in enumerate(nyitott):
        y = ly + 0.75 + i * 1.25
        teglalap(jobb.shapes, rx, y, 0.06, 0.95, KEK)
        szoveg(jobb.shapes, rx + 0.3, y, JOBB - rx - 0.3, 0.95,
               [P(cim, 19, bold=True, after=4), P(t, 15, color=HALK, line=1.1)],
               anchor=MSO_ANCHOR.MIDDLE)

    # Alul a következtetés (2.6.): az egyetlen telt kék felület a bevezető
    # részben, mert ez a dolgozat kiindulópontja. A megfogalmazás a dolgozat
    # óvatos állítását követi: „nem került elő", nem „nem létezik".
    by, bh = 5.45, 1.2
    also = s.shapes.add_group_shape()
    teglalap(also.shapes, BAL, by, JOBB - BAL, bh, KEK)
    szoveg(also.shapes, BAL + 0.45, by, JOBB - BAL - 0.9, bh, [
        P('Hálózat nélküli működés  ·  cégek elkülönítése  ·  visszaélés elleni védelem',
          19, color=FEHER, bold=True, after=4),
        P('Az áttekintett munkák ezeket külön tárgyalják; nem került elő olyan megoldás, '
          'amely a hármat egyetlen, célhardver nélküli rendszerben egyesítené.',
          15, color=FEHER_HALK, line=1.1),
    ], anchor=MSO_ANCHOR.MIDDLE)

    lablec(s, n)
    attunes(s)
    animacio(s, [[(bal, 'be')], [(jobb, 'be')], [(also, 'be')]])
    jegyzet(s, """
        A szakirodalomban találtam egy részletesen dokumentált, megvalósított
        NFC-s jelenléti rendszert. [kattintás] A szerzők mérése szerint az ív
        aláírása dolgozónként mintegy harminc másodperc, a kártyaolvasás
        kettő; száz főnél ez ötven perc helyett ötven másodperc. [kattintás]
        Két kérdést viszont nyitva hagy: a kártya átadható, tehát a gyorsabb
        beléptetés nem teszi hitelesebbé a nyilvántartást; és egyetlen
        intézményre készült. [kattintás] Általánosabban: a hálózat nélküli
        működést, a cégek elkülönítését és a visszaélés elleni védelmet az
        áttekintett munkák külön tárgyalják. Olyan megoldás nem került elő,
        amely a hármat egyetlen, célhardver nélküli rendszerben egyesítené —
        erre a résre épül a dolgozat.""")
    return s


# ── 6. dia: a rendszer felépítése ────────────────────────────────────────────
def architektura(prs, n):
    s = uj_dia(prs)
    fejlec(s, 'A megoldás', 'A rendszer felépítése')

    # Az ábra a lehető legszélesebb, amit a fejléc és a lábléc közötti hely
    # enged (a képarány 1920 × 1164) — vetítve ez a dia legapróbb szövege.
    ix, iy, iw = BAL - 0.1, 1.72, 8.3
    kep(s.shapes, 'architektura.png', ix, iy, w=iw)
    # Az ábra rajzvásznának koordinátái (figures/abrak.html, 960 pont széles):
    # a kiemelések ugyanazokra a dobozokra esnek, amelyeket a rajz kirajzol.
    k = iw / 960

    def kiemel(x0, y0, x1, y1):
        return teglalap(s.shapes, ix + x0 * k, iy + y0 * k, (x1 - x0) * k, (y1 - y0) * k,
                        KEK, kerek=0.05, vonal=KEK, vastag=2.5, fedes=0.10)

    hl = [kiemel(32, 41, 288, 220),     # beléptető + helyi tároló
          kiemel(352, 41, 608, 135),    # dolgozói
          kiemel(672, 41, 928, 135),    # vezetői
          # a háttérrendszer szaggatott kerete; alul épp csak átfogja, hogy a
          # „Külső szolgáltatások" rétegcímkére ne lógjon rá
          kiemel(22, 280, 938, 493)]

    tetelek = [
        ('Beléptető alkalmazás', 'Falra szerelt eszköz: NFC-olvasás, fénykép. Hálózat nélkül is működik.'),
        ('Dolgozói alkalmazás', 'A dolgozó saját telefonja: napló, távollét-kérelmek, értesítések.'),
        ('Vezetői felület', 'Asztali böngésző: valós idejű állapot, kimutatások, beállítások.'),
        ('Közös háttérrendszer', 'Egy adatbázis; a cégek elkülönítését az adatbázis szabályai biztosítják.'),
    ]
    tx = 9.35
    szovegek = []
    for i, (cim, leiras) in enumerate(tetelek):
        szovegek.append(szoveg(s.shapes, tx, 1.9 + i * 1.15, JOBB - tx, 1.05, [
            P(cim, 15, color=KEK, bold=True, after=3),
            P(leiras, 13, color=HALK, line=1.08),
        ]))

    lablec(s, n)
    attunes(s)
    # Kattintásonként egy újabb tétel jelenik meg a jobb oldalon, és vele együtt
    # a hozzá tartozó kiemelés az ábrán; az előző kiemelés közben elhalványul,
    # így mindig csak az a rész van kijelölve, amelyről épp szó van.
    lepesek = []
    for i in range(4):
        lepes = [(szovegek[i], 'be'), (hl[i], 'be')]
        if i:
            lepes.append((hl[i - 1], 'ki'))
        lepesek.append(lepes)
    animacio(s, lepesek)
    jegyzet(s, """
        A rendszer három külön alkalmazásból áll, közös háttérrendszerrel.
        [kattintás] A beléptető alkalmazás a bejáratnál elhelyezett eszközön
        fut: olvassa a kártyát, és szükség esetén fényképet készít; saját
        helyi tárolója miatt hálózat nélkül is működik. [kattintás] A dolgozói
        alkalmazás a dolgozó saját telefonján fut: itt látja a napját, a
        naplóját, és itt adja be a távollét-kérelmeit. [kattintás] A vezetői
        felület asztali böngészőben fut: valós idejű állapot, kimutatások,
        beállítások. [kattintás] A közös háttérrendszer egyetlen adatbázis,
        amelyben a cégek elkülönítését az adatbázis szabályai biztosítják, nem
        az alkalmazáskód. Azért három alkalmazás és nem egy, mert három
        különböző eszközön, eltérő üzemi körülmények között futnak.""")
    return s


def _app_xml(ut, diak, jegyzetek):
    """A python-pptx alapsablonjából örökölt app.xml elavult adatokat hordoz
    (4:3-as formátum, 0 dia, Mac-es PowerPoint). Helyette a tényleges értékek
    kerülnek bele; a PowerPoint a következő mentéskor úgyis felülírja."""
    app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
           '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
           'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
           '<Application>Microsoft Office PowerPoint</Application>'
           '<PresentationFormat>Widescreen</PresentationFormat>'
           f'<Slides>{diak}</Slides><Notes>{jegyzetek}</Notes></Properties>').encode('utf8')
    tmp = ut + '.tmp'
    with zipfile.ZipFile(ut) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            zout.writestr(item, app if item.filename == 'docProps/app.xml' else zin.read(item.filename))
    os.replace(tmp, ut)


def main():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SZ), Inches(MA)

    cimdia(prs)
    problema(prs, 2)
    celok(prs, 3)
    miert_nfc(prs, 4)
    kutatasi_res(prs, 5)
    architektura(prs, 6)

    # Metaadatok: a python-pptx alapsablonja a saját nevét és egy 2013-as
    # dátumot hozná — ezek helyett a szerző és a mai nap áll.
    cp = prs.core_properties
    cp.author = cp.last_modified_by = M['student']
    cp.title = M['titleHu']
    cp.subject = 'Szakdolgozat — védési bemutató'
    cp.keywords = cp.comments = cp.category = ''
    cp.created = cp.modified = datetime.datetime.now().replace(microsecond=0)
    cp.revision = 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    prs.save(OUT)
    _app_xml(OUT, len(prs.slides), len(prs.slides))
    print(f'Kész: {os.path.relpath(OUT, HERE)}  ({len(prs.slides)} dia, '
          f'{os.path.getsize(OUT) // 1024} kB)')


if __name__ == '__main__':
    main()
