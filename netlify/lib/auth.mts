import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Prefs, Role } from '../../src/lib/team.ts'

// Seguridad básica a propósito (app interna del equipo de alabanza):
// contraseñas con scrypt + sal, y un token firmado con HMAC que dura 90 días.
// Para registrarse hace falta el código de invitación del equipo.

const TOKEN_DAYS = 90

export const users = () => getStore({ name: 'users', consistency: 'strong' })
export const songs = () => getStore({ name: 'songs', consistency: 'strong' })
export const services = () => getStore({ name: 'services', consistency: 'strong' })
/** Datos personales de cada persona por canción (capo, notas): uno por usuario. */
export const personal = () => getStore({ name: 'personal', consistency: 'strong' })
/** Biblioteca de ritmos del equipo (un solo documento). */
export const rhythmsStore = () => getStore({ name: 'rhythms', consistency: 'strong' })
export const liveStore = () => getStore({ name: 'live', consistency: 'strong' })

export interface UserRecord {
  username: string
  salt: string
  hash: string
  name?: string
  /** Instrumentos o tareas que la persona hace en el equipo. */
  roles?: Role[]
  /** Preferencias de la persona (vista al abrir canciones, pulso automático). */
  prefs?: Prefs
  /** Para recuperar la contraseña (y entrar con él en vez del usuario). Solo lo ve la persona. */
  email?: string
  /** Enlace pendiente para cambiar la contraseña: se guarda solo el hash. */
  reset?: { hash: string; exp: number; at: number }
  createdAt: string
}

export function normalizeUsername(u: unknown): string | null {
  if (typeof u !== 'string') return null
  const v = u.trim().toLowerCase()
  return /^[a-z0-9._-]{3,20}$/.test(v) ? v : null
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 32).toString('hex') }
}

export function checkPassword(password: string, rec: UserRecord): boolean {
  const { hash } = hashPassword(password, rec.salt)
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(rec.hash, 'hex'))
}

function secret(): string {
  const s = Netlify.env.get('AUTH_SECRET')
  if (!s) throw new Error('Falta AUTH_SECRET')
  return s
}

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

export function makeToken(username: string): string {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + TOKEN_DAYS * 86_400_000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Devuelve el usuario del header Authorization, o null si el token no es válido. */
export function userFromRequest(req: Request): string | null {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig || sign(payload) !== sig) return null
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof u === 'string' && exp > Date.now() ? u : null
  } catch {
    return null
  }
}

/** Busca la cuenta por usuario o por correo (equipo pequeño: recorre la lista). */
export async function findUser(who: unknown): Promise<UserRecord | null> {
  if (typeof who !== 'string') return null
  const v = who.trim().toLowerCase()
  if (!v.includes('@')) {
    const u = normalizeUsername(v)
    return u ? ((await users().get(u, { type: 'json' })) as UserRecord | null) : null
  }
  return (await allUsers()).find((r) => r.email === v) ?? null
}

export async function allUsers(): Promise<UserRecord[]> {
  const store = users()
  const { blobs } = await store.list()
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<UserRecord | null>))
  return all.filter((r): r is UserRecord => !!r)
}

/** ¿Ese correo ya lo usa otra cuenta? */
export async function emailTaken(email: string, except?: string) {
  return (await allUsers()).some((r) => r.email === email && r.username !== except)
}

const sha = (t: string) => createHash('sha256').update(t).digest('hex')

/** Crea el enlace para cambiar la contraseña: devuelve el token (va en el enlace) y el registro a guardar. */
export function newReset(ms: number) {
  const token = randomBytes(24).toString('base64url')
  return { token, reset: { hash: sha(token), exp: Date.now() + ms, at: Date.now() } }
}

export function checkReset(token: unknown, rec: UserRecord): boolean {
  if (typeof token !== 'string' || !rec.reset || rec.reset.exp < Date.now()) return false
  return timingSafeEqual(Buffer.from(sha(token), 'hex'), Buffer.from(rec.reset.hash, 'hex'))
}

/** Dirección de la app para armar enlaces (la de Netlify; en local, la de la petición). */
export function appUrl(req: Request) {
  const env = Netlify.env.get('URL')
  return env && !env.includes('localhost') ? env : new URL(req.url).origin
}

export const resetLink = (req: Request, username: string, token: string) =>
  `${appUrl(req)}/restablecer?u=${encodeURIComponent(username)}&t=${encodeURIComponent(token)}`

export const json = (body: unknown, status = 200) => Response.json(body, { status })
