// Cálculo del pulso visual. Código puro para poder probarlo.

/** Tiempos por compás según el feel de la batería. */
export function beatsPerBar(feel?: string): number {
  if (!feel) return 4
  if (/6\/8/.test(feel)) return 6
  if (/3\/4/.test(feel)) return 3
  return 4
}

/** Número de golpe (0, 1, 2…) que corresponde a este instante. */
export const beatAt = (now: number, start: number, bpm: number) => Math.floor((now - start) / (60000 / bpm))
