import type { Config, Context } from '@netlify/functions'
import { json, services, userFromRequest } from '../lib/auth.mts'
import type { Service, ServiceItem } from '../../src/types.ts'

// La lista de canciones de cada fecha, compartida por todo el equipo.

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const date = context.params.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Fecha inválida' }, 400)
  const store = services()
  const current = (await store.get(date, { type: 'json' })) as Service | null

  if (req.method === 'GET') return json({ service: current })

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}))
    if (current && body.baseUpdatedAt !== undefined && body.baseUpdatedAt !== current.updatedAt) {
      return json({ error: `${current.updatedBy} cambió esta lista mientras la editabas`, service: current }, 409)
    }
    const items: ServiceItem[] = (Array.isArray(body.items) ? body.items : [])
      .filter((i: ServiceItem) => typeof i?.songId === 'string' && /^[a-f0-9]{16}$/.test(i.songId))
      .slice(0, 30)
      .map((i: ServiceItem) => ({
        songId: i.songId,
        section: typeof i.section === 'string' && i.section.trim() ? i.section.trim().slice(0, 40) : undefined,
      }))
    const service: Service = { date, items, updatedAt: new Date().toISOString(), updatedBy: username }
    await store.setJSON(date, service)
    return json({ service })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: '/api/services/:date' }
