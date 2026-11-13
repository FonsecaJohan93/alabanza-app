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
import { blocksOf, insertCue, removeLine } from './chordsheet.ts'

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
  assert.ok(isChordLine('Dm.               F'))
  assert.ok(isChordLine('     C#7(4/9-)  C#7(9-)'))
  assert.ok(!isChordLine('Dios.'))
  assert.ok(isChordLine('( Bm  A  G  Em  F#7 )'))
  assert.equal(textToChordPro('Am.   G\nletra aqui'), '[Am]letra [G]aqui')
  assert.ok(!isChordLine(''))
})

test('nombres de sección', () => {
  assert.equal(sectionName('coro:'), 'Coro')
  assert.equal(sectionName('[Puente]'), 'Puente')
  assert.equal(sectionName('(Verso 2)'), 'Verso 2')
  assert.equal(sectionName('[Refrão]'), 'Refrão')
  assert.equal(sectionName('[Primera Parte]'), 'Primera Parte')
  assert.equal(sectionName('Segunda parte:'), 'Segunda parte')
  assert.equal(sectionName('[Tab - Intro]'), 'Tab - Intro')
  assert.equal(sectionName('[Pós-Refrão]'), 'Pós-Refrão')
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
  assert.equal(transposeChord('C', -2), 'A#') // siempre en sostenidos
  assert.equal(transposeChord('F#m7', 1, 'G'), 'Gm7')
  assert.equal(transposeKey('G', 3), 'A#')
  assert.equal(transposeKey('G', 1), 'G#')
  assert.equal(transposeKey('Dbm', 0), 'C#m')
  assert.equal(transposeChord('Bbm7', 0), 'A#m7') // los bemoles escritos se muestran en sostenidos
  assert.equal(transposeChord('Ebm/Bb', 0), 'D#m/A#')
  assert.equal(transposeKey('Em', 1), 'Fm')
  assert.equal(transposeChord('Xyz', 3), 'Xyz')
  assert.equal(transposeChord('C#mD', 3), 'EmF')
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

test('indicadores para el equipo', () => {
  const cp = textToChordPro('Coro:\nG\nSanto\n\n>> Otra vez al coro')
  assert.equal(cp, '{c: Coro}\n[G]Santo\n\n{ci: Otra vez al coro}')
  assert.deepEqual(parseChordPro(cp)[3], { type: 'cue', text: 'Otra vez al coro' })
  assert.equal(chordProToText(cp), 'Coro:\nG\nSanto\n\n>> Otra vez al coro')
  const withCue = insertCue('[G]a\n\n[D]b', 2, 'Solo instrumental')
  assert.equal(withCue, '[G]a\n\n{ci: Solo instrumental}\n[D]b')
  assert.equal(removeLine(withCue, 2), '[G]a\n\n[D]b')
})

test('bloques por estrofa', () => {
  const b = blocksOf(parseChordPro('{c: Verso}\n[G]a\n[D]b\n\n[C]c\n{ci: Otra vez}\n{c: Coro}\n[G]d'))
  assert.deepEqual(b.map((x) => [x.start, x.lines.length]), [[0, 3], [4, 1], [5, 1], [6, 2]])
  // La sección se queda con su letra aunque haya una línea vacía en medio
  assert.deepEqual(blocksOf(parseChordPro('{c: Coro}\n\n[G]a')).map((x) => x.lines.length), [2])
})

test('pulso: golpe correcto en el tiempo', async () => {
  const { beatAt, beatsPerBar } = await import('./pulse.ts')
  assert.equal(beatAt(1000, 1000, 60), 0)
  assert.equal(beatAt(1999, 1000, 60), 0)
  assert.equal(beatAt(2000, 1000, 60), 1)
  assert.equal(beatAt(1000 + 60000, 1000, 120), 120) // 120 golpes en un minuto
  assert.equal(beatsPerBar('6/8'), 6)
  assert.equal(beatsPerBar('Balada 4/4'), 4)
})

test('vistas según instrumentos', async () => {
  const { viewsFor } = await import('./team.ts')
  assert.deepEqual(viewsFor(['acustica']), { chords: true, lyrics: false, drums: false, primary: 'hoja' })
  assert.deepEqual(viewsFor(['bateria']), { chords: false, lyrics: false, drums: true, primary: 'bateria' })
  assert.deepEqual(viewsFor(['voz']), { chords: false, lyrics: true, drums: false, primary: 'voces' })
  assert.equal(viewsFor(['direccion', 'voz']).drums, true)
  assert.equal(viewsFor([]).chords, true) // sin instrumentos: todo
  const mix = viewsFor(['voz', 'electrica'])
  assert.ok(mix.chords && mix.lyrics && !mix.drums)
  assert.equal(viewsFor(['acustica'], 'letra').primary, 'voces') // la elección manual manda
})

test('estructura: leer, reordenar y volver a escribir', async () => {
  const { parseStructure, serializeStructure, moveBlock, renames } = await import('./structure.ts')
  const cp = '[G]Intro sin nombre\n\n{c: Verso 1}\n[G]Hola\n\n[D]Segundo párrafo\n\n{ci: Otra vez al coro}\n{c: Coro}\n\n[C]Santo'
  const b = parseStructure(cp)
  assert.deepEqual(b.map((x) => [x.kind, x.name, x.body.length]), [['section', '', 1], ['section', 'Verso 1', 3], ['cue', 'Otra vez al coro', 0], ['section', 'Coro', 1]])
  // Escribir y volver a leer no cambia nada
  const out = serializeStructure(b)
  assert.equal(serializeStructure(parseStructure(out)), out)
  // Mover el coro al principio
  const moved = moveBlock(b, 3, 0)
  assert.ok(serializeStructure(moved).startsWith('{c: Coro}\n[C]Santo\n\n[G]Intro'))
  // Renombrar se registra para la batería
  b[1].name = 'Estrofa 1'
  assert.equal(renames(b).get('Verso 1'), 'Estrofa 1')
})

test('búsqueda en LaCuerda', async () => {
  const { laCuerdaSlug, parseLaCuerdaSearch } = await import('./importers.ts')
  assert.equal(laCuerdaSlug('Renuévame'), 'renuevame')
  assert.equal(laCuerdaSlug('No hay lugar más alto'), 'no_hay_lugar_mas_alto')
  assert.equal(laCuerdaSlug('Quién como Tú?'), 'quien_como_tu')
  const { readFile } = await import('node:fs/promises')
  const path = process.env.LACUERDA_SEARCH_SAMPLE
  if (!path) return
  const r = parseLaCuerdaSearch(await readFile(path, 'utf8'))
  assert.ok(r.length > 5, String(r.length))
  const ibi = r.find((x) => x.title === 'Hay Libertad')
  assert.equal(ibi?.artist, 'La IBI')
  assert.equal(ibi?.url, 'https://acordes.lacuerda.net/ibi/hay_libertad.shtml')
})

test('editar solo la letra conserva los acordes', async () => {
  const { lyricsOf, applyLyrics } = await import('./structure.ts')
  const body = ['[Em]  [C]', '[G]Te adoro, el am[D]ado', 'Rey de [C]reyes', '', '[Am]Santo']
  assert.equal(lyricsOf(body), 'Te adoro, el amado\nRey de reyes\n\nSanto')
  // Cambiar "el" por "mi": los acordes siguen en sus palabras
  const r = applyLyrics(body, 'Te adoro, mi amado\nRey de reyes\n\nSanto')
  assert.deepEqual(r, ['[Em]  [C]', '[G]Te adoro, mi am[D]ado', 'Rey de [C]reyes', '', '[Am]Santo'])
  // Palabra más larga: el acorde de "amado" sigue en "amadísimo"
  assert.equal(applyLyrics(body, 'Te adoro, el amadísimo\nRey de reyes\n\nSanto')[1], '[G]Te adoro, el am[D]adísimo')
  // Reescribir una línea: el acorde se queda en la misma palabra (2.ª)
  assert.equal(applyLyrics(body, 'Te adoro, el amado\nLínea nueva\n\nSanto')[2], 'Línea [C]nueva')
  // Insertar una línea: es nueva y sin acordes; las demás no cambian
  const r2 = applyLyrics(body, 'Te adoro, el amado\nOtra línea\nRey de reyes\n\nSanto')
  assert.deepEqual(r2, ['[Em]  [C]', '[G]Te adoro, el am[D]ado', 'Otra línea', 'Rey de [C]reyes', '', '[Am]Santo'])
  // Borrar una línea
  assert.deepEqual(applyLyrics(body, 'Te adoro, el amado\n\nSanto'), ['[Em]  [C]', '[G]Te adoro, el am[D]ado', '', '[Am]Santo'])
  // Sin cambios, todo igual
  assert.deepEqual(applyLyrics(body, lyricsOf(body)), body)
})

test('tono del domingo y capo', async () => {
  const { keyView } = await import('./chordsheet.ts')
  // Escrita en G, el domingo suena en G, sin capo: nada cambia
  assert.deepEqual(keyView('G', 'G'), { semis: 0, shapeKey: 'G' })
  // El domingo suena en A: los acordes suben 2
  assert.deepEqual(keyView('G', 'A'), { semis: 2, shapeKey: 'A' })
  // Suena en A con capo 2: el guitarrista toca formas de G (sin mover)
  assert.deepEqual(keyView('G', 'A', 2), { semis: 0, shapeKey: 'G' })
  // Suena en Bb con capo 1: formas de A
  assert.deepEqual(keyView('G', 'Bb', 1), { semis: 2, shapeKey: 'A' })
  // Tonos menores
  assert.deepEqual(keyView('Em', 'F#m', 2), { semis: 0, shapeKey: 'Em' })
})

test('propuesta de canciones y equipo', async () => {
  const { themeTags, proposeSongs, nextAlternative, proposeTeam } = await import('./propose.ts')
  assert.ok(themeTags('Fe en medio de la prueba').includes('confianza'))
  assert.ok(themeTags('Santa Cena').includes('cruz'))
  const mk = (id: string, title: string, tags: string[], content = '[G]letra') =>
    ({ id, title, artist: '', key: 'G', tags, content, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '' }) as never
  const songs = [
    mk('a1', 'Gozo', ['alabanza', 'gozo']),
    mk('a2', 'Fiel', ['alabanza', 'fidelidad']),
    mk('a3', 'Otra', ['alabanza']),
    mk('d1', 'Confío', ['adoración', 'confianza']),
    mk('d2', 'Océanos', ['adoración', 'fe', 'confianza']),
    mk('d3', 'Santo', ['adoración', 'santidad']),
  ]
  const history = [{ date: '2026-11-08', items: [{ songId: 'd2' }], updatedAt: '', updatedBy: '' }]
  const { picks, ranked } = proposeSongs(songs, { theme: 'fe y confianza', alabanza: 1, adoracion: 2, history, date: '2026-11-15' })
  assert.deepEqual(picks.map((p) => p.song.id), ['a2', 'd1', 'd2'])
  // Océanos se tocó el domingo pasado: queda detrás de "Confío"
  assert.ok(picks[2].reasons.includes('se tocó el domingo pasado'))
  // Cambiar "Fiel" por la siguiente alabanza
  assert.equal(nextAlternative(ranked, picks, picks[0].song)?.song.id !== 'a2', true)
  // Equipo: rota a quien hace más tiempo no toca
  const members = [
    { username: 'ana', name: 'Ana', roles: ['bateria', 'voz'] },
    { username: 'beto', name: 'Beto', roles: ['bateria'] },
    { username: 'caro', name: 'Caro', roles: ['direccion', 'acustica'] },
  ] as never
  const past = [{ date: '2026-11-08', items: [], team: [{ role: 'bateria', username: 'ana' }], updatedAt: '', updatedBy: '' }]
  const team = proposeTeam(members, past as never, '2026-11-15')
  assert.deepEqual(team.find((a) => a.role === 'bateria')?.username, 'beto')
  assert.ok(team.some((a) => a.role === 'direccion' && a.username === 'caro'))
  assert.ok(team.some((a) => a.role === 'acustica' && a.username === 'caro')) // dirigir + tocar sí
})

test('ritmos: cuadrícula, conteo y validación', async () => {
  const { gridFor, countLabels, cleanPattern, toggleHit, presets, stepSeconds } = await import('./rhythm.ts')
  assert.deepEqual(gridFor('Balada 4/4'), { beats: 4, sub: 4, steps: 16 })
  assert.deepEqual(gridFor('6/8'), { beats: 6, sub: 2, steps: 12 })
  assert.deepEqual(gridFor('3/4'), { beats: 3, sub: 4, steps: 12 })
  assert.deepEqual(countLabels(2, 4), ['1', 'e', 'y', 'a', '2', 'e', 'y', 'a'])
  assert.equal(stepSeconds(60, 4), 0.25)
  // El servidor limpia lo que no corresponde
  assert.deepEqual(cleanPattern({ steps: 16, hits: { bombo: [0, 0, 8, 99], cosa: [1] } }), { steps: 16, hits: { bombo: [0, 8] } })
  assert.equal(cleanPattern({ steps: 7, hits: { bombo: [0] } }), undefined)
  const p = toggleHit({ steps: 16, hits: {} }, 'caja', 4)
  assert.deepEqual(p.hits, { caja: [4] })
  assert.deepEqual(toggleHit(p, 'caja', 4).hits, {})
  for (const { pattern } of [...presets(16), ...presets(12)]) assert.deepEqual(cleanPattern(pattern), pattern)
})

test('biblioteca de ritmos y paso de los ritmos viejos', async () => {
  const { cleanDrums, rhythmOf } = await import('./drums.ts')
  const pat = { steps: 16, hits: { bombo: [0] } }
  // Ritmo viejo dentro de la sección → "Ritmo 1" en la biblioteca
  const a = cleanDrums({ sections: [{ name: 'Intro', parts: [], pattern: pat }] })!
  assert.equal(a.rhythms?.[0].name, 'Ritmo 1')
  assert.equal(a.sections[0].rhythm, a.rhythms?.[0].id)
  assert.equal(a.sections[0].pattern, undefined)
  assert.deepEqual(rhythmOf(a, a.sections[0])?.pattern, pat)
  // Biblioteca nueva: la sección apunta a un ritmo; ids raros se descartan
  const b = cleanDrums({ rhythms: [{ id: 'abc', name: 'Coro fuerte', pattern: pat }, { id: '<x>', name: 'malo', pattern: pat }], sections: [{ name: 'Coro', parts: [], rhythm: 'abc' }, { name: 'Verso', parts: [], rhythm: 'nada' }] })!
  assert.deepEqual(b.rhythms?.map((r) => r.name), ['Coro fuerte'])
  assert.equal(b.sections[0].rhythm, 'abc')
  assert.equal(b.sections[1].rhythm, undefined)
})

test('biblioteca de ritmos del equipo y asignación personal', async () => {
  const { cleanLibraryRhythm, meterOf } = await import('./rhythm.ts')
  const { cleanPersonalSong } = await import('./personal.ts')
  assert.deepEqual(cleanLibraryRhythm({ name: ' Pop ', meter: '4/4', bpm: 300, pattern: { steps: 16, hits: { bombo: [0] } } }), {
    name: 'Pop', meter: '4/4', bpm: 80, pattern: { steps: 16, hits: { bombo: [0] } },
  })
  assert.equal(cleanLibraryRhythm({ meter: '6/8', pattern: { steps: 16, hits: { bombo: [0] } } }), 'El ritmo no corresponde al compás')
  assert.equal(meterOf('6/8'), '6/8')
  assert.equal(meterOf('Balada 4/4'), '4/4')
  assert.deepEqual(cleanPersonalSong({ rhythms: { coro: 'ab12', 'MALO!': 'x', verso: '<x>' } }).rhythms, { coro: 'ab12' })
})
