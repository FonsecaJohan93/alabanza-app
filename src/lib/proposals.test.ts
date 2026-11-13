import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanDrums, keepProposals, stampProposals, type DrumChart } from './drums.ts'

const chart = (proposed?: string, proposedBy?: string): DrumChart => ({ sections: [{ name: 'Coro', parts: [], proposed, proposedBy }] })

test('quien no es de dirección no cambia las propuestas', () => {
  const out = keepProposals(chart('zzz'), chart('abc', 'Johan'))
  assert.equal(out!.sections[0].proposed, 'abc')
  assert.equal(out!.sections[0].proposedBy, 'Johan')
  assert.equal(keepProposals(chart('zzz'), undefined)!.sections[0].proposed, undefined)
})

test('dirección: la propuesta nueva queda a su nombre, la que no cambió conserva el suyo', () => {
  assert.equal(stampProposals(chart('def'), chart('abc', 'Johan'), 'Karen')!.sections[0].proposedBy, 'Karen')
  assert.equal(stampProposals(chart('abc'), chart('abc', 'Johan'), 'Karen')!.sections[0].proposedBy, 'Johan')
  assert.equal(stampProposals(chart(undefined), chart('abc', 'Johan'), 'Karen')!.sections[0].proposedBy, undefined)
})

test('cleanDrums guarda la propuesta y descarta ids raros', () => {
  assert.equal(cleanDrums({ sections: [{ name: 'Coro', proposed: 'a1b2c3', proposedBy: 'Johan' }] })!.sections[0].proposed, 'a1b2c3')
  assert.equal(cleanDrums({ sections: [{ name: 'Coro', proposed: '<script>' }] })!.sections[0].proposed, undefined)
})
