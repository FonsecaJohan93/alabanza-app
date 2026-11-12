import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  capoSuggestion,
  chordProToText,
  guessKey,
  isChord,
  isChordLine,
  parseChordPro,
  sectionName,
  textToChordPro,
  transposeChord,
  transposeKey,
} from './chordsheet.ts'
import { parseLaCuerda, sourceOf, normalizeLaCuerdaUrl } from './importers.ts'

test('reconoce acordes', () => {
  for (const c of ['A', 'Am', 'Am7', 'Cmaj7', 'C7M', 'Dsus4', 'G/B', 'F#m7b5', 'E7(9)', 'Bb', 'A4', 'Asus2', 'C#m', 'D/F#', 'Gadd9', 'Bdim', 'C°', 'E+'])
    assert.ok(isChord(c), c)
  for (const w of ['Al', 'Dios', 'Amor', 'Bendito', 'Eres', 'a', 'de', 'Coro'])
    assert.ok(!isChord(w), w)
})

test('distingue líneas de acordes y de letra', () => {
  assert.ok(isChordLine('D       G  A        Bm'))
  assert.ok(isChordLine('  Em  C  G  D  (x2)'))
  assert.ok(isChordLine('| G  | D/F# | Em |'))
  assert.ok(!isChordLine('renuevame señor jesus'))
  assert.ok(!isChordLine('A ti sea la gloria'))
  assert.ok(isChordLine('D                   C#mD   Bm     F#m'))
  assert.ok(!isChordLine('Dios Eres Amor'))
  assert.ok(!isChordLine('Al Cordero De Dios'))
  assert.ok(!isChordLine(''))
})

test('nombres de sección', () => {
  assert.equal(sectionName('coro:'), 'Coro')
  assert.equal(sectionName('[Puente]'), 'Puente')
  assert.equal(sectionName('(Verso 2)'), 'Verso 2')
  assert.equal(sectionName('[Refrão]'), 'Refrão')
  assert.equal(sectionName('Coronado de gloria'), null)
})

test('acordes arriba → ChordPro → acordes arriba', () => {
  const text = 'Coro:\nG        D\nCuán grande es Él\n\nEm  C  G  D'
  const cp = textToChordPro(text)
  assert.equal(cp, '{c: Coro}\n[G]Cuán gran[D]de es Él\n\n[Em]  [C]  [G]  [D]')
  assert.equal(chordProToText(cp), 'Coro:\nG        D\nCuán grande es Él\n\nEm   C   G   D')
})

test('acorde más allá del final de la letra', () => {
  assert.equal(textToChordPro('A          E\nhola'), '[A]hola       [E]')
})

test('acorde sobre un espacio se pega a la palabra siguiente', () => {
  assert.equal(textToChordPro('  B        E\nEn reposo, en silencio'), 'En [B]reposo, [E]en silencio')
})

test('Cifra Club: sección y acordes en la misma línea', () => {
  assert.equal(textToChordPro('[Intro] D  G  A\n\n[Primeira Parte]\nD\nTe amo'), '{c: Intro}\n[D]  [G]  [A]\n\n{c: Primeira Parte}\n[D]Te amo')
})

test('parseChordPro', () => {
  const l = parseChordPro('{c: Coro}\n[G]Cuán [D]grande\n[Em] [C]')
  assert.deepEqual(l[0], { type: 'section', name: 'Coro' })
  assert.deepEqual(l[1], { type: 'lyrics', parts: [{ chord: 'G', text: 'Cuán ' }, { chord: 'D', text: 'grande' }] })
  assert.deepEqual(l[2], { type: 'chords', chords: ['Em', 'C'] })
})

test('transposición', () => {
  assert.equal(transposeChord('G', 2), 'A')
  assert.equal(transposeChord('D/F#', 2, 'E'), 'E/G#')
  assert.equal(transposeChord('C', -2, 'Bb'), 'Bb')
  assert.equal(transposeChord('F#m7', 1, 'G'), 'Gm7')
  assert.equal(transposeKey('G', 3), 'Bb')
  assert.equal(transposeKey('G', 1), 'Ab')
  assert.equal(transposeKey('Em', 1), 'Fm')
  assert.equal(transposeChord('Xyz', 3), 'Xyz')
  assert.equal(transposeChord('C#mD', 3, 'F'), 'EmF')
})

test('tono y capo', () => {
  assert.equal(guessKey('{c: Intro}\n[Em]hola [C]'), 'Em')
  assert.deepEqual(capoSuggestion('Bb'), { capo: 1, shape: 'A' })
  assert.deepEqual(capoSuggestion('F#m'), { capo: 2, shape: 'Em' })
  assert.equal(capoSuggestion('G'), null)
})

test('fuentes', () => {
  assert.equal(sourceOf('https://acordes.lacuerda.net/marcos_witt/renuevame.shtml'), 'lacuerda')
  assert.equal(sourceOf('https://www.cifraclub.com.br/x/y/'), 'cifraclub')
  assert.equal(sourceOf('https://www.cifraclub.com/x/y/'), 'cifraclub')
  assert.equal(normalizeLaCuerdaUrl('http://acordes.lacuerda.net/marcos_witt/renuevame'), 'https://acordes.lacuerda.net/marcos_witt/renuevame.shtml')
})

test('LaCuerda: página real', async () => {
  const { readFile } = await import('node:fs/promises')
  const path = process.env.LACUERDA_SAMPLE
  if (!path) return
  const song = parseLaCuerda(await readFile(path, 'utf8'), 'https://acordes.lacuerda.net/marcos_witt/renuevame.shtml')
  assert.equal(song.title, 'Renuévame')
  assert.equal(song.artist, 'Marcos Witt')
  assert.equal(song.key, 'D')
  assert.ok(song.content.startsWith('[D]renuevam[G]e s[A]eñor'), song.content)
  assert.ok(song.content.includes('{c: Coro}'))
  assert.ok(song.content.includes('[C#mD]'))
  // Pasar por el editor ("acordes arriba") no debe cambiar nada
  assert.equal(textToChordPro(chordProToText(song.content)), song.content)
  console.log(song.content)
  console.log(song.youtube)
})
