/**
 * Cuentas: correo para recuperar la contraseña. Código puro (cliente y servidor).
 */

/** Correo en minúsculas si parece válido; null si no. */
export function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const e = v.trim().toLowerCase()
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null
}

/** "johan@gmail.com" → "jo•••@gmail.com", para decir a dónde se mandó sin mostrarlo entero. */
export function maskEmail(e: string): string {
  const [user, domain] = e.split('@')
  if (!domain) return e
  return `${user.slice(0, Math.min(2, user.length))}•••@${domain}`
}

/** Cuánto dura el enlace para cambiar la contraseña. */
export const RESET_BY_EMAIL_MS = 60 * 60_000
export const RESET_BY_DIRECTOR_MS = 24 * 60 * 60_000
