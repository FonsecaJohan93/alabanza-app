// Todo lo que sabe la app sobre hojas de acordes. Código puro (sin React ni
// navegador) para usarlo también desde las funciones de Netlify.
//
// Las canciones se guardan en ChordPro simplificado:
//   {c: Coro}                     → título de sección
//   [G]Cuán grande es [D]Él        → letra con acordes en línea
//   [D]  [G]  [A]                  → línea solo de acordes (intro, interludio)
// Los músicos, en cambio, suelen escribir "acordes arriba": una línea de
// acordes sobre la de la letra. Este módulo convierte entre los dos.

// ---------------------------------------------------------------- acordes

const CHORD_RE =
  /^[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|°|º|\+|-)?(?:\d+|maj\d*|M\d*|sus\d*|add\d+|dim\d*|aug|b\d+|#\d+|\+\d*|-\d*|\/\d+)*(?:\([^)\s]*\))?(?:\/[A-G](?:#|b)?)?$/

/** Fichas que pueden aparecer en una línea de acordes sin ser acordes. */
const FILLER_RE = /^(?:\|+|-+|\/|%|\.+|x\d+|\(x\d+\)|\d+x|\(\d+x\)|:\|?|\|:)$/i

export function isChord(token: string): boolean {
  return CHORD_RE.test(token)
}

/**
 * Acordes con escritura rara que aparecen en las páginas ("C#mD", "Gmaj7sus").
 * Empiezan con nota y, quitando sufijos conocidos, no les queda ninguna
 * minúscula: así "Dios", "Amor" o "Eres" no cuentan.
 */
function looksLikeChord(token: string): boolean {
  if (!/^[A-G][#b]?[\w#+°º()/-]*$/.test(token)) return false
  const rest = token.slice(1).replace(/maj|min|dim|aug|sus|add|m|b/g, '')
  return !/[a-z]/.test(rest)
}

/** ¿La línea tiene solo acordes (y separadores como | o x2)? */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  let chords = 0
  let odd = 0
  for (const raw of tokens) {
    // Algunos transcriptores escriben "Dm." o "G," : se ignora ese signo
    const t = raw.replace(/^\(+|\)+$/g, '').replace(/[.,;]+$/, '')
    if (!t) continue // "(" o ")" sueltos: "( Bm  A  G )"
    if (isChord(t)) chords++
    else if (looksLikeChord(t)) odd++
    else if (!FILLER_RE.test(raw) && !FILLER_RE.test(t)) return false
  }
  // Solo acordes raros ("C#7(4/9-)"): vale si alguno lleva número o alteración
  return chords > 0 || (odd > 0 && tokens.some((t) => /[\d#]/.test(t)))
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteIndex(note: string): number {
  const i = SHARPS.indexOf(note)
  return i >= 0 ? i : FLATS.indexOf(note)
}

function shiftNote(note: string, semis: number, flats: boolean): string {
  const i = noteIndex(note)
  if (i < 0) return note
  return (flats ? FLATS : SHARPS)[(((i + semis) % 12) + 12) % 12]
}

/**
 * Transpone un tono como "G" o "Em". El equipo prefiere los nombres en
 * sostenidos (C#m, no Dbm), así que siempre se escriben así.
 */
export function transposeKey(key: string, semis: number): string {
  const m = /^([A-G][#b]?)(m?)$/.exec(key.trim())
  if (!m) return key
  return shiftNote(m[1], semis, false) + m[2]
}

/** El mismo tono escrito en sostenidos: "Ebm" → "D#m", "Bb" → "A#". */
export const sharpKey = (key: string) => (key ? transposeKey(key, 0) : key)

/** Transpone un acorde (siempre en sostenidos); los que no reconoce los deja tal cual. */
export function transposeChord(chord: string, semis: number, _targetKey?: string): string {
  // Sin transponer, igual se pasan los bemoles a sostenidos ("Bb" → "A#")
  if (!semis && !/^[A-G]b|\/[A-G]b|[A-G]b/.test(chord)) return chord
  // Escritura rara ("C#mD"): se mueve cada nota que aparezca
  if (!isChord(chord)) return looksLikeChord(chord) ? chord.replace(/[A-G][#b]?/g, (n) => shiftNote(n, semis, false)) : chord
  return chord
    .replace(/^([A-G][#b]?)/, (n) => shiftNote(n, semis, false))
    .replace(/\/([A-G][#b]?)$/, (_, n) => '/' + shiftNote(n, semis, false))
}

/** Tono probable: el del primer acorde de la canción. */
export function guessKey(chordpro: string): string {
  const m = /\[([A-G][#b]?)(m(?!aj))?[^\]]*\]/.exec(chordpro)
  return m ? m[1] + (m[2] ?? '') : ''
}

/** Semitonos para pasar de un tono a otro (−5…+6). */
export function semitonesBetween(from: string, to: string): number {
  const a = noteIndex(from.replace(/m$/, ''))
  const b = noteIndex(to.replace(/m$/, ''))
  if (a < 0 || b < 0) return 0
  const d = (((b - a) % 12) + 12) % 12
  return d > 6 ? d - 12 : d
}

const OPEN_SHAPES = ['G', 'C', 'D', 'A', 'E', 'Em', 'Am', 'Dm']

/** Para guitarra: con qué capo se toca el tono usando formas abiertas. */
export function capoSuggestion(key: string): { capo: number; shape: string } | null {
  if (!/^[A-G][#b]?m?$/.test(key)) return null
  for (let capo = 0; capo <= 7; capo++) {
    const shape = transposeKey(key, -capo)
    const plain = shape.replace('Db', 'C#').replace('Gb', 'F#')
    if (OPEN_SHAPES.includes(plain)) return capo === 0 ? null : { capo, shape: plain }
  }
  return null
}

// ---------------------------------------------------------------- secciones

const SECTION_WORDS =
  'intro|introducci[oó]n|coro|estribillo|pre-?coro|pre coro|pre-?estribillo|verso|estrofa|puente|final|outro|coda|instrumental|interludio|solo|tag|tab|vamp|' +
  '(?:primera|segunda|tercera|cuarta) parte|' +
  'chorus|pre-?chorus|verse|bridge|ending|' +
  'refr[aã]o|pr[eé]-?refr[aã]o|p[oó]s-?refr[aã]o|post-?coro|pos-?coro|primeira parte|segunda parte|terceira parte|parte|ponte|introdu[cç][aã]o'
const SECTION_RE = new RegExp(`^\\s*[\\[(]?\\s*((?:${SECTION_WORDS})\\b[^\\])]{0,20})[\\])]?\\s*:?\\s*$`, 'i')

/** "Coro:", "[Puente]", "(Verso 2)" → nombre de la sección, o null. */
export function sectionName(line: string): string | null {
  const m = SECTION_RE.exec(line)
  if (!m) return null
  const name = m[1].trim().replace(/:$/, '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ---------------------------------------------------------------- acordes arriba → ChordPro

export interface SourceLine {
  text: string
  /** Si se sabe de antemano (p. ej. el HTML lo marca), si es una línea de acordes. */
  isChords?: boolean
}

function chordPositions(line: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) out.push({ col: m.index, chord: m[0] })
  return out
}

function mergeChordsIntoLyrics(chordLine: string, lyric: string): string {
  let text = lyric.replace(/\s+$/, '')
  const end = text.length
  // Un acorde que cae sobre un espacio se pega a la palabra siguiente (si no,
  // queda un hueco raro en la letra al mostrarla)
  const chords = chordPositions(chordLine).map(({ col, chord: raw }) => {
    const chord = raw.replace(/(?<=\S)[.,;]+$/, '')
    if (col >= end || text[col] !== ' ') return { col, chord }
    let c = col
    while (c < end && text[c] === ' ') c++
    return { col: c, chord }
  })
  const last = chords[chords.length - 1]
  if (last && last.col > text.length) text = text.padEnd(last.col, ' ')
  for (let i = chords.length - 1; i >= 0; i--) {
    const { col, chord } = chords[i]
    text = text.slice(0, col) + `[${chord}]` + text.slice(col)
  }
  return text.replace(/\s+$/, '')
}

function chordOnlyLine(line: string): string {
  return chordPositions(line)
    .map((c) => ({ ...c, chord: c.chord.replace(/(?<=\S)[.,;]+$/, '') }))
    .map((c) => (isChord(c.chord.replace(/^\(+|\)+$/g, '')) || /[A-G]/.test(c.chord[0]) ? `[${c.chord}]` : c.chord))
    .join('  ')
}

export function linesToChordPro(lines: SourceLine[]): string {
  const src = lines.map((l) => ({ text: l.text.replace(/\t/g, '    ').replace(/\s+$/, ''), isChords: l.isChords }))
  const chordish = (i: number) => {
    const l = src[i]
    if (!l || !l.text.trim()) return false
    return l.isChords ?? isChordLine(l.text)
  }
  const out: string[] = []
  for (let i = 0; i < src.length; i++) {
    const { text } = src[i]
    if (!text.trim()) {
      out.push('')
      continue
    }
    if (chordish(i)) {
      const next = src[i + 1]
      const nextIsLyric = next && next.text.trim() && !chordish(i + 1) && !sectionName(next.text)
      if (nextIsLyric) {
        out.push(mergeChordsIntoLyrics(text, next.text))
        i++
      } else out.push(chordOnlyLine(text))
      continue
    }
    // "[Intro] D G A" (Cifra Club): sección y acordes en la misma línea
    const inline = /^\s*\[([^\]]+)\]\s+(.+)$/.exec(text)
    if (inline && sectionName(inline[1]) && isChordLine(inline[2])) {
      out.push(`{c: ${sectionName(inline[1])}}`)
      out.push(chordOnlyLine(inline[2]))
      continue
    }
    // ">> Otra vez al coro": indicador para el equipo
    const cue = /^\s*>>\s*(.+)$/.exec(text)
    if (cue) {
      out.push(`{ci: ${cue[1].trim()}}`)
      continue
    }
    const sec = sectionName(text)
    if (sec) {
      out.push(`{c: ${sec}}`)
      continue
    }
    // Letra suelta: se escapan los corchetes para que no parezcan acordes
    out.push(text.replace(/\[/g, '(').replace(/\]/g, ')'))
  }
  return collapseBlankLines(out.join('\n'))
}

export function textToChordPro(text: string): string {
  return linesToChordPro(text.replace(/\r\n?/g, '\n').split('\n').map((t) => ({ text: t })))
}

function collapseBlankLines(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}

// ---------------------------------------------------------------- ChordPro → estructura

export type SheetLine =
  | { type: 'section'; name: string }
  | { type: 'empty' }
  | { type: 'chords'; chords: string[] }
  | { type: 'lyrics'; parts: { chord?: string; text: string }[] }
  | { type: 'tab'; text: string }
  /** Indicador para el equipo: "Otra vez al coro", "Solo instrumental"… */
  | { type: 'cue'; text: string }

const TAB_RE = /^\s*[eBGDAEbgdae]\s*[|:]?[-\d|hpbrx/\\~]{4,}/

export function parseChordPro(cp: string): SheetLine[] {
  return cp
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw): SheetLine => {
      const line = raw.replace(/\s+$/, '')
      if (!line.trim()) return { type: 'empty' }
      const dir = /^\s*\{\s*(c|comment|ci|comment_italic|soc|start_of_chorus|sov|start_of_verse|sob|start_of_bridge|eoc|end_of_chorus|eov|end_of_verse|eob|end_of_bridge)\s*(?::\s*(.*?))?\s*\}\s*$/i.exec(line)
      if (dir) {
        const k = dir[1].toLowerCase()
        if (k === 'ci' || k === 'comment_italic') return dir[2] ? { type: 'cue', text: dir[2] } : { type: 'empty' }
        if (k.startsWith('e')) return { type: 'empty' }
        const fallback = /chorus|soc/.test(k) ? 'Coro' : /bridge|sob/.test(k) ? 'Puente' : /verse|sov/.test(k) ? 'Verso' : ''
        return { type: 'section', name: dir[2] || fallback }
      }
      if (/^\s*\{.*\}\s*$/.test(line)) return { type: 'empty' } // otras directivas: se ignoran
      if (TAB_RE.test(line) && !line.includes('[')) return { type: 'tab', text: line }
      const parts: { chord?: string; text: string }[] = []
      const re = /\[([^\]]*)\]/g
      let last = 0
      let pending: string | undefined
      let m: RegExpExecArray | null
      while ((m = re.exec(line))) {
        const before = line.slice(last, m.index)
        if (before || pending !== undefined) parts.push({ chord: pending, text: before })
        pending = m[1].trim()
        last = m.index + m[0].length
      }
      const rest = line.slice(last)
      if (rest || pending !== undefined) parts.push({ chord: pending, text: rest })
      const chordsOnly = parts.every((p) => !p.text.trim()) && parts.some((p) => p.chord)
      if (chordsOnly) return { type: 'chords', chords: parts.map((p) => p.chord).filter((c): c is string => !!c) }
      return { type: 'lyrics', parts }
    })
}

// ---------------------------------------------------------------- ChordPro → acordes arriba

export function chordProToText(cp: string): string {
  return parseChordPro(cp)
    .flatMap((l): string[] => {
      switch (l.type) {
        case 'empty':
          return ['']
        case 'section':
          return [`${l.name}:`]
        case 'cue':
          return [`>> ${l.text}`]
        case 'tab':
          return [l.text]
        case 'chords':
          return [l.chords.join('   ')]
        case 'lyrics': {
          let lyric = ''
          let chords = ''
          for (const p of l.parts) {
            if (p.chord) {
              // Si el acorde anterior es largo, este se corre un poco a la derecha
              const col = Math.max(lyric.length, chords.length ? chords.length + 1 : 0)
              chords = chords.padEnd(col, ' ') + p.chord
            }
            lyric += p.text
          }
          return chords.trim() ? [chords, lyric.replace(/\s+$/, '')] : [lyric]
        }
      }
    })
    .join('\n')
}

/** Aplica la transposición al texto ChordPro (para guardar un tono nuevo). */
export function transposeChordPro(cp: string, semis: number, targetKey?: string): string {
  if (!semis) return cp
  return cp.replace(/\[([^\]]+)\]/g, (_, c: string) => `[${transposeChord(c.trim(), semis, targetKey)}]`)
}

/** Texto plano de la letra, para buscar canciones por lo que dicen. */
export function lyricsOnly(cp: string): string {
  return parseChordPro(cp)
    .filter((l) => l.type === 'lyrics')
    .map((l) => (l.type === 'lyrics' ? l.parts.map((p) => p.text).join('') : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Agrega un indicador antes de la línea `beforeLine` (índice de línea del ChordPro). */
export function insertCue(cp: string, beforeLine: number, text: string): string {
  const lines = cp.split('\n')
  lines.splice(Math.max(0, Math.min(beforeLine, lines.length)), 0, `{ci: ${text.replace(/[{}]/g, '').trim()}}`)
  return lines.join('\n')
}

/** Quita la línea `line` (para borrar un indicador). */
export function removeLine(cp: string, line: number): string {
  const lines = cp.split('\n')
  lines.splice(line, 1)
  return lines.join('\n')
}

export interface SheetBlock {
  /** Índice (en el ChordPro) de la primera línea del bloque. */
  start: number
  lines: { line: SheetLine; index: number }[]
}

/**
 * Agrupa la hoja en bloques (estrofas): se corta en cada línea vacía y en
 * cada sección. Los indicadores van en su propio bloque. Sirve para no partir
 * una estrofa entre columnas y para poner indicadores entre párrafos.
 */
export function blocksOf(lines: SheetLine[]): SheetBlock[] {
  const blocks: SheetBlock[] = []
  let cur: SheetBlock | null = null
  lines.forEach((line, index) => {
    if (line.type === 'empty') {
      // Una sección sola sigue esperando su letra aunque haya líneas vacías
      if (cur && cur.lines.length === 1 && cur.lines[0].line.type === 'section') return
      cur = null
      return
    }
    if (line.type === 'section' || line.type === 'cue' || !cur || cur.lines[0]?.line.type === 'cue') {
      cur = { start: index, lines: [] }
      blocks.push(cur)
    }
    cur.lines.push({ line, index })
    if (line.type === 'cue') cur = null
  })
  return blocks
}

/**
 * Cómo ve una persona la hoja: la canción está escrita en `written`, el
 * equipo la toca en `sounding` (el tono del domingo) y la persona usa
 * `capo`. Devuelve cuántos semitonos mover los acordes escritos y en qué
 * tono quedan las formas que va a tocar.
 */
export function keyView(written: string, sounding: string, capo = 0): { semis: number; shapeKey: string } {
  const shapeKey = capo ? transposeKey(sounding, -capo) : sounding
  return { semis: written && shapeKey ? semitonesBetween(written, shapeKey) : 0, shapeKey }
}
