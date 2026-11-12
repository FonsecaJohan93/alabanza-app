// Carga en el repertorio los acordes leídos de Cifra Club (scripts/seed/cifraclub.json,
// generado desde el navegador). Solo toca canciones que no tienen hoja todavía.
//
//   SEED_SECRET=<AUTH_SECRET> node scripts/seed-cifraclub.ts https://alabanza-mirefugio.netlify.app

import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { guessKey, textToChordPro } from '../src/lib/chordsheet.ts'
import type { Song } from '../src/types.ts'

type Entry = { url: string; h1?: string; tone?: string; shape?: string; capo?: string; text: string }

const base = process.argv[2] ?? 'http://localhost:8889'
const secret = process.env.SEED_SECRET
if (!secret) throw new Error('Falta SEED_SECRET')
const payload = Buffer.from(JSON.stringify({ u: 'repertorio', exp: Date.now() + 3_600_000 })).toString('base64url')
const token = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

const data = JSON.parse(await readFile(new URL('./seed/cifraclub.json', import.meta.url), 'utf8')) as Record<string, Entry>
const { songs } = (await (await fetch(`${base}/api/songs`, { headers })).json()) as { songs: Song[] }

/** ¿La hoja usa este tono? (para no fiarse de un "Tono:" que no coincide con los acordes) */
function usesKey(cp: string, key?: string): boolean {
  if (!key) return false
  const minor = key.endsWith('m')
  const root = minor ? key.slice(0, -1) : key
  const re = minor ? new RegExp(`\\[${root.replace('#', '\\#')}m(?!aj)[0-9]*[\\]/(]`) : new RegExp(`\\[${root.replace('#', '\\#')}(?![#bm])`)
  return re.test(cp)
}

const titleCase = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

for (const [title, e] of Object.entries(data)) {
  const s = songs.find((x) => x.title === title)
  if (!s) {
    console.log('?? no está:', title)
    continue
  }
  if (s.content) {
    console.log('= ya tiene hoja:', title)
    continue
  }
  const content = textToChordPro(e.text)
  const key = usesKey(content, e.shape) ? e.shape! : usesKey(content, e.tone) ? e.tone! : guessKey(content)
  const notes = [
    s.notes,
    e.capo && e.tone ? `Cifra Club: tono original ${e.tone}${e.shape ? ` (forma de ${e.shape}, capo ${e.capo})` : ''}.` : '',
    s.sourceUrl && !s.sourceUrl.includes('cifraclub') ? `Hoja anterior del equipo: ${s.sourceUrl}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const artist = s.artist || titleCase(new URL(e.url).pathname.split('/')[1])
  const body = { ...s, content, key, artist, notes, sourceUrl: e.url, baseUpdatedAt: s.updatedAt }
  const r = await fetch(`${base}/api/songs/${s.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
  console.log(r.status, title, '→', key, `(${artist})`)
}
