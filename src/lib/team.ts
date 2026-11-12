// Roles del equipo de alabanza. Código puro: lo usan el cliente y el servidor.

export const ROLES = [
  { id: 'direccion', label: 'Dirección' },
  { id: 'voz', label: 'Voces' },
  { id: 'acustica', label: 'Guitarra acústica' },
  { id: 'electrica', label: 'Guitarra eléctrica' },
  { id: 'bajo', label: 'Bajo' },
  { id: 'bateria', label: 'Batería' },
  { id: 'teclado', label: 'Piano / teclado' },
  { id: 'otro', label: 'Otro instrumento' },
  { id: 'sonido', label: 'Sonido' },
  { id: 'multimedia', label: 'Multimedia' },
] as const

export type Role = (typeof ROLES)[number]['id']

export const roleLabel = (r: string) => ROLES.find((x) => x.id === r)?.label ?? r

const ROLE_IDS = new Set<string>(ROLES.map((r) => r.id))
export const isRole = (v: unknown): v is Role => typeof v === 'string' && ROLE_IDS.has(v)

/** Quién toca qué en un servicio. Una persona puede tener varios roles. */
export interface Assignment {
  role: Role
  username: string
}

/** Lo que se muestra del equipo (nunca la contraseña). */
export interface Member {
  username: string
  name: string
  /** Lo que la persona sabe tocar o hacer. */
  roles: Role[]
}

export function cleanAssignments(v: unknown): Assignment[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: Assignment[] = []
  for (const a of v.slice(0, 40)) {
    if (!a || typeof a !== 'object') continue
    const { role, username } = a as Record<string, unknown>
    if (!isRole(role) || typeof username !== 'string' || !/^[a-z0-9._-]{3,20}$/.test(username)) continue
    const k = role + ':' + username
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ role, username })
  }
  return out
}
