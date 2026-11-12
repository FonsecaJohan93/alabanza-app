# alabanza-app

App web (PWA, mobile-first) para el equipo de alabanza de la iglesia del usuario. Todo en español.

## Stack
React 19 + TS + Vite + Tailwind v4 + vite-plugin-pwa. Backend: Netlify Functions + Netlify Blobs (mismo patrón que `../gym-app`).

- `netlify/lib/auth.mts` — usuarios (scrypt) + token HMAC 90 días. Env: `AUTH_SECRET`, `INVITE_CODE` (código del equipo para registrarse).
- `netlify/functions/auth.mts` — `/api/register`, `/api/login`.
- `netlify/functions/songs.mts` — `/api/songs[/:id]`. Repertorio **compartido** por todo el equipo, un blob por canción en el store `songs`. Borrar = `deleted: true`. PUT con `baseUpdatedAt` → 409 si otra persona la cambió.
- `netlify/functions/import.mts` — `/api/import`: lee links de LaCuerda.
- `src/lib/chordsheet.ts` — lógica pura de acordes: detectar líneas de acordes, "acordes arriba" ⇄ ChordPro, transponer, capo, secciones. Lo usan cliente y funciones.
- `src/lib/importers.ts` — parser de LaCuerda (acordes en `<A>` dentro de `<div id=t_body><PRE>`; título/artista en vars JS `orola`/`oband`).

## Decisiones
- Canciones se guardan en ChordPro simplificado (`{c: Coro}`, `[G]letra`). El editor muestra por defecto "acordes arriba" porque es lo que conocen los músicos.
- **Cifra Club bloquea lecturas automáticas (403 Akamai). No intentar saltarlo**: el flujo es copiar/pegar el texto; el link se guarda como fuente.
- Transposición, "solo letra" y tamaño de letra son preferencias locales por teléfono (localStorage), no se comparten.

## Fases (acordadas con el usuario)
1. ✅ MVP: repertorio, importar LaCuerda / pegar texto, editor, transposición, capo.
2. Planificación de servicios + historial + propuesta por tema con IA "simple" (todos la van a modificar a mano).
3. Modo escenario + compartir set con el equipo.
4. Disponibilidad del equipo, proyección, estadísticas.

## Datos iniciales
- Hoja del equipo en Drive ("Repertorio", pestaña 2025; el usuario tiene el link): nombre, artista, tono, link de acordes, YouTube, género (Alabanza/Adoración), veces tocada. Útil para la fase 2 (historial).
- `scripts/seed.ts` carga el CSV de la hoja + `scripts/seed/domingo.json` (canciones copiadas de Cifra Club desde el navegador integrado) en la API. `scripts/seed/` está en .gitignore (datos del equipo). Correr: `set -a; source .env; set +a; node scripts/seed.ts [url] [usuario] [contraseña]`.
- El usuario **prefiere Cifra Club** como fuente de acordes. Se leen abriendo la página en el navegador integrado (visita normal); nunca con curl/headers falsos.

## Publicación
- **Producción:** https://alabanza-mirefugio.netlify.app (sitio Netlify `alabanza-mirefugio`, carpeta vinculada). Env en Netlify: `AUTH_SECRET` (secreto; copia local en `.env` como `PROD_AUTH_SECRET`), `INVITE_CODE` = `mirefugio`.
- **Deploy:** manual con `netlify deploy --prod --build`. Todavía NO hay repo en GitHub: el usuario no ha decidido si público (como gym-app, necesario en el plan gratis para deploy automático) o privado. Git es solo local. Nunca subir secretos ni las canciones (`scripts/seed/` y `.env` están en .gitignore).
- Cargar datos en producción: `set -a; source .env; set +a; SEED_SECRET=$PROD_AUTH_SECRET node scripts/seed.ts https://alabanza-mirefugio.netlify.app` (firma un token como "repertorio", sin cuenta).

## Local
`netlify dev --offline` (launch config `alabanza-app` en la carpeta padre) → abrir Vite en :5176 (proxy /api → :8889). `.env` (gitignored) tiene secretos locales y la cuenta de prueba. Tests: `npm test` (node --test). Con `LACUERDA_SAMPLE=<html>` prueba también una página real.
