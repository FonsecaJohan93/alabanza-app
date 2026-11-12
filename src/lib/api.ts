import type { Service, ServiceItem, Song, SongDraft } from '../types'
import type { ImportedSong, SearchResult } from './importers'
import type { Personal, PersonalSong } from './personal'
import type { Assignment, Member, Prefs, Role } from './team'

export interface Session {
  username: string
  name: string
  token: string
}

const SESSION_KEY = 'alabanza:session'

export function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* modo privado: la sesión dura lo que la pestaña */
  }
}

export class ApiError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message)
    this.status = status
    this.body = body
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = loadSession()?.token
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
  } catch {
    throw new ApiError('Sin conexión', 0, {})
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (res.status === 401 && token) onUnauthorized()
  if (!res.ok) throw new ApiError(body.error ?? 'Error de conexión', res.status, body)
  return body as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const login = (username: string, password: string) => call<Session>('/api/login', post({ username, password }))

export const register = (username: string, password: string, name: string, invite: string) =>
  call<Session>('/api/register', post({ username, password, name, invite }))

export const fetchSongs = () => call<{ songs: Song[] }>('/api/songs').then((r) => r.songs)

export const createSong = (draft: SongDraft) => call<{ song: Song }>('/api/songs', post(draft)).then((r) => r.song)

export const updateSong = (id: string, draft: SongDraft, baseUpdatedAt: string) =>
  call<{ song: Song }>(`/api/songs/${id}`, { method: 'PUT', body: JSON.stringify({ ...draft, baseUpdatedAt }) }).then((r) => r.song)

export const deleteSong = (id: string) => call<void>(`/api/songs/${id}`, { method: 'DELETE' })

export const importFromUrl = (url: string) => call<{ song: ImportedSong }>('/api/import', post({ url })).then((r) => r.song)

export const fetchService = (date: string) =>
  call<{ service: Service | null }>(`/api/services/${date}`).then((r) => r.service)

export const saveService = (date: string, items: ServiceItem[], team: Assignment[] | undefined, baseUpdatedAt?: string) =>
  call<{ service: Service }>(`/api/services/${date}`, { method: 'PUT', body: JSON.stringify({ items, team, baseUpdatedAt }) }).then(
    (r) => r.service,
  )

export const fetchMembers = () => call<{ members: Member[] }>('/api/users').then((r) => r.members)

export const saveProfile = (name: string, roles: Role[] | undefined, prefs?: Prefs) =>
  call<{ member: Member }>('/api/users/me', { method: 'PUT', body: JSON.stringify({ name, roles, prefs }) }).then((r) => r.member)

export const searchOnline = (q: string) => call<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.results)

export const fetchPersonal = () => call<{ personal: Personal }>('/api/personal').then((r) => r.personal)

export const savePersonalSong = (songId: string, data: PersonalSong) =>
  call<{ song: PersonalSong }>(`/api/personal/${songId}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.song)
