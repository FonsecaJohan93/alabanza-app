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
