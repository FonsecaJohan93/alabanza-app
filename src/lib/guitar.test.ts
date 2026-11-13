import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chordNotes, guitarVoicings, parseChordName, stringNotes } from './guitar.ts'

const shape = (c: string) => guitarVoicings(c)[0]?.frets.map((f) => (f < 0 ? 'x' : String(f))).join('')

test('las posiciones más comunes salen primero', () => {
  const expected: Record<string, string> = {
    C: 'x32010',
    G: '320003',
    D: 'xx0232',
    A: 'x02220',
    E: '022100',
    Am: 'x02210',
    Em: '022000',
    Dm: 'xx0231',
    F: '133211',
    Bm: 'x24432',
    'F#m': '244222',
    'C#m': 'x46654',
    G7: '320001',
    B7: 'x21202',
    Cmaj7: 'x32000',
    Dsus4: 'xx0233',
    'G/B': 'x20003',
    'D/F#': '200232',
    'C/E': '032010',
    Cm: 'x35543',
    'A#': 'x13331',
  }
  for (const [c, s] of Object.entries(expected)) assert.equal(shape(c), s, c)
})

test('cada posición suena con las notas del acorde y el bajo correcto', () => {
  for (const c of ['C#m7', 'A#maj7', 'G/B', 'Bdim', 'E9', 'Cadd9', 'Ebm', 'F#', 'Am/G', 'Dm7(9)', 'C5']) {
    const spec = parseChordName(c)!
    const vs = guitarVoicings(c)
    assert.ok(vs.length > 0, c)
    for (const v of vs) {
      const notes = stringNotes(v).filter(Boolean) as string[]
      for (const n of chordNotes(c).slice(0, 1)) assert.ok(notes.includes(n), `${c} sin ${n}`)
      assert.equal(notes[0], ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][spec.bass], `${c} bajo`)
      const fretted = v.frets.filter((f) => f > 0)
      if (fretted.length) assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${c} estirado`)
    }
  }
})

test('notas del acorde', () => {
  assert.deepEqual(chordNotes('C#m'), ['C#', 'E', 'G#'])
  assert.deepEqual(chordNotes('G7'), ['G', 'B', 'D', 'F'])
  assert.deepEqual(chordNotes('D/F#'), ['D', 'F#', 'A'])
  assert.deepEqual(chordNotes('Bb'), ['A#', 'D', 'F'])
})

test('mayores y menores de las 12 notas tienen posición', () => {
  for (const r of ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])
    for (const q of ['', 'm']) {
      const vs = guitarVoicings(r + q)
      assert.ok(vs.length >= 2, r + q)
      assert.ok(!vs[0].frets.slice(1).some((f, i) => f < 0 && vs[0].frets[i] >= 0 && i < 4), `${r + q} sin cuerdas apagadas en medio`)
    }
  assert.equal(shape('Fm'), '133111')
  assert.equal(shape('D#'), 'x68886')
  assert.equal(shape('Gm'), '355333')
})
