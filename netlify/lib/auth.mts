import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Prefs, Role } from '../../src/lib/team.ts'

// Seguridad básica a propósito (app interna del equipo de alabanza):
// contraseñas con scrypt + sal, y un token firmado con HMAC que dura 90 días.
// Para registrarse hace falta el código de invitación del equipo.

const TOKEN_DAYS = 90

export const users = () => getStore({ name: 'users', consistency: 'strong' })
export const songs = () => getStore({ name: 'songs', consistency: 'strong' })
export const services = () => getStore({ name: 'services', consistency: 'strong' })

export interface UserRecord {
  username: string
  salt: string
  hash: string
  name?: string
  /** Instrumentos o tareas que la persona hace en el equipo. */
  roles?: Role[]
  /** Preferencias de la persona (vista al abrir canciones, pulso automático). */
  prefs?: Prefs
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

export const json = (body: unknown, status = 200) => Response.json(body, { status })
