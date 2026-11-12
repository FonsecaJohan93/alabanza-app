import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { lyricsOnly } from '../lib/chordsheet'
import { refreshSongs, useMe, useSongs, useStore } from '../lib/store'
import { songPath } from '../lib/team'
import { DrumButton } from '../components/DrumButton'
import { VoiceButton } from '../components/VoiceButton'
import { ErrorBox, Header, TEMPO_LABEL } from '../components/ui'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SongList() {
  const songs = useSongs()
  const { views } = useMe()
  const loaded = useStore((s) => s.loaded)
  const error = useStore((s) => s.error)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => {
    const count = new Map<string, number>()
    songs.forEach((s) => s.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)))
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [songs])

  // Se busca por título, artista, tema y también por la letra
  const index = useMemo(
    () => new Map(songs.map((s) => [s.id, fold(`${s.title} ${s.artist} ${s.tags.join(' ')} ${lyricsOnly(s.content)}`)])),
    [songs],
  )
  const terms = fold(q).split(/\s+/).filter(Boolean)
  const shown = songs.filter((s) => (!tag || s.tags.includes(tag)) && terms.every((t) => index.get(s.id)?.includes(t)))

  return (
    <div className="pb-24">
      <Header title="Repertorio" />
      <div className="space-y-3 px-4 pt-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, artista o letra…"
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-accent"
        />
        {tags.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${tag === t ? 'bg-accent text-white' : 'bg-panel text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {error && (
          <ErrorBox>
            {error}.{' '}
            <button className="underline" onClick={() => void refreshSongs()}>
              Reintentar
            </button>
          </ErrorBox>
        )}

        {!loaded && !songs.length ? (
          <p className="py-10 text-center text-slate-500">Cargando canciones…</p>
        ) : !songs.length ? (
          <div className="rounded-2xl bg-panel p-6 text-center">
            <p className="font-medium">Todavía no hay canciones</p>
            <p className="mt-1 text-sm text-slate-600">Agrega la primera pegando un link de LaCuerda o el texto de los acordes.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {shown.length === songs.length ? `${songs.length} canciones` : `${shown.length} de ${songs.length}`}
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
              {shown.map((s) => (
                <li key={s.id}>
                  <Link to={songPath(s.id, views)} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[s.artist, s.tempo && TEMPO_LABEL[s.tempo], s.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {s.key && <span className="rounded-lg bg-accent-soft px-2 py-1 text-sm font-bold text-accent">{s.key}</span>}
                    {views.lyrics && views.primary !== 'voces' && <VoiceButton song={s} />}
                    {views.drums && views.primary !== 'bateria' && <DrumButton song={s} />}
                  </Link>
                </li>
              ))}
            </ul>
            {!shown.length && <p className="py-6 text-center text-slate-500">Nada coincide con la búsqueda</p>}
          </>
        )}
      </div>

      <Link
        to="/nueva"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        className="fixed right-4 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 font-semibold text-white shadow-lg active:brightness-110"
      >
        <span className="text-xl leading-none">+</span> Agregar canción
      </Link>
    </div>
  )
}
