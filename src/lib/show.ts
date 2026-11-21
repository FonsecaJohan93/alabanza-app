/**
 * Qué se ve en la pantalla de una canción. Cada persona elige su forma por
 * defecto en "Mi perfil" y en cada canción la cambia con el menú "Ver".
 * (Antes se decidía por instrumento; al equipo no le sirvió.)
 */
export interface Show {
  chords: boolean
  lyrics: boolean
  cues: boolean
  tempo: boolean
  drums: boolean
  notes: boolean
  big: boolean
  auto: boolean
}

export const SHOW_ITEMS: { id: keyof Show; label: string; hint: string }[] = [
  { id: 'chords', label: 'Acordes', hint: 'Los acordes sobre la letra' },
  { id: 'lyrics', label: 'Letra', hint: 'Sin letra quedan solo los acordes de cada sección' },
  { id: 'cues', label: 'Indicaciones del equipo', hint: '“Coro 2 veces”, “entra la batería”…' },
  { id: 'tempo', label: 'Tempo grande', hint: 'BPM con 1 2 3 4 y la campana' },
  { id: 'drums', label: 'Batería por sección', hint: 'Matices (suave, fuerte…) y ▶ del ritmo' },
  { id: 'notes', label: 'Mis notas y arreglos', hint: 'Lo que escribiste para ti' },
  { id: 'big', label: 'Letra grande', hint: 'Para cantar: la letra más grande' },
  { id: 'auto', label: 'Autoscroll', hint: 'La hoja avanza sola (en horizontal, de columna en columna)' },
]

export const DEFAULT_SHOW: Show = { chords: true, lyrics: true, cues: true, tempo: false, drums: false, notes: true, big: false, auto: false }

/** Lo que llega del cliente: solo interruptores conocidos y booleanos. */
export function cleanShow(v: unknown): Show | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const out = { ...DEFAULT_SHOW }
  for (const { id } of SHOW_ITEMS) if (typeof o[id] === 'boolean') out[id] = o[id] as boolean
  return out
}

/**
 * Mi forma por defecto. Quien ya había elegido una vista antes (solo letra,
 * batería…) arranca con algo parecido hasta que la cambie.
 */
export function defaultShow(prefs: { show?: Show; view?: string }): Show {
  if (prefs.show) return { ...DEFAULT_SHOW, ...prefs.show }
  if (prefs.view === 'letra') return { ...DEFAULT_SHOW, chords: false, big: true }
  if (prefs.view === 'bateria') return { ...DEFAULT_SHOW, chords: false, tempo: true, drums: true }
  if (prefs.view === 'todo') return { ...DEFAULT_SHOW, tempo: true, drums: true }
  return DEFAULT_SHOW
}
