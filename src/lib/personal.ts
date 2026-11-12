// Lo que cada persona guarda para sí en cada canción (no lo ve el resto).

export interface PersonalSong {
  /** Capo que usa esta persona (0 = sin capo). */
  capo?: number
  /** Notas y arreglos propios. */
  notes?: string
  /** Qué ritmo de la biblioteca va en cada sección (clave: nombre de sección normalizado). */
  rhythms?: Record<string, string>
  updatedAt?: string
}

export type Personal = Record<string, PersonalSong>

export function cleanPersonalSong(v: unknown): PersonalSong {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const capo = Number(o.capo)
  const rhythms: Record<string, string> = {}
  if (o.rhythms && typeof o.rhythms === 'object')
    for (const [k, v] of Object.entries(o.rhythms as Record<string, unknown>).slice(0, 40))
      if (/^[a-z ]{1,40}$/.test(k) && typeof v === 'string' && /^[a-z0-9]{1,20}$/.test(v)) rhythms[k] = v
  return {
    capo: Number.isInteger(capo) && capo > 0 && capo <= 11 ? capo : undefined,
    notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes.slice(0, 3000) : undefined,
    rhythms: Object.keys(rhythms).length ? rhythms : undefined,
  }
}
