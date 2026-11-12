import type { Config } from '@netlify/functions'
import { json, userFromRequest } from '../lib/auth.mts'
import { parseLaCuerdaSearch } from '../../src/lib/importers.ts'

// Busca canciones en LaCuerda. (Cifra Club no deja que un servidor lea sus
// páginas; para Cifra Club la app abre su buscador en el navegador.)

export default async (req: Request) => {
  if (!userFromRequest(req)) return json({ error: 'Sesión vencida, vuelve a entrar' }, 401)
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return json({ results: [] })
  try {
    const res = await fetch(`https://acordes.lacuerda.net/busca.php?exp=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'AlabanzaApp/0.1 (repertorio de iglesia)' },
    })
    if (!res.ok) return json({ error: `LaCuerda respondió ${res.status}` }, 502)
    return json({ results: parseLaCuerdaSearch(await res.text()) })
  } catch {
    return json({ error: 'No pude conectar con LaCuerda' }, 502)
  }
}

export const config: Config = { path: '/api/search' }
