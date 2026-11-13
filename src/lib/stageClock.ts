/**
 * Relojes del modo tarima: el tiempo total de ministración y el de cada
 * canción. Se suma con el reloj real (Date.now) en cada tic, así no se atrasa
 * si la tablet va lenta; si pasó demasiado entre tics (la app estuvo cerrada
 * mucho rato), ese hueco no se cuenta.
 */
export interface StageClock {
  running: boolean
  total: number
  perSong: Record<string, number>
  last?: number
}

export const MAX_GAP = 20 * 60_000

export const newClock = (now: number): StageClock => ({ running: true, total: 0, perSong: {}, last: now })

/** Suma el tiempo desde el último tic a la canción que está en pantalla. */
export function tick(c: StageClock, now: number, songId: string | undefined): StageClock {
  if (!c.running || c.last === undefined) return { ...c, last: now }
  const d = now - c.last
  if (d <= 0 || d > MAX_GAP) return { ...c, last: now }
  return {
    ...c,
    total: c.total + d,
    perSong: songId ? { ...c.perSong, [songId]: (c.perSong[songId] ?? 0) + d } : c.perSong,
    last: now,
  }
}

export const pause = (c: StageClock, now: number, songId?: string): StageClock => ({ ...tick(c, now, songId), running: false })
export const resume = (c: StageClock, now: number): StageClock => ({ ...c, running: true, last: now })

/** 75000 → "1:15"; 3725000 → "1:02:05". */
export function formatClock(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function readClock(raw: string | null): StageClock | null {
  try {
    const o = JSON.parse(raw ?? 'null')
    if (!o || typeof o.total !== 'number' || typeof o.perSong !== 'object') return null
    return { running: !!o.running, total: o.total, perSong: o.perSong, last: typeof o.last === 'number' ? o.last : undefined }
  } catch {
    return null
  }
}
