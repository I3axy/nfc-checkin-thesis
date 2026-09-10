// =============================================================================
// A felülettől független számítások futtatható próbái
// =============================================================================
// A próbák a valódi forrásfájlokat töltik be, nem azok másolatát: ha a
// számítás megváltozik, a próba is azt az új változatot ellenőrzi.
//
// Futtatás a demo mappában:  npm test
// (A Node.js beépített tesztfuttatója, külön függőség nélkül.)
// =============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import {
  calcDayMins, groupByDay, countWorkdays, continuesFrom, groupRuns,
} from '../apps/worker/src/lib/format.js'
import { normalizeUid, hashPin, isWorkerLate } from '../apps/dashboard/src/lib/utils.js'

// Helyi idő szerinti időpont — a számítások a helyi naptári napra épülnek.
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min)
const ev = (type, date) => ({ id: `${type}-${date.getTime()}`, type, timestamp: date.toISOString() })

// ─── Napi ledolgozott idő: párokra bontás ────────────────────────────────────

test('ebédszünettel: a két pár hossza összeadódik, a szünet kimarad', () => {
  const nap = [
    ev('checkin',  at(2026, 5, 4, 8, 0)),
    ev('checkout', at(2026, 5, 4, 12, 0)),
    ev('checkin',  at(2026, 5, 4, 12, 30)),
    ev('checkout', at(2026, 5, 4, 16, 30)),
  ]
  assert.equal(calcDayMins(nap), 480)
})

test('rendezetlen bemenetből is ugyanaz az eredmény', () => {
  const nap = [
    ev('checkout', at(2026, 5, 4, 16, 30)),
    ev('checkin',  at(2026, 5, 4, 12, 30)),
    ev('checkout', at(2026, 5, 4, 12, 0)),
    ev('checkin',  at(2026, 5, 4, 8, 0)),
  ]
  assert.equal(calcDayMins(nap), 480)
})

test('egy korábbi nap nyitva maradt belépése nem növekszik tovább', () => {
  assert.equal(calcDayMins([ev('checkin', at(2026, 5, 4, 8, 0))]), 0)
})

test('a mai nap nyitott belépése a jelen pillanatig számít', () => {
  const most = new Date()
  const ejfel = new Date(most.getFullYear(), most.getMonth(), most.getDate())
  // Legfeljebb fél órával korábbi, de mindenképp mai belépés
  const be = new Date(Math.max(ejfel.getTime(), most.getTime() - 30 * 60000))
  const vart = Math.floor((most - be) / 60000)
  const kapott = calcDayMins([ev('checkin', be)])
  assert.ok(kapott >= vart && kapott <= vart + 1, `${kapott} perc, várt: ${vart}`)
})

test('groupByDay: naponkénti bontás, a legfrissebb nap elöl, napon belül időrendben', () => {
  const napok = groupByDay([
    ev('checkout', at(2026, 5, 4, 16, 0)),
    ev('checkin',  at(2026, 5, 5, 8, 0)),
    ev('checkin',  at(2026, 5, 4, 8, 0)),
    ev('checkout', at(2026, 5, 5, 12, 0)),
  ])
  assert.deepEqual(napok.map(n => n.key), ['2026-05-05', '2026-05-04'])
  assert.deepEqual(napok[1].events.map(e => e.type), ['checkin', 'checkout'])
  assert.deepEqual(napok.map(n => n.minutes), [240, 480])
})

// ─── Hétvégéket kihagyó napszámítás és összevonás ───────────────────────────
// 2026. május 8. péntek, 9–10. hétvége, 11. hétfő.

test('countWorkdays: a hétvége kimarad, ha a dolgozó kéri', () => {
  assert.equal(countWorkdays('2026-05-08', '2026-05-11', true), 2)
  assert.equal(countWorkdays('2026-05-08', '2026-05-11', false), 4)
  assert.equal(countWorkdays('2026-05-09', '2026-05-10', true), 0)
})

test('countWorkdays: fordított tartomány nem ad napot', () => {
  assert.equal(countWorkdays('2026-05-11', '2026-05-08', true), 0)
})

test('continuesFrom: a hétvégén átívelő napok egybefüggők, a kihagyott munkanap nem', () => {
  assert.equal(continuesFrom('2026-05-08', '2026-05-11'), true)    // péntek → hétfő
  assert.equal(continuesFrom('2026-05-05', '2026-05-06'), true)    // kedd → szerda
  assert.equal(continuesFrom('2026-05-05', '2026-05-07'), false)   // kimarad a szerda
})

test('groupRuns: a hétvégén átívelő szabadság egy tétel, az eltérő állapot újat kezd', () => {
  const sor = (id, date, status) => ({ id, date, type: 'vacation', note: null, status })
  const tetelek = groupRuns([
    sor('a', '2026-05-07', 'approved'),
    sor('b', '2026-05-08', 'approved'),
    sor('c', '2026-05-11', 'approved'),
    sor('d', '2026-05-12', 'pending'),
  ])
  assert.deepEqual(
    tetelek.map(t => [t.from, t.to, t.days, t.status]),
    [['2026-05-12', '2026-05-12', 1, 'pending'], ['2026-05-07', '2026-05-11', 3, 'approved']],
  )
})

// ─── Kártyaazonosító egységesítése ───────────────────────────────────────────

test('normalizeUid: kis- és nagybetű, elválasztójelek egységesen', () => {
  for (const irasmod of ['04:a1:b2:c3', '04-A1-B2-C3', '04 a1 B2 c3', '04A1B2C3']) {
    assert.equal(normalizeUid(irasmod), '04A1B2C3')
  }
  assert.equal(normalizeUid(null), '')
})

// ─── PIN-lenyomat ────────────────────────────────────────────────────────────

test('hashPin: a cégazonosítóval sózott SHA-256, kisbetűs hexadecimális alakban', async () => {
  const vart = createHash('sha256').update('ceg-1:1234').digest('hex')
  assert.equal(await hashPin('ceg-1', '1234'), vart)
  assert.match(vart, /^[0-9a-f]{64}$/)
})

test('hashPin: azonos cégben azonos, másik cégben eltérő lenyomat', async () => {
  assert.equal(await hashPin('ceg-1', '1234'), await hashPin('ceg-1', '1234'))
  assert.notEqual(await hashPin('ceg-1', '1234'), await hashPin('ceg-2', '1234'))
})

// ─── Késés megállapítása ─────────────────────────────────────────────────────

test('isWorkerLate: a munkakezdés és a türelmi idő után számít késésnek', () => {
  const beallitas = { startHour: 8, startMinute: 0, lateThresholdMinutes: 15 }
  assert.equal(isWorkerLate(at(2026, 5, 4, 7, 50), beallitas), false)
  assert.equal(isWorkerLate(at(2026, 5, 4, 8, 15), beallitas), false)
  assert.equal(isWorkerLate(at(2026, 5, 4, 8, 16), beallitas), true)
})
