import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { upcomingSunday, useService } from '../lib/service'
import { useMe, useSongs } from '../lib/store'
import type { Song } from '../types'
import { RhythmLibrary } from '../components/RhythmLibrary'
import { Header, inputClass } from '../components/ui'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Crear ritmo: elegir la canción y trabajar sus ritmos (para dirección y batería). */
export default function Rhythms() {
  const songs = useSongs()
  const { roles, loaded } = useMe()
  const { service } = useService(upcomingSunday())
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const allowed = roles.includes('direccion') || roles.includes('bateria')

  const sunday = useMemo(() => (service?.items ?? []).map((i) => songs.find((s) => s.id === i.songId)).filter((s): s is Song => !!s), [service, songs])
  const terms = fold(q).split(/\s+/).filter(Boolean)
  const results = terms.length ? songs.filter((s) => terms.every((t) => fold(`${s.title} ${s.artist}`).includes(t))).slice(0, 12) : []
  const song = songs.find((s) => s.id === picked)

  if (loaded && !allowed)
    return (
      <div>
        <Header title="Crear ritmo" />
        <p className="p-6 text-center text-slate-500">Esta opción es para quien tiene Dirección o Batería en su perfil.</p>
      </div>
    )

  const row = (s: Song) => (
    <li key={s.id}>
      <button
        onClick={() => setPicked(s.id)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50 ${picked === s.id ? 'bg-accent-soft' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{s.title}</span>
          <span className="block truncate text-sm text-slate-500">
            {[s.artist, s.bpm && `${s.bpm} BPM`, s.drums?.rhythms?.length && `${s.drums.rhythms.length} ritmo(s)`].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="text-sm font-semibold text-accent">{picked === s.id ? 'Elegida' : 'Elegir'}</span>
      </button>
    </li>
  )

  return (
    <div className="pb-24">
      <Header title="Crear ritmo" />
      <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-3xl">
        {song ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-panel p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{song.title}</p>
                <p className="text-sm text-slate-500">{song.bpm ? `${song.bpm} BPM` : 'Sin BPM (se usa 80)'} · {song.drums?.feel ?? '4/4'}</p>
              </div>
              <button onClick={() => setPicked(null)} className="shrink-0 text-sm font-semibold text-accent">
                Cambiar canción
              </button>
            </div>
            <RhythmLibrary key={song.id} song={song} />
            <Link to={`/cancion/${song.id}/bateria`} className="block rounded-2xl bg-accent-soft p-3 text-center text-sm font-semibold text-accent">
              Elegir el ritmo de cada sección →
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Elige la canción para la que vas a crear el ritmo.</p>
            {sunday.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">De este domingo</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">{sunday.map(row)}</ul>
              </section>
            )}
            <section>
              <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Buscar en el repertorio</h2>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título o artista…" className={inputClass} />
              {results.length > 0 && <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-panel">{results.map(row)}</ul>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
