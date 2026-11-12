// Hoja de batería de una canción: el feel general y, por sección, qué piezas
// se tocan y con qué dinámica. Código puro: lo usan el cliente y el servidor.

import { parseChordPro } from './chordsheet.ts'

export const DRUM_PARTS = [
  { id: 'bombo', label: 'Bombo' },
  { id: 'caja', label: 'Caja' },
  { id: 'aro', label: 'Aro' },
  { id: 'hihat', label: 'Hi-hat' },
  { id: 'ride', label: 'Ride' },
  { id: 'crash', label: 'Platos' },
  { id: 'toms', label: 'Toms' },
] as const

export const DYNAMICS = [
  { id: 'silencio', label: 'Sin batería' },
  { id: 'suave', label: 'Suave' },
  { id: 'medio', label: 'Medio' },
  { id: 'fuerte', label: 'Fuerte' },
  { id: 'crescendo', label: 'Crescendo' },
  { id: 'decrescendo', label: 'Decrescendo' },
  { id: 'corte', label: 'Corte' },
] as const

export const FEELS = ['Balada 4/4', '4/4 corcheas', '4/4 semicorcheas', 'Half-time', '6/8', 'Shuffle', 'Fiesta / latino', '3/4']

export type DrumPart = (typeof DRUM_PARTS)[number]['id']
export type Dynamic = (typeof DYNAMICS)[number]['id']

export interface DrumSection {
  name: string
  parts: DrumPart[]
  dynamic?: Dynamic
  note?: string
}

export interface DrumChart {
  feel?: string
  note?: string
  sections: DrumSection[]
}

const PART_IDS = new Set<string>(DRUM_PARTS.map((p) => p.id))
const DYN_IDS = new Set<string>(DYNAMICS.map((d) => d.id))

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Limpia lo que llega del cliente (el servidor no confía en nada). */
export function cleanDrums(v: unknown): DrumChart | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const sections = (Array.isArray(o.sections) ? o.sections : [])
    .slice(0, 30)
    .map((s): DrumSection | null => {
      if (!s || typeof s !== 'object') return null
      const r = s as Record<string, unknown>
      const name = str(r.name, 40)
      if (!name) return null
      const parts = (Array.isArray(r.parts) ? r.parts : []).filter((p): p is DrumPart => typeof p === 'string' && PART_IDS.has(p))
      const dynamic = typeof r.dynamic === 'string' && DYN_IDS.has(r.dynamic) ? (r.dynamic as Dynamic) : undefined
      return { name, parts: [...new Set(parts)], dynamic, note: str(r.note, 300) || undefined }
    })
    .filter((s): s is DrumSection => !!s)
  const chart: DrumChart = { feel: str(o.feel, 40) || undefined, note: str(o.note, 1000) || undefined, sections }
  return chart.feel || chart.note || sections.length ? chart : undefined
}

/** Nombre "base" de una sección para emparejar: "Coro 2" y "CORO:" → "coro". */
export const sectionKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** La indicación de batería para una sección de la hoja (por nombre). */
export function drumsFor(chart: DrumChart | undefined, sectionName: string): DrumSection | undefined {
  if (!chart) return undefined
  const k = sectionKey(sectionName)
  return chart.sections.find((s) => sectionKey(s.name) === k) ?? chart.sections.find((s) => k.startsWith(sectionKey(s.name)))
}

/**
 * Propuesta inicial a partir de las secciones de la canción (sin repetir).
 * Los puentes empiezan en crescendo; el resto queda para que el baterista lo llene.
 */
export function chartFromSong(content: string): DrumChart {
  const seen = new Set<string>()
  const sections: DrumSection[] = []
  for (const l of parseChordPro(content)) {
    if (l.type !== 'section') continue
    const base = l.name.replace(/\s*\d+$/, '')
    const k = sectionKey(base)
    if (!k || seen.has(k)) continue
    seen.add(k)
    sections.push({ name: base, parts: [], dynamic: /puente|bridge|ponte/.test(k) ? 'crescendo' : undefined })
  }
  if (!sections.length) sections.push({ name: 'Verso', parts: [] }, { name: 'Coro', parts: [] })
  return { sections }
}
