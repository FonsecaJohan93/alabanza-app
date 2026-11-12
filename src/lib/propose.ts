// Propuesta de canciones y equipo para un domingo. Reglas simples y
// explicables (sin servicios externos). Código puro: se prueba con node --test.

import { lyricsOnly } from './chordsheet.ts'
import type { Assignment, Member, Role } from './team.ts'
import type { Service, Song } from '../types.ts'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Palabras del tema → temas del repertorio relacionados. */
const THEMES: [RegExp, string[]][] = [
  [/\bfe\b|confi|creer|creo|prueba|tormenta|dificul/, ['fe', 'confianza', 'fidelidad']],
  [/gracia|perdon|salva|redenc/, ['gracia', 'salvación', 'cruz', 'amor de dios']],
  [/cruz|sangre|sacrific|calvario|pascua|resurrec|cena|comunion|memoria/, ['cruz', 'santa cena', 'comunión', 'salvación']],
  [/espiritu|uncion|fuego|pentecost|avivam/, ['espíritu santo', 'presencia', 'avivamiento', 'poder de dios']],
  [/intim|presencia|adora|rendi|entreg/, ['presencia', 'intimidad', 'entrega']],
  [/gozo|alegr|celebr|fiesta|danza/, ['gozo', 'celebración']],
  [/victori|guerra|batalla|enemig|venc/, ['victoria', 'guerra espiritual', 'poder de dios']],
  [/libert|libre|cadena|esclav/, ['libertad', 'identidad']],
  [/santid|santo|majest|rey|trono|gloria|grande/, ['santidad', 'majestad']],
  [/mision|evangel|cosecha|nacion|predic/, ['misiones', 'avivamiento']],
  [/venida|esperanza|regreso|eterni|cielo/, ['segunda venida', 'majestad']],
  [/restaur|famili|sanar|sanidad|milagr/, ['restauración', 'milagros', 'poder de dios']],
  [/gratitud|gracias|agradec/, ['gratitud']],
  [/fidelid|provis|cuidado|pastor/, ['fidelidad', 'confianza']],
  [/amor/, ['amor de dios']],
  [/identid|hijo|padre|adopc/, ['identidad', 'amor de dios']],
]

/** Temas del repertorio que corresponden a lo que se escribió. */
export function themeTags(theme: string): string[] {
  const t = fold(theme)
  const tags = new Set<string>()
  for (const [re, list] of THEMES) if (re.test(t)) list.forEach((x) => tags.add(x))
  return [...tags]
}

const STOP = new Set('para como todo este esta pero desde hasta sobre ante tiene tengo quiero vamos donde cuando porque nuestro nuestra señor senor dios jesus'.split(' '))
const keywords = (theme: string) =>
  [...new Set(fold(theme).split(/[^a-zñ]+/).filter((w) => w.length >= 4 && !STOP.has(w)))].map((w) => w.slice(0, 6))

/** Veces tocada según la nota que vino del Drive ("Tocada 12 veces"). */
const timesPlayed = (s: Song) => Number(/Tocada (\d+) veces/.exec(s.notes ?? '')?.[1] ?? 0)

export interface SongPick {
  song: Song
  score: number
  reasons: string[]
}

export interface ProposeOptions {
  theme: string
  alabanza: number
  adoracion: number
  /** Domingos anteriores (para no repetir lo reciente). */
  history: Service[]
  /** Fecha del domingo que se planea (AAAA-MM-DD). */
  date: string
}

