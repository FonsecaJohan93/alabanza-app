import type { Config, Context } from '@netlify/functions'
import { json, services, userFromRequest, users, type UserRecord } from '../lib/auth.mts'
import type { Service, ServiceItem } from '../../src/types.ts'
import { cleanAssignments } from '../../src/lib/team.ts'

// La lista de canciones de cada fecha, compartida por todo el equipo.
// El tono de cada canción ese día solo lo cambia quien tiene "Dirección".

const KEY_RE = /^[A-G][#b]?m?$/

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const store = services()
  const date = context.params.date
  // Sin fecha: historial de todos los domingos (para proponer sin repetir)
  if (!date && req.method === 'GET') {
    const { blobs } = await store.list()
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<Service | null>))
    return json({ services: all.filter((x): x is Service => !!x).sort((a, b) => b.date.localeCompare(a.date)) })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Fecha inválida' }, 400)
  const current = (await store.get(date, { type: 'json' })) as Service | null

  if (req.method === 'GET') return json({ service: current })

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}))
    if (current && body.baseUpdatedAt !== undefined && body.baseUpdatedAt !== current.updatedAt) {
      return json({ error: `${current.updatedBy} cambió esta lista mientras la editabas`, service: current }, 409)
    }
    const items: ServiceItem[] = (Array.isArray(body.items) ? body.items : body.items === undefined ? (current?.items ?? []) : [])
      .filter((i: ServiceItem) => typeof i?.songId === 'string' && /^[a-f0-9]{16}$/.test(i.songId))
      .slice(0, 30)
      .map((i: ServiceItem) => ({
        songId: i.songId,
        section: typeof i.section === 'string' && i.section.trim() ? i.section.trim().slice(0, 40) : undefined,
        key: typeof i.key === 'string' && KEY_RE.test(i.key) ? i.key : undefined,
      }))
    // Solo dirección puede poner o cambiar el tono de una canción ese día
    const before = new Map((current?.items ?? []).map((i) => [i.songId, i.key]))
    if (items.some((i) => i.key !== before.get(i.songId))) {
      const me = (await users().get(username, { type: 'json' })) as UserRecord | null
      if (!me?.roles?.includes('direccion')) {
        const changed = items.filter((i) => i.key !== before.get(i.songId) && (before.has(i.songId) || i.key))
        if (changed.length) return json({ error: 'Solo quien tiene Dirección en su perfil puede cambiar el tono del domingo' }, 400)
      }
    }
    // Si no se manda el equipo, se conserva el que había
    const team = body.team === undefined ? current?.team : cleanAssignments(body.team)
    const service: Service = { date, items, team, updatedAt: new Date().toISOString(), updatedBy: username }
    await store.setJSON(date, service)
    return json({ service })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: ['/api/services', '/api/services/:date'] }
