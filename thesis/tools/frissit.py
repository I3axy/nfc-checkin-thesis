# -*- coding: utf-8 -*-
"""
A tartalomjegyzék és a mezők frissítése, majd PDF-export — LibreOffice UNO-n át.

Miért kell külön lépés: a tartalomjegyzék Word-mező, amelynek oldalszámai a
tördeléstől függenek. A tördelést a build nem ismeri, csak a szövegszerkesztő,
ezért a build a mezőt üresen, „elavult” jelöléssel hagyja. Ez a script betölti
a dokumentumot, elvégzi a tördelést és a frissítést, majd kimenti.

A BEMENETI .docx nem módosul: a script kizárólag storeToURL-lel ír, új fájlba.

Indítása a frissit.mjs feladata; közvetlenül nem célszerű hívni, mert a
LibreOffice saját Python-értelmezőjét igényli.
"""
import os
import subprocess
import sys
import time

import uno
from com.sun.star.beans import PropertyValue


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def url(p):
    return uno.systemPathToFileUrl(os.path.abspath(p))


def connect(soffice, profile, port, timeout=120):
    """Külön profillal indított, háttérben futó LibreOffice-hoz csatlakozik.

    A saját profil azért kell, hogy a művelet akkor is lefusson, ha a
    felhasználónak épp nyitva van a LibreOffice, és hogy a beállításait ne
    érintse.
    """
    proc = subprocess.Popen([
        soffice,
        '-env:UserInstallation=' + url(profile),
        '--headless', '--norestore', '--nolockcheck', '--nodefault',
        '--accept=socket,host=127.0.0.1,port=%d;urp;' % port,
    ])
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext(
        'com.sun.star.bridge.UnoUrlResolver', local)
    target = ('uno:socket,host=127.0.0.1,port=%d;urp;StarOffice.ComponentContext'
              % port)
    deadline = time.time() + timeout
    while True:
        try:
            return resolver.resolve(target), proc
        except Exception:
            if time.time() > deadline:
                raise
            time.sleep(0.5)


def main():
    soffice, profile, src, pdf_out, docx_out, port = sys.argv[1:7]
    ctx, proc = connect(soffice, profile, int(port))
    desktop = ctx.ServiceManager.createInstanceWithContext(
        'com.sun.star.frame.Desktop', ctx)

    # UpdateDocMode=3 (FULL_UPDATE): a kapcsolt tartalmak is frissülnek
    doc = desktop.loadComponentFromURL(url(src), '_blank', 0, (
        prop('Hidden', True),
        prop('UpdateDocMode', 3),
    ))
    if doc is None:
        raise SystemExit('HIBA: a dokumentum nem tölthető be')

    try:
        # Először a mezők, utána az indexek: a tartalomjegyzék oldalszámai
        # csak kész tördelés mellett helyesek, ezért a végén még egy kör.
        doc.refresh()
        indexes = doc.getDocumentIndexes()
        for i in range(indexes.getCount()):
            indexes.getByIndex(i).update()
        doc.refresh()

        # A két mentés egymástól függetlenül fut le: ha az egyik célfájl épp
        # meg van nyitva (és ezért zárolt), a másik akkor is elkészüljön.
        failed = []
        for path, filt in ((pdf_out, 'writer_pdf_Export'),
                           (docx_out, 'MS Word 2007 XML')):
            try:
                doc.storeToURL(url(path), (prop('FilterName', filt),))
            except Exception as exc:
                failed.append('%s\t%s' % (path, exc))
        if failed:
            for f in failed:
                print('FAIL\t' + f)
        else:
            print('OK')
    finally:
        try:
            doc.close(False)
        except Exception:
            pass
        try:
            desktop.terminate()
        except Exception:
            pass
        # A hívó ezután törli az ideiglenes profilt, amit a LibreOffice a
        # kilépésig fog; ezért itt megvárjuk, amíg a folyamat ténylegesen véget ér.
        try:
            proc.wait(timeout=60)
        except Exception:
            pass


if __name__ == '__main__':
    main()
