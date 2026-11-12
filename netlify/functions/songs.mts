import type { Config, Context } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { json, songs, userFromRequest } from '../lib/auth.mts'
import type { Song } from '../../src/types.ts'
import { cleanDrums } from '../../src/lib/drums.ts'

// El repertorio es compartido por todo el equipo: una entrada por canción.
// Al borrar solo se marca como borrada, por si alguien se equivoca.

const MAX_CONTENT = 60_000

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function clean(body: Record<string, unknown>): Omit<Song, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> | string {
  const title = str(body.title)
  if (!title) return 'La canción necesita un título'
  const content = typeof body.content === 'string' ? body.content.slice(0, MAX_CONTENT) : ''
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((t) => str(t, 40).toLowerCase()).filter(Boolean))].slice(0, 20)
    : []
  const bpm = Number(body.bpm)
  const tempo = ['rapida', 'media', 'lenta'].includes(body.tempo as string) ? (body.tempo as Song['tempo']) : undefined
  return {
    title,
    artist: str(body.artist),
    key: str(body.key, 6),
    bpm: Number.isFinite(bpm) && bpm > 0 && bpm < 400 ? Math.round(bpm) : undefined,
    tempo,
    tags,
    content,
    sourceUrl: str(body.sourceUrl, 500) || undefined,
    youtube: str(body.youtube, 500) || undefined,
    notes: str(body.notes, 2000) || undefined,
    drums: cleanDrums(body.drums),
  }
}

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const id = context.params.id
  const store = songs()

  if (req.method === 'GET' && !id) {
    const { blobs } = await store.list()
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<Song | null>))
    return json({ songs: all.filter((s): s is Song => !!s && !s.deleted) })
  }

  if (req.method === 'POST' && !id) {
    const data = clean(await req.json().catch(() => ({})))
    if (typeof data === 'string') return json({ error: data }, 400)
    const now = new Date().toISOString()
    const song: Song = { ...data, id: randomBytes(8).toString('hex'), createdAt: now, createdBy: username, updatedAt: now, updatedBy: username }
    await store.setJSON(song.id, song)
    return json({ song }, 201)
  }

  if (!id || !/^[a-f0-9]{16}$/.test(id)) return json({ error: 'No encontrado' }, 404)
  const current = (await store.get(id, { type: 'json' })) as Song | null
  if (!current || current.deleted) return json({ error: 'Esa canción ya no existe' }, 404)

  if (req.method === 'GET') return json({ song: current })

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}))
    // Si otra persona la cambió mientras la editabas, no se pisa su cambio
    if (body.baseUpdatedAt && body.baseUpdatedAt !== current.updatedAt) {
      return json({ error: `${current.updatedBy} cambió esta canción mientras la editabas`, song: current }, 409)
    }
    const data = clean(body)
    if (typeof data === 'string') return json({ error: data }, 400)
    const song: Song = { ...current, ...data, updatedAt: new Date().toISOString(), updatedBy: username }
    await store.setJSON(id, song)
    return json({ song })
  }

  if (req.method === 'DELETE') {
    await store.setJSON(id, { ...current, deleted: true, updatedAt: new Date().toISOString(), updatedBy: username })
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: ['/api/songs', '/api/songs/:id'] }
