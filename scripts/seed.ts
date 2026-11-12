// Carga el repertorio inicial: la hoja del Drive (CSV) + las canciones del
// domingo (acordes copiados de Cifra Club). Los links de LaCuerda de la hoja
// se importan con acordes. Se puede correr varias veces: actualiza por título.
//
//   node scripts/seed.ts [http://localhost:8889] [usuario] [contraseña]
//   SEED_SECRET=<AUTH_SECRET> node scripts/seed.ts https://alabanza-mirefugio.netlify.app

import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { guessKey, textToChordPro } from '../src/lib/chordsheet.ts'
import { normalizeLaCuerdaUrl, parseLaCuerda, sourceOf } from '../src/lib/importers.ts'
import type { Song } from '../src/types.ts'

const [base = 'http://localhost:8889', user = 'prueba', pass = process.env.TEST_PASSWORD] = process.argv.slice(2)
const dir = new URL('./seed/', import.meta.url)

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') row.push(cell), (cell = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell), rows.push(row), (row = []), (cell = '')
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** A veces la celda tiene el mismo link pegado dos veces. */
const firstUrl = (s: string) => s.match(/https?:\/\/.*?(?=https?:\/\/|$)/)?.[0].trim() ?? ''

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ''}`)
  return body as T
}

// Con SEED_SECRET (el AUTH_SECRET del servidor) el script firma su propio
// acceso como "repertorio" y no necesita una cuenta con contraseña.
function signToken(username: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 3_600_000 })).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}
const token = process.env.SEED_SECRET
  ? signToken('repertorio', process.env.SEED_SECRET)
  : (await api<{ token: string }>('/api/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) })).token
let { songs } = await api<{ songs: Song[] }>('/api/songs', {}, token)
const byTitle = () => new Map(songs.map((s) => [fold(s.title), s]))

async function upsert(draft: Partial<Song> & { title: string }) {
  const existing = byTitle().get(fold(draft.title))
  const body = existing
    ? { ...existing, ...Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined && v !== '')), baseUpdatedAt: existing.updatedAt }
    : { artist: '', key: '', tags: [], content: '', ...draft }
  const { song } = existing
    ? await api<{ song: Song }>(`/api/songs/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) }, token)
    : await api<{ song: Song }>('/api/songs', { method: 'POST', body: JSON.stringify(body) }, token)
  songs = [...songs.filter((s) => s.id !== song.id), song]
  return { song, created: !existing }
}

// ---- 1. Hoja del Drive
const [, ...rows] = parseCsv(await readFile(new URL('repertorio-2025.csv', dir), 'utf8'))
let imported = 0
const problems: string[] = []
for (const r of rows) {
  const [, title, artistRaw, key, chordsLink, youtube, , genre, timesPlayed] = r.map((c) => c?.trim() ?? '')
  if (!title) continue
  const popurri = /popurr/i.test(artistRaw)
  const link = firstUrl(chordsLink)
  const draft: Partial<Song> & { title: string } = {
    title,
    artist: popurri ? '' : artistRaw,
    key,
    tags: [genre.toLowerCase(), ...(popurri ? ['popurrí'] : [])].filter(Boolean),
    youtube: firstUrl(youtube) || (/youtu/.test(link) ? link : undefined),
    sourceUrl: link && !/youtu/.test(link) ? link : undefined,
    notes: timesPlayed ? `Tocada ${timesPlayed} veces (registro 2025).` : undefined,
  }
  if (link && sourceOf(link) === 'lacuerda') {
    try {
      const res = await fetch(normalizeLaCuerdaUrl(link), { headers: { 'User-Agent': 'AlabanzaApp/0.1 (repertorio de iglesia)' } })
      const song = parseLaCuerda(await res.text(), link)
      draft.content = song.content
      draft.key = key || song.key
      draft.youtube ??= song.youtube
      if (fold(song.title) !== fold(title)) problems.push(`${title}: el link de LaCuerda es de "${song.title}"`)
      imported++
    } catch (e) {
      problems.push(`${title}: no se pudo leer LaCuerda (${(e as Error).message})`)
    }
    await sleep(1200) // con calma, para no cargar a LaCuerda
  }
  const { created } = await upsert(draft)
  console.log(`${created ? '+' : '~'} ${title}${draft.content ? ' (con acordes)' : ''}`)
}

// ---- 2. Canciones del domingo (Cifra Club, copiadas a mano)
type Extra = { title: string; artist: string; sourceUrl: string; key?: string; notes?: string; tags?: string[]; text: string }
const sunday = JSON.parse(await readFile(new URL('domingo.json', dir), 'utf8')) as Extra[]
for (const s of sunday) {
  const content = textToChordPro(s.text)
  const existing = byTitle().get(fold(s.title))
  const { created } = await upsert({
    title: existing?.title ?? s.title,
    artist: s.artist,
    sourceUrl: s.sourceUrl,
    content,
    key: s.key ?? guessKey(content),
    // No repetir la nota si el script ya corrió antes
    notes: s.notes && !existing?.notes?.includes(s.notes) ? [existing?.notes, s.notes].filter(Boolean).join(' ') : undefined,
    tags: [...new Set([...(existing?.tags ?? []), ...(s.tags ?? [])])],
  })
  console.log(`${created ? '+' : '~'} ${s.title} (domingo, Cifra Club)`)
}

console.log(`\n${songs.length} canciones; ${imported} con acordes de LaCuerda.`)
if (problems.length) console.log('Revisar:\n- ' + problems.join('\n- '))
