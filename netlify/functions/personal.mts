import type { Config, Context } from '@netlify/functions'
import { json, personal, userFromRequest } from '../lib/auth.mts'
import { cleanPersonalSong, type Personal } from '../../src/lib/personal.ts'

// Capo y notas de cada persona por canción. Cada quien solo ve lo suyo.

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const store = personal()
  const mine = ((await store.get(username, { type: 'json' })) as Personal | null) ?? {}

  if (req.method === 'GET' && !context.params.songId) return json({ personal: mine })

  const songId = context.params.songId
  if (req.method === 'PUT' && songId && /^[a-f0-9]{16}$/.test(songId)) {
    const data = cleanPersonalSong(await req.json().catch(() => ({})))
    const next: Personal = { ...mine }
    if (!data.capo && !data.notes) delete next[songId]
    else next[songId] = { ...data, updatedAt: new Date().toISOString() }
    await store.setJSON(username, next)
    return json({ song: next[songId] ?? {} })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: ['/api/personal', '/api/personal/:songId'] }