/** Puntaje de cada canción para el tema, con sus razones. */
export function scoreSongs(songs: Song[], o: ProposeOptions): SongPick[] {
  const tags = themeTags(o.theme)
  const words = keywords(o.theme)
  const past = o.history.filter((s) => s.date < o.date).sort((a, b) => b.date.localeCompare(a.date))
  const lastUse = new Map<string, number>() // songId → cuántos domingos atrás
  past.slice(0, 8).forEach((s, i) => s.items.forEach((it) => lastUse.has(it.songId) || lastUse.set(it.songId, i + 1)))

  return songs.map((song) => {
    const reasons: string[] = []
    let score = 0
    const tagHits = song.tags.filter((t) => tags.includes(t))
    if (tagHits.length) {
      score += 3 * tagHits.length
      reasons.push(`tema: ${tagHits.join(', ')}`)
    }
    const title = fold(song.title)
    const titleHits = words.filter((w) => title.includes(w))
    if (titleHits.length) {
      score += 2 * titleHits.length
      reasons.push('el título coincide')
    }
    const lyrics = fold(lyricsOnly(song.content))
    const lyricHits = words.filter((w) => lyrics.includes(w))
    if (lyricHits.length) {
      score += Math.min(lyricHits.length, 3) * 0.8
      reasons.push('la letra habla del tema')
    }
    const played = timesPlayed(song)
    if (played) score += Math.min(1.5, Math.log2(played + 1) * 0.4) // el equipo la conoce
    if (!song.content.trim()) score -= 1.5 // sin hoja todavía
    const ago = lastUse.get(song.id)
    if (ago) {
      score -= ago === 1 ? 5 : ago <= 3 ? 3 : 1
      reasons.push(ago === 1 ? 'se tocó el domingo pasado' : `se tocó hace ${ago} domingos`)
    }
    return { song, score, reasons }
  })
}

const genreOf = (s: Song) => (s.tags.includes('alabanza') ? 'alabanza' : s.tags.includes('adoración') ? 'adoración' : null)

/**
 * Elige las canciones: primero alabanza y luego adoración, las de mejor
 * puntaje. Devuelve también el resto ordenado para poder cambiarlas.
 */
export function proposeSongs(songs: Song[], o: ProposeOptions): { picks: SongPick[]; ranked: SongPick[] } {
  const ranked = scoreSongs(songs, o).sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
  const take = (genre: string, n: number, used: Set<string>) => {
    const out: SongPick[] = []
    for (const p of ranked) {
      if (out.length >= n) break
      if (used.has(p.song.id) || genreOf(p.song) !== genre) continue
      used.add(p.song.id)
      out.push(p)
    }
    return out
  }
  const used = new Set<string>()
  const picks = [...take('alabanza', o.alabanza, used), ...take('adoración', o.adoracion, used)]
  return { picks, ranked }
}

/** Siguiente opción para reemplazar una canción (mismo tipo, no usada). */
export function nextAlternative(ranked: SongPick[], current: SongPick[], replacing: Song): SongPick | undefined {
  const genre = genreOf(replacing)
  const taken = new Set(current.map((p) => p.song.id))
  const start = ranked.findIndex((p) => p.song.id === replacing.id)
  const pool = [...ranked.slice(start + 1), ...ranked.slice(0, Math.max(0, start))]
  return pool.find((p) => !taken.has(p.song.id) && genreOf(p.song) === genre)
}

// ---- Equipo

/** Cuántas personas por rol se proponen. */
export const LINEUP: [Role, number][] = [
  ['direccion', 1],
  ['voz', 2],
  ['acustica', 1],
  ['electrica', 1],
  ['bajo', 1],
  ['bateria', 1],
  ['teclado', 1],
  ['sonido', 1],
  ['multimedia', 1],
]

/** Roles que una persona puede combinar con un instrumento. */
const COMBINABLE: Role[] = ['direccion', 'voz']

/**
 * Para cada rol, quien lo tiene en su perfil y lleva más tiempo sin
 * hacerlo. Nadie toca dos instrumentos a la vez (sí puede dirigir o cantar
 * y además tocar).
 */
export function proposeTeam(members: Member[], history: Service[], date: string): Assignment[] {
  const past = history.filter((s) => s.date < date).sort((a, b) => b.date.localeCompare(a.date))
  const lastTime = (username: string, role: Role) => {
    const i = past.findIndex((s) => s.team?.some((a) => a.username === username && a.role === role))
    return i < 0 ? Infinity : i // más alto = hace más tiempo
  }
  const instrumentOf = new Map<string, Role>()
  const out: Assignment[] = []
  for (const [role, n] of LINEUP) {
    const candidates = members
      .filter((m) => m.roles.includes(role))
      .filter((m) => COMBINABLE.includes(role) || !instrumentOf.has(m.username))
      .sort((a, b) => lastTime(b.username, role) - lastTime(a.username, role) || a.name.localeCompare(b.name))
    for (const m of candidates.slice(0, n)) {
      out.push({ role, username: m.username })
      if (!COMBINABLE.includes(role)) instrumentOf.set(m.username, role)
    }
  }
  return out
}
