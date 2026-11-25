import type { Config, Context } from '@netlify/functions'
import { emailTaken, json, userFromRequest, users, type UserRecord } from '../lib/auth.mts'
import { cleanEmail } from '../../src/lib/account.ts'
import { cleanPrefs, isRole, type Member } from '../../src/lib/team.ts'

// El equipo: GET /api/users lista a todos (sin contraseñas);
// PUT /api/users/me cambia el nombre y los instrumentos propios;
// PUT /api/users/:username (solo Dirección) cambia los instrumentos de otra persona.

// El correo solo se le muestra a la misma persona
const toMember = (r: UserRecord, viewer?: string): Member => ({
  username: r.username,
  name: r.name ?? r.username,
  roles: r.roles ?? [],
  prefs: r.prefs ?? {},
  ...(viewer === r.username ? { email: r.email ?? '' } : {}),
})

export default async (req: Request, context: Context) => {
  const username = userFromRequest(req)
  if (!username) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const store = users()

  if (req.method === 'GET' && !context.params.who) {
    const { blobs } = await store.list()
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<UserRecord | null>))
    const members = all.filter((r): r is UserRecord => !!r).map((r) => toMember(r, username))
    members.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    return json({ members })
  }

  if (req.method === 'PUT' && context.params.who === 'me') {
    const rec = (await store.get(username, { type: 'json' })) as UserRecord | null
    if (!rec) return json({ error: 'Usuario no encontrado' }, 404)
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : rec.name
    const roles = Array.isArray(body.roles) ? [...new Set(body.roles.filter(isRole))] : (rec.roles ?? [])
    const prefs = cleanPrefs(body.prefs, rec.prefs ?? {})
    let email = rec.email
    if (typeof body.email === 'string') {
      const e = cleanEmail(body.email)
      if (!e) return json({ error: 'Ese correo no parece válido' }, 400)
      if (await emailTaken(e, username)) return json({ error: 'Ese correo ya lo usa otra cuenta' }, 409)
      email = e
    }
    const next: UserRecord = { ...rec, name, roles, prefs, email }
    await store.setJSON(username, next)
    return json({ member: toMember(next, username) })
  }

  // Dirección puede marcar los instrumentos de otra persona del equipo
  const who = context.params.who
  if (req.method === 'PUT' && who && who !== 'me') {
    const me = (await store.get(username, { type: 'json' })) as UserRecord | null
    if (!me?.roles?.includes('direccion')) return json({ error: 'Solo quien tiene Dirección puede cambiar los instrumentos de otros' }, 400)
    const rec = (await store.get(who, { type: 'json' })) as UserRecord | null
    if (!rec) return json({ error: 'Esa persona no está en el equipo' }, 404)
    const body = await req.json().catch(() => ({}))
    if (!Array.isArray(body.roles)) return json({ error: 'Faltan los instrumentos' }, 400)
    const next: UserRecord = { ...rec, roles: [...new Set(body.roles.filter(isRole))] }
    await store.setJSON(who, next)
    return json({ member: toMember(next) })
  }

  return json({ error: 'Método no permitido' }, 405)
}

export const config: Config = { path: ['/api/users', '/api/users/:who'] }
