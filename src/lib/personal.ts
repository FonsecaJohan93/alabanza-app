// Lo que cada persona guarda para sí en cada canción (no lo ve el resto).

export interface PersonalSong {
  /** Capo que usa esta persona (0 = sin capo). */
  capo?: number
  /** Notas y arreglos propios. */
  notes?: string
  updatedAt?: string
}

export type Personal = Record<string, PersonalSong>

export function cleanPersonalSong(v: unknown): PersonalSong {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const capo = Number(o.capo)
  return {
    capo: Number.isInteger(capo) && capo > 0 && capo <= 11 ? capo : undefined,
    notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes.slice(0, 3000) : undefined,
  }
}
