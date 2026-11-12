import type { Config } from '@netlify/functions'
import { json, userFromRequest } from '../lib/auth.mts'
import { normalizeLaCuerdaUrl, parseLaCuerda, sourceOf } from '../../src/lib/importers.ts'

// Lee una página de acordes y la devuelve como borrador de canción.
// Solo LaCuerda: Cifra Club no deja que un servidor lea sus páginas, así que
// para Cifra Club la app pide copiar y pegar el texto.

export default async (req: Request) => {
  if (!userFromRequest(req)) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const { url } = await req.json().catch(() => ({}))
  if (typeof url !== 'string') return json({ error: 'Falta el link' }, 400)

  const source = sourceOf(url.trim())
  if (source === 'cifraclub') {
    return json({ error: 'Cifra Club no deja leer sus páginas automáticamente. Copia el texto de los acordes y pégalo.', paste: true }, 422)
  }
  if (source !== 'lacuerda') {
    return json({ error: 'Por ahora solo se pueden importar links de LaCuerda. Para otros sitios, pega el texto.', paste: true }, 422)
  }

  const target = normalizeLaCuerdaUrl(url.trim())
  let html: string
  try {
    const res = await fetch(target, { headers: { 'User-Agent': 'AlabanzaApp/0.1 (repertorio de iglesia)' }, redirect: 'follow' })
    if (!res.ok) return json({ error: `LaCuerda respondió ${res.status}. Revisa el link.` }, 400)
    html = await res.text()
  } catch {
    return json({ error: 'No pude conectar con LaCuerda' }, 502)
  }
  try {
    return json({ song: parseLaCuerda(html, target) })
  } catch (e) {
    return json({ error: (e as Error).message, paste: true }, 422)
  }
}

export const config: Config = { path: '/api/import' }
