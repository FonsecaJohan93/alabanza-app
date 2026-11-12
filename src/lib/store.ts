import { useSyncExternalStore } from 'react'
import type { Song, SongDraft } from '../types'
import * as api from './api'
import { viewsFor, type Member, type Prefs, type Role, type Views } from './team'

// Estado global pequeño: la sesión y el repertorio del equipo. El repertorio
// se guarda también en el teléfono para poder ver canciones sin señal.

interface State {
  session: api.Session | null
  songs: Song[]
  members: Member[]
  loaded: boolean
  error: string | null
}

const CACHE_KEY = 'alabanza:songs'

function readCache(): Song[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeCache(songs: Song[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(songs))
  } catch {
    /* sin espacio o modo privado */
  }
}

const MEMBERS_KEY = 'alabanza:members'
function readMembers(): Member[] {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? '[]')
  } catch {
    return []
  }
}
function writeMembers(m: Member[]) {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(m))
  } catch {
    /* nada */
  }
}

const session = api.loadSession()
let state: State = { session, songs: session ? readCache() : [], members: session ? readMembers() : [], loaded: false, error: null }
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state))
}

export const useSession = () => useStore((s) => s.session)
export const useSongs = () => useStore((s) => s.songs)
export const useMembers = () => useStore((s) => s.members)
/** Mis preferencias y lo que veo según mis instrumentos. */
export function useMe(): { prefs: Prefs; roles: Role[]; views: Views; loaded: boolean } {
  const me = useStore((s) => s.members.find((m) => m.username === s.session?.username))
  const prefs = me?.prefs ?? {}
  const roles = me?.roles ?? []
  return { prefs, roles, views: viewsFor(roles, prefs.view), loaded: !!me }
}
export const useSong = (id: string | undefined) => useStore((s) => s.songs.find((x) => x.id === id))

function sorted(songs: Song[]) {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
}

function putSong(song: Song) {
  const songs = sorted([...state.songs.filter((s) => s.id !== song.id), song])
  writeCache(songs)
  set({ songs })
}

export function signIn(s: api.Session) {
  api.saveSession(s)
  set({ session: s, songs: [], members: [], loaded: false })
  void refreshSongs()
  void refreshMembers()
}

export function signOut() {
  api.saveSession(null)
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(MEMBERS_KEY)
  } catch {
    /* nada */
  }
  set({ session: null, songs: [], members: [], loaded: false })
}

api.setUnauthorizedHandler(signOut)

export async function refreshSongs() {
  try {
    const songs = sorted(await api.fetchSongs())
    writeCache(songs)
    set({ songs, loaded: true, error: null })
  } catch (e) {
    set({ loaded: true, error: (e as Error).message })
  }
}

export async function saveSong(draft: SongDraft, existing?: Song): Promise<Song> {
  const song = existing ? await api.updateSong(existing.id, draft, existing.updatedAt) : await api.createSong(draft)
  putSong(song)
  return song
}

/** Cuando hubo conflicto, el servidor manda la versión actual: se guarda. */
export const acceptRemote = putSong

export async function removeSong(id: string) {
  await api.deleteSong(id)
  const songs = state.songs.filter((s) => s.id !== id)
  writeCache(songs)
  set({ songs })
}

export async function refreshMembers() {
  try {
    const members = await api.fetchMembers()
    writeMembers(members)
    set({ members })
  } catch {
    /* sin señal: se queda la lista anterior */
  }
}

/** Cambia el nombre y los instrumentos propios. */
export async function saveProfile(name: string, roles: Role[] | undefined, prefs?: Prefs) {
  const me = await api.saveProfile(name, roles, prefs)
  if (state.session) {
    const session = { ...state.session, name: me.name }
    api.saveSession(session)
    set({ session })
  }
  const members = state.members.map((m) => (m.username === me.username ? me : m))
  writeMembers(members)
  set({ members })
}

if (session) {
  void refreshSongs()
  void refreshMembers()
}
