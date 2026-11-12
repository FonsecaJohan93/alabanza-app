import { guessKey, linesToChordPro, type SourceLine } from './chordsheet.ts'

export interface ImportedSong {
  title: string
  artist: string
  key: string
  content: string // ChordPro
  sourceUrl: string
  youtube?: string
}

export type Source = 'lacuerda' | 'cifraclub' | 'otro'

export function sourceOf(url: string): Source {
  try {
    const host = new URL(url).hostname
    if (host.endsWith('lacuerda.net')) return 'lacuerda'
    if (/(^|\.)cifraclub\.com(\.br)?$/.test(host)) return 'cifraclub'
  } catch {
    /* no es una URL */
  }
  return 'otro'
}

/** LaCuerda: el link puede venir sin ".shtml" o desde el sitio móvil. */
export function normalizeLaCuerdaUrl(url: string): string {
  const u = new URL(url)
  u.hash = ''
  u.search = ''
  if (!u.pathname.endsWith('.shtml')) u.pathname = u.pathname.replace(/\/$/, '') + '.shtml'
  u.protocol = 'https:'
  return u.toString()
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[e.toLowerCase()] ?? all
  })
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '')

function jsVar(html: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(html)
  return m ? decodeEntities(m[1].replace(/\\'/g, "'")) : ''
}

/**
 * En LaCuerda los acordes vienen en etiquetas <A> dentro de un <PRE>, cada
 * línea de acordes encima de su línea de letra. Como el HTML marca qué es
 * acorde, se respeta eso aunque el acorde tenga una escritura rara.
 */
export function parseLaCuerda(html: string, url: string): ImportedSong {
  const body = /<div id=['"]?t_body['"]?[^>]*>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html)
  if (!body) throw new Error('No encontré los acordes en esa página de LaCuerda')

  const lines: SourceLine[] = body[1].split(/\r?\n/).map((raw) => {
    const hasChordTags = /<a[\s>]/i.test(raw)
    const outside = stripTags(raw.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, ''))
    const text = decodeEntities(stripTags(raw))
    return { text, isChords: hasChordTags && !decodeEntities(outside).trim() ? true : undefined }
  })

  const content = linesToChordPro(lines)
  const titleTag = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? ''
  const title = jsVar(html, 'orola') || decodeEntities(titleTag.split(',')[0]).trim()
  const artist = jsVar(html, 'oband') || decodeEntities(titleTag.split(',')[1]?.split(':')[0] ?? '').trim()
  const yt = /ytVid\s*=\s*"([^"]+)"/.exec(html)?.[1]
  const youtube = yt ? 'https://www.youtube.com/watch?v=' + yt.split('/').pop() : undefined
  return { title, artist, key: guessKey(content), content, sourceUrl: url, youtube }
}

// ---- Búsqueda en LaCuerda

export interface SearchResult {
  title: string
  artist: string
  url: string
  source: Source
}

/** Cómo arma LaCuerda la dirección de una canción a partir del título. */
export function laCuerdaSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * La página de resultados lista filas: un link al artista ("/marcos_witt/")
 * y los títulos de sus canciones que coinciden.
 */
export function parseLaCuerdaSearch(html: string, limit = 30): SearchResult[] {
  const out: SearchResult[] = []
  const rowRe = /<a href="\/([a-z0-9_]+)\/">([^<]+)<\/A><\/TD><td><ul[^>]*>([\s\S]*?)<\/ul>/gi
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(html)) && out.length < limit) {
    const [, slug, artistName, list] = m
    const titleRe = /<li[^>]*><a[^>]*>([^<]+)<\/a>/gi
    let t: RegExpExecArray | null
    while ((t = titleRe.exec(list)) && out.length < limit) {
      const title = decodeEntities(t[1]).trim()
      out.push({ title, artist: decodeEntities(artistName).trim(), url: `https://acordes.lacuerda.net/${slug}/${laCuerdaSlug(title)}.shtml`, source: 'lacuerda' })
    }
  }
  return out
}
