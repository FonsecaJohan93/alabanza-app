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
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  deleted?: boolean
}

export type SongDraft = Omit<Song, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
