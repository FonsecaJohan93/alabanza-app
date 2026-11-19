import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanLive, currentLive, KEEP_MS, liveSince, pushLive, SHOW_MS, type LiveMessage } from './live.ts'

const msg = (at: number, text = 'Crescendo'): LiveMessage => ({ id: String(at), text, by: 'Johan', at })

test('solo texto corto y en una línea', () => {
  assert.equal(cleanLive({ text: '   ' }), null)
  assert.equal(cleanLive('x'), null)
  assert.deepEqual(cleanLive({ text: ' Última\n vuelta ', song: 'Santo' }), { text: 'Última vuelta', song: 'Santo' })
  assert.equal(cleanLive({ text: 'a'.repeat(200) })!.text.length, 80)
})

test('guarda los recientes y entrega los nuevos', () => {
  let list: LiveMessage[] = []
  list = pushLive(list, msg(1000))
  list = pushLive(list, msg(2000))
  assert.deepEqual(liveSince(list, 1000).map((m) => m.at), [2000])
  // Lo de hace más de KEEP_MS se descarta
  list = pushLive(list, msg(KEEP_MS + 1500))
  assert.deepEqual(list.map((m) => m.at), [2000, KEEP_MS + 1500])
})

test('el aviso se ve unos segundos', () => {
  const list = [msg(1000)]
  assert.equal(currentLive(list, 1000 + SHOW_MS - 1)?.text, 'Crescendo')
  assert.equal(currentLive(list, 1000 + SHOW_MS + 1), undefined)
})
