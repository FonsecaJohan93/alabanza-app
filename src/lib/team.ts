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
  prefs?: Prefs
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

// ---- Qué ve cada persona al abrir una canción

export type ViewMode = 'auto' | 'acordes' | 'letra' | 'bateria' | 'todo'

export const VIEW_MODES: { id: ViewMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Según mis instrumentos', hint: 'Lo que marcaste en Equipo' },
  { id: 'acordes', label: 'Acordes', hint: 'La hoja con acordes' },
  { id: 'letra', label: 'Solo letra', hint: 'Letra grande, para cantar' },
  { id: 'bateria', label: 'Batería', hint: 'Pulso, feel y piezas por sección' },
  { id: 'todo', label: 'Todo', hint: 'Acordes, letra y batería' },
]

export interface Prefs {
  /** Encender el pulso visual apenas se abre una canción. */
  autoPulse?: boolean
  view?: ViewMode
}

export function cleanPrefs(v: unknown, prev: Prefs = {}): Prefs {
  if (!v || typeof v !== 'object') return prev
  const o = v as Record<string, unknown>
  return {
    autoPulse: typeof o.autoPulse === 'boolean' ? o.autoPulse : prev.autoPulse,
    view: VIEW_MODES.some((m) => m.id === o.view) ? (o.view as ViewMode) : prev.view,
  }
}

export interface Views {
  chords: boolean
  lyrics: boolean
  drums: boolean
  /** Pantalla que se abre al tocar una canción. */
  primary: 'hoja' | 'voces' | 'bateria'
}

const CHORD_ROLES: Role[] = ['acustica', 'electrica', 'bajo', 'teclado', 'otro']
const LYRIC_ROLES: Role[] = ['voz', 'multimedia', 'sonido']

const ALL: Views = { chords: true, lyrics: true, drums: true, primary: 'hoja' }

/**
 * Guitarra/bajo/teclado → acordes; voces (y multimedia/sonido) → letra;
 * batería → batería; dirección o sin instrumentos → todo. Varios roles suman.
 */
export function viewsFor(roles: Role[], view: ViewMode = 'auto'): Views {
  if (view === 'todo') return ALL
  if (view === 'acordes') return { chords: true, lyrics: false, drums: false, primary: 'hoja' }
  if (view === 'letra') return { chords: false, lyrics: true, drums: false, primary: 'voces' }
  if (view === 'bateria') return { chords: false, lyrics: false, drums: true, primary: 'bateria' }
  if (!roles.length || roles.includes('direccion')) return ALL
  const chords = roles.some((r) => CHORD_ROLES.includes(r))
  const lyrics = roles.some((r) => LYRIC_ROLES.includes(r))
  const drums = roles.includes('bateria')
  return { chords, lyrics, drums, primary: chords ? 'hoja' : drums ? 'bateria' : 'voces' }
}

export const songPath = (id: string, v: Views) =>
  v.primary === 'voces' ? `/cancion/${id}/voces` : v.primary === 'bateria' ? `/cancion/${id}/bateria` : `/cancion/${id}`
