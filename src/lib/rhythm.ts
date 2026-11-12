// Ritmos de batería por sección: una cuadrícula de golpes por pieza.
// Código puro (sin audio) para poder probarlo y validarlo en el servidor.

import { DRUM_PARTS, type DrumPart } from './drums.ts'
import { beatsPerBar } from './pulse.ts'

export interface Pattern {
  /** Casillas por compás (16 en 4/4, 12 en 3/4 y 6/8). */
  steps: number
  /** Golpes de cada pieza: índices de casilla (0…steps-1). */
  hits: Partial<Record<DrumPart, number[]>>
}

/** Subdivisión: semicorcheas, salvo 6/8 que se cuenta en corcheas de a 2. */
export function gridFor(feel?: string): { beats: number; sub: number; steps: number } {
  const beats = beatsPerBar(feel)
  const sub = feel && /6\/8/.test(feel) ? 2 : 4
  return { beats, sub, steps: beats * sub }
}

/** Duración de una casilla en segundos a cierto BPM. */
export const stepSeconds = (bpm: number, sub: number) => 60 / bpm / sub

/** Etiqueta de conteo de cada casilla: "1 e y a 2 e y a…" o "1 y 2 y…" en 6/8. */
export function countLabels(beats: number, sub: number): string[] {
  const parts = sub === 4 ? ['', 'e', 'y', 'a'] : ['', 'y']
  return Array.from({ length: beats * sub }, (_, i) => (i % sub === 0 ? String(i / sub + 1) : parts[i % sub]))
}

// Se calcula al usarla: drums.ts y este archivo se importan mutuamente
const partIds = () => new Set<string>(DRUM_PARTS.map((p) => p.id))

export function cleanPattern(v: unknown): Pattern | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const steps = Number(o.steps)
  if (![12, 16].includes(steps)) return undefined
  const PART_IDS = partIds()
  const hits: Pattern['hits'] = {}
  const raw = (o.hits && typeof o.hits === 'object' ? o.hits : {}) as Record<string, unknown>
  for (const [part, list] of Object.entries(raw)) {
    if (!PART_IDS.has(part) || !Array.isArray(list)) continue
    const idx = [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < steps))].sort((a, b) => a - b)
    if (idx.length) hits[part as DrumPart] = idx
  }
  return Object.keys(hits).length ? { steps, hits } : undefined
}

export const hasHit = (p: Pattern, part: DrumPart, step: number) => !!p.hits[part]?.includes(step)

export function toggleHit(p: Pattern, part: DrumPart, step: number): Pattern {
  const cur = p.hits[part] ?? []
  const next = cur.includes(step) ? cur.filter((s) => s !== step) : [...cur, step].sort((a, b) => a - b)
  const hits = { ...p.hits, [part]: next }
  if (!next.length) delete hits[part]
  return { ...p, hits }
}

/** Ritmos base para empezar (luego se editan). */
export function presets(steps: number): { name: string; pattern: Pattern }[] {
  if (steps === 12)
    return [
      { name: '6/8 balada', pattern: { steps, hits: { bombo: [0], aro: [6], hihat: [0, 2, 4, 6, 8, 10] } } },
      { name: '6/8 movido', pattern: { steps, hits: { bombo: [0, 6], caja: [6], hihat: [0, 2, 4, 6, 8, 10], crash: [0] } } },
      { name: '3/4 vals', pattern: { steps, hits: { bombo: [0], caja: [4, 8], hihat: [0, 4, 8] } } },
    ]
  return [
    { name: 'Balada', pattern: { steps, hits: { bombo: [0, 10], aro: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] } } },
    { name: 'Pop 8', pattern: { steps, hits: { bombo: [0, 6, 8], caja: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] } } },
    { name: 'Half-time', pattern: { steps, hits: { bombo: [0, 6], caja: [8], ride: [0, 2, 4, 6, 8, 10, 12, 14] } } },
    { name: 'Fiesta', pattern: { steps, hits: { bombo: [0, 4, 8, 12], caja: [2, 6, 10, 14], hihat: [2, 6, 10, 14], toms: [15] } } },
    { name: 'Coro con todo', pattern: { steps, hits: { bombo: [0, 3, 8, 11], caja: [4, 12], crash: [0], ride: [0, 2, 4, 6, 8, 10, 12, 14] } } },
  ]
}
