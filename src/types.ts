import type { DrumChart } from './lib/drums.ts'

export type Tempo = 'rapida' | 'media' | 'lenta'

export interface Song {
  id: string
  title: string
  artist: string
  /** Tono en que está escrita la hoja (p. ej. "G", "Em"). */
  key: string
  bpm?: number
  tempo?: Tempo
  /** Temas: "gracia", "cruz", "adoración"… se usan para proponer canciones. */
  tags: string[]
  /** Letra y acordes en ChordPro. */
  content: string
  sourceUrl?: string
  youtube?: string
  notes?: string
  /** Indicaciones para la batería (feel, piezas y dinámica por sección). */
  drums?: DrumChart
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  deleted?: boolean
}

export type SongDraft = Omit<Song, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>

/** Una canción dentro de la lista de un servicio. */
export interface ServiceItem {
  songId: string
  /** Bloque del servicio, p. ej. "Alabanza" o "Adoración". */
  section?: string
}

/** La lista de canciones de un domingo (o de cualquier fecha). */
export interface Service {
  date: string // AAAA-MM-DD
  items: ServiceItem[]
  updatedAt: string
  updatedBy: string
}
