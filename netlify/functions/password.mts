import type { Config, Context } from '@netlify/functions'
import { checkReset, findUser, hashPassword, json, makeToken, newReset, resetLink, userFromRequest, users, type UserRecord } from '../lib/auth.mts'
import { mailReady, sendMail } from '../lib/mail.mts'
import { maskEmail, RESET_BY_DIRECTOR_MS, RESET_BY_EMAIL_MS } from '../../src/lib/account.ts'

// Recuperar la contraseña:
// POST /api/forgot {who}  → manda al correo de la cuenta un enlace (1 hora) que trae también el usuario.
// POST /api/reset {username, token, password} → cambia la contraseña y deja la sesión abierta.
// POST /api/reset-link/:username → Dirección genera un enlace (24 h) para mandárselo a alguien sin correo.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const action = new URL(req.url).pathname.split('/')[2]
  const body = await req.json().catch(() => ({}))

  if (action === 'forgot') {
    const rec = await findUser(body.who)
    if (!rec) return json({ error: 'No encontramos esa cuenta. Revisa el usuario o el correo.' }, 404)
    if (!rec.email) return json({ error: 'Esa cuenta no tiene correo. Pídele a Dirección un enlace para cambiar la contraseña.', noEmail: true }, 400)
    if (!mailReady())
      return json({ error: 'El correo de la app aún no está configurado. Pídele a Dirección un enlace para cambiar la contraseña.', noEmail: true }, 503)
    if (rec.reset && Date.now() - rec.reset.at < 60_000) return json({ sentTo: maskEmail(rec.email) }) // ya se mandó hace nada
    const { token, reset } = newReset(RESET_BY_EMAIL_MS)
    await users().setJSON(rec.username, { ...rec, reset })
    const link = resetLink(req, rec.username, token)
    const name = rec.name ?? rec.username
    await sendMail(
      rec.email,
      'Cambia tu contraseña de Alabanza',
      `Hola ${name}:\n\nTu usuario es: ${rec.username}\n\nPara poner una contraseña nueva abre este enlace (sirve por 1 hora):\n${link}\n\nSi no lo pediste, ignora este correo.`,
      `<p>Hola ${esc(name)}:</p><p>Tu usuario es: <b>${esc(rec.username)}</b></p><p><a href="${esc(link)}">Poner una contraseña nueva</a> (el enlace sirve por 1 hora).</p><p style="color:#64748b">Si no lo pediste, ignora este correo.</p>`,
    )
    return json({ sentTo: maskEmail(rec.email) })
  }

  if (action === 'reset') {
    const rec = await findUser(body.username)
    if (!rec || !checkReset(body.token, rec)) return json({ error: 'El enlace ya no sirve (venció o ya se usó). Pide otro.' }, 400)
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 4) return json({ error: 'La contraseña debe tener al menos 4 caracteres' }, 400)
    const next: UserRecord = { ...rec, ...hashPassword(password) }
    delete next.reset
    await users().setJSON(rec.username, next)
    return json({ username: rec.username, name: rec.name ?? rec.username, token: makeToken(rec.username) })
  }

  if (action === 'reset-link') {
    const me = userFromRequest(req)
    if (!me) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
    const meRec = (await users().get(me, { type: 'json' })) as UserRecord | null
    if (!meRec?.roles?.includes('direccion')) return json({ error: 'Solo Dirección puede dar enlaces para cambiar la contraseña' }, 400)
    const rec = await findUser(context.params.who)
    if (!rec) return json({ error: 'Esa persona no está en el equipo' }, 404)
    const { token, reset } = newReset(RESET_BY_DIRECTOR_MS)
    await users().setJSON(rec.username, { ...rec, reset })
    return json({ link: resetLink(req, rec.username, token) })
  }

  return json({ error: 'No encontrado' }, 404)
}

export const config: Config = { path: ['/api/forgot', '/api/reset', '/api/reset-link/:who'] }
