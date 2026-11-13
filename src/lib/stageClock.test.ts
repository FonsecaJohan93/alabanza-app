import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, MAX_GAP, newClock, pause, readClock, resume, tick } from './stageClock.ts'

test('suma el tiempo total y el de la canción en pantalla', () => {
  let c = newClock(0)
  c = tick(c, 60_000, 'a')
  c = tick(c, 90_000, 'b')
  assert.equal(c.total, 90_000)
  assert.deepEqual(c.perSong, { a: 60_000, b: 30_000 })
})

test('en pausa no cuenta, y al seguir no suma la pausa', () => {
  let c = pause(newClock(0), 10_000, 'a')
  c = tick(c, 50_000, 'a')
  assert.equal(c.total, 10_000)
  c = tick(resume(c, 100_000), 105_000, 'a')
  assert.equal(c.total, 15_000)
  assert.equal(c.perSong.a, 15_000)
})

test('un hueco muy largo (app cerrada) no se cuenta', () => {
  const c = tick(newClock(0), MAX_GAP + 1, 'a')
  assert.equal(c.total, 0)
  assert.equal(c.last, MAX_GAP + 1)
})

test('formato del reloj', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(75_000), '1:15')
  assert.equal(formatClock(3_725_000), '1:02:05')
})

test('lee lo guardado y descarta basura', () => {
  assert.equal(readClock('nope'), null)
  assert.equal(readClock(null), null)
  assert.deepEqual(readClock(JSON.stringify({ running: true, total: 5, perSong: { a: 5 }, last: 9 })), { running: true, total: 5, perSong: { a: 5 }, last: 9 })
})
