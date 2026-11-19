/**
 * Mensajes en vivo del modo tarima: Dirección los lanza ("Última vuelta",
 * "Crescendo"…) y todo el equipo que está en tarima los ve en grande.
 * Código puro: lo usan el cliente y la función del servidor.
 */
export interface LiveMessage {
  id: string
  text: string
  /** Canción en la que estaba Dirección al mandarlo. */
  song?: string
  by: string
  at: number
}

export const LIVE_PRESETS = ['De vuelta al coro', 'Última vuelta', 'Crescendo', 'Subamos un tono']

/** Cuánto se queda el aviso en pantalla. */
export const SHOW_MS = 10_000
/** Mensajes más viejos que esto ya no se mandan (el servicio terminó). */
export const KEEP_MS = 6 * 3_600_000
const MAX = 40

/** Lo que llega del cliente: texto corto, sin saltos de línea. */
export function cleanLive(body: unknown): { text: string; song?: string } | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const text = typeof o.text === 'string' ? o.text.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  if (!text) return null
  const song = typeof o.song === 'string' ? o.song.replace(/\s+/g, ' ').trim().slice(0, 80) || undefined : undefined
  return { text, song }
}

/** Agrega un mensaje y deja solo los recientes. */
export function pushLive(list: LiveMessage[], msg: LiveMessage, now = msg.at): LiveMessage[] {
  return [...list.filter((m) => now - m.at < KEEP_MS), msg].slice(-MAX)
}

/** Los mensajes después de `since` (ms), del más viejo al más nuevo. */
export const liveSince = (list: LiveMessage[], since: number) => list.filter((m) => m.at > since)

/** El que se muestra ahora: el último, si es reciente. */
export function currentLive(list: LiveMessage[], now: number): LiveMessage | undefined {
  const last = list[list.length - 1]
  return last && now - last.at < SHOW_MS ? last : undefined
}
