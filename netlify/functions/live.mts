import type { Config, Context } from '@netlify/functions'
import { randomBytes } from 'node:crypto'
import { json, liveStore, userFromRequest, users, type UserRecord } from '../lib/auth.mts'
import { cleanLive, liveSince, pushLive, type LiveMessage } from '../../src/lib/live.ts'

// Mensajes en vivo del modo tarima, por fecha. Todos leen (cada pocos
// segundos mientras están en tarima); solo Dirección manda.
// Ojo en local: ante un 403, `netlify dev` reintenta la ruta con .html/.htm y
// muestra el último error ("Fecha inválida"); en producción llega el 403.

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const date = context.params.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Fecha inválida' }, 400)
  const store = liveStore()
  const list = ((await store.get(date, { type: 'json' })) as LiveMessage[] | null) ?? []

  if (req.method === 'GET') {
    const since = Number(new URL(req.url).searchParams.get('since')) || 0
    return json({ messages: liveSince(list, since), now: Date.now() })
  }

  if (req.method === 'POST') {
    const me = (await users().get(username, { type: 'json' })) as UserRecord | null
    if (!me?.roles?.includes('direccion')) return json({ error: 'Solo Dirección manda mensajes al equipo' }, 403)
    const data = cleanLive(await req.json().catch(() => null))
    if (!data) return json({ error: 'Escribe el mensaje' }, 400)
    const msg: LiveMessage = { id: randomBytes(5).toString('hex'), ...data, by: me.name ?? username, at: Date.now() }
    await store.setJSON(date, pushLive(list, msg))
    return json({ message: msg }, 201)
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: '/api/live/:date' }
