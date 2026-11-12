// La canción vista como una lista de secciones (para reordenar, renombrar,
// duplicar o borrar). Código puro: se prueba con node --test.

import { parseChordPro } from './chordsheet.ts'

export interface Block {
  id: string
  kind: 'section' | 'cue'
  /** Nombre de la sección ("Coro"), o el texto del indicador. '' = sin nombre. */
  name: string
  /** Líneas ChordPro de la sección, sin el encabezado. */
  body: string[]
  /** Nombre que tenía al abrir el editor (para seguir el renombre en la batería). */
  origName?: string
}

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

function trimBlank(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    const blank = !l.trim()
    if (blank && (!out.length || !out[out.length - 1].trim())) continue // sin líneas vacías repetidas
    out.push(blank ? '' : l)
  }
  while (out.length && !out[out.length - 1].trim()) out.pop()
  return out
}

export function parseStructure(cp: string): Block[] {
  const raw = cp.replace(/\r\n?/g, '\n').split('\n')
  const parsed = parseChordPro(cp)
  const blocks: Block[] = []
  let cur: Block | null = null
  raw.forEach((line, i) => {
    const p = parsed[i]
    if (p?.type === 'section') {
      cur = { id: newId(), kind: 'section', name: p.name, origName: p.name, body: [] }
      blocks.push(cur)
      return
    }
    if (p?.type === 'cue') {
      blocks.push({ id: newId(), kind: 'cue', name: p.text, body: [] })
      cur = null
      return
    }
    // Directivas de cierre ({eoc}…) se descartan; quedan como separación
    const isDirective = /^\s*\{.*\}\s*$/.test(line)
    if (!cur) {
      if (!line.trim() || isDirective) return
      cur = { id: newId(), kind: 'section', name: '', origName: '', body: [] }
      blocks.push(cur)
    }
    cur.body.push(isDirective ? '' : line)
  })
  for (const b of blocks) b.body = trimBlank(b.body)
  return blocks
}

export function serializeStructure(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.kind === 'cue') return `{ci: ${b.name.replace(/[{}]/g, '').trim()}}`
      const head = b.name.trim() ? [`{c: ${b.name.replace(/[{}]/g, '').trim()}}`] : []
      return [...head, ...trimBlank(b.body)].join('\n')
    })
    .filter((s) => s.trim())
    .join('\n\n')
}

/** Mueve el bloque `from` para que quede antes de la posición `to` (0…length). */
export function moveBlock<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [it] = next.splice(from, 1)
  next.splice(to > from ? to - 1 : to, 0, it)
  return next
}

/** Renombres hechos en el editor: nombre original → nombre nuevo. */
export function renames(blocks: Block[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const b of blocks) if (b.kind === 'section' && b.origName && b.name.trim() && b.origName !== b.name.trim()) m.set(b.origName, b.name.trim())
  return m
}

// ---- Editar solo la letra de una sección, sin ver acordes

type Chorded = { text: string; chords: { at: number; chord: string }[] }

/** Separa una línea ChordPro en texto y acordes (con su posición en el texto). */
function splitLine(line: string): Chorded {
  const chords: { at: number; chord: string }[] = []
  let text = ''
  let last = 0
  const re = /\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    text += line.slice(last, m.index)
    chords.push({ at: text.length, chord: m[1] })
    last = m.index + m[0].length
  }
  text += line.slice(last)
  return { text, chords }
}

function joinLine({ text, chords }: Chorded): string {
  let out = text.replace(/\s+$/, '')
  const sorted = [...chords].sort((a, b) => b.at - a.at)
  for (const c of sorted) {
    const at = Math.min(c.at, out.length)
    out = out.slice(0, at) + `[${c.chord}]` + out.slice(at)
  }
  return out
}

const words = (t: string) => [...t.matchAll(/\S+/g)].map((m) => ({ start: m.index!, len: m[0].length }))

/**
 * Pasa los acordes de una línea vieja a su versión corregida, palabra por
 * palabra: un acorde sobre la 3.ª palabra sigue sobre la 3.ª palabra.
 */
