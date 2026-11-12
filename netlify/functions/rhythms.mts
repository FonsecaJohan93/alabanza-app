import type { Config, Context } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { json, rhythmsStore, userFromRequest, users, type UserRecord } from '../lib/auth.mts'
import { cleanLibraryRhythm, type LibraryRhythm } from '../../src/lib/rhythm.ts'

// Biblioteca de ritmos del equipo. Todos la ven; crean y editan quienes
// tienen Dirección o Batería en su perfil.

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const store = rhythmsStore()
  const list = ((await store.get('library', { type: 'json' })) as LibraryRhythm[] | null) ?? []

  if (req.method === 'GET') return json({ rhythms: list })

  const me = (await users().get(username, { type: 'json' })) as UserRecord | null
  if (!me?.roles?.some((r) => r === 'direccion' || r === 'bateria'))
    return json({ error: 'Solo quien tiene Dirección o Batería en su perfil puede crear o editar ritmos' }, 400)

  const id = context.params.id
  if (req.method === 'DELETE' && id) {
    await store.setJSON('library', list.filter((r) => r.id !== id))
    return new Response(null, { status: 204 })
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const data = cleanLibraryRhythm(await req.json().catch(() => null))
    if (typeof data === 'string') return json({ error: data }, 400)
    const now = new Date().toISOString()
    const existing = id ? list.find((r) => r.id === id) : undefined
    if (id && !existing) return json({ error: 'Ese ritmo ya no existe' }, 404)
    if (!existing && list.length >= 200) return json({ error: 'La biblioteca está llena (200 ritmos)' }, 400)
    const rhythm: LibraryRhythm = existing
      ? { ...existing, ...data, updatedAt: now }
      : { id: randomBytes(5).toString('hex'), ...data, createdBy: me.name ?? username, updatedAt: now }
    const next = existing ? list.map((r) => (r.id === rhythm.id ? rhythm : r)) : [...list, rhythm]
    await store.setJSON('library', next)
    return json({ rhythm })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: ['/api/rhythms', '/api/rhythms/:id'] }