export function moveChords(old: Chorded, newText: string): Chorded {
  const ow = words(old.text)
  const nw = words(newText)
  const chords = old.chords.map(({ at, chord }) => {
    if (!ow.length || !nw.length) return { at: Math.min(at, newText.length), chord }
    // palabra donde estaba el acorde (o la siguiente si caía en un espacio)
    let k = ow.findIndex((w) => at < w.start + w.len)
    if (k < 0) return { at: newText.length + (at - old.text.length > 0 ? 1 : 0), chord } // al final de la línea
    const off = Math.max(0, at - ow[k].start)
    if (k >= nw.length) k = nw.length - 1
    return { at: nw[k].start + Math.min(off, nw[k].len - 1), chord }
  })
  return { text: newText, chords }
}

/** Texto de la letra de una sección (sin acordes ni líneas de solo acordes). */
export function lyricsOf(body: string[]): string {
  return body
    .filter((l) => {
      const p = parseChordPro(l)[0]
      return p.type === 'lyrics' || p.type === 'empty'
    })
    .map((l) => splitLine(l).text.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

/** Alineación de líneas viejas y nuevas (las iguales se reconocen). */
function align(a: string[], b: string[]): ([number, number] | [number, null] | [null, number])[] {
  const n = a.length
  const m = b.length
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const ops: ([number, number] | [number, null] | [null, number])[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push([i++, j++])
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) ops.push([null, j++])
    else ops.push([i++, null])
  }
  // Dentro de cada tramo cambiado, una línea borrada + una agregada = línea corregida
  const out: typeof ops = []
  for (let k = 0; k < ops.length; ) {
    if (ops[k][0] !== null && ops[k][1] !== null) {
      out.push(ops[k++])
      continue
    }
    const dels: number[] = []
    const ins: number[] = []
    while (k < ops.length && (ops[k][0] === null || ops[k][1] === null)) {
      const [x, y] = ops[k++]
      if (x !== null) dels.push(x)
      else ins.push(y as number)
    }
    const pairs = Math.min(dels.length, ins.length)
    for (let p = 0; p < pairs; p++) out.push([dels[p], ins[p]])
    for (let p = pairs; p < dels.length; p++) out.push([dels[p], null])
    for (let p = pairs; p < ins.length; p++) out.push([null, ins[p]])
  }
  return out
}

/**
 * Aplica la letra corregida a la sección y devuelve sus líneas ChordPro con
 * los acordes reubicados. Las líneas de solo acordes (intros, riffs) se
 * conservan en su lugar.
 */
export function applyLyrics(body: string[], newText: string): string[] {
  // Líneas de letra (incluye vacías) y, antes de cada una, las de solo acordes
  const lyric: { line: string; before: string[] }[] = []
  let pending: string[] = []
  for (const l of body) {
    const t = parseChordPro(l)[0].type
    if (t === 'lyrics' || t === 'empty') {
      lyric.push({ line: l, before: pending })
      pending = []
    } else pending.push(l)
  }
  const trailing = pending
  // Se ignoran líneas vacías al principio y al final, igual que en lyricsOf
  while (lyric.length && !splitLine(lyric[0].line).text.trim() && !lyric[0].before.length) lyric.shift()
  while (lyric.length && !splitLine(lyric[lyric.length - 1].line).text.trim()) trailing.unshift(...lyric.pop()!.before)

  const oldTexts = lyric.map((x) => splitLine(x.line).text.replace(/\s+$/, ''))
  const newLines = newText.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '').split('\n').map((l) => l.replace(/\s+$/, ''))
  const out: string[] = []
  for (const [oi, ni] of align(oldTexts, newLines)) {
    if (oi !== null) out.push(...lyric[oi].before)
    if (ni === null) continue // línea borrada
    if (oi === null) out.push(newLines[ni]) // línea nueva, sin acordes
    else out.push(oldTexts[oi] === newLines[ni] ? lyric[oi].line.replace(/\s+$/, '') : joinLine(moveChords(splitLine(lyric[oi].line), newLines[ni])))
  }
  out.push(...trailing)
  return out
}
