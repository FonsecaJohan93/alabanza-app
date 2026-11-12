import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { capoSuggestion, transposeKey } from '../lib/chordsheet'
import { useSong, useStore } from '../lib/store'
import { ChordSheet } from '../components/ChordSheet'
import { Header, TEMPO_LABEL } from '../components/ui'

// Preferencias de cada persona en su teléfono (no se comparten con el equipo)
function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  return [
    value,
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* nada */
      }
    },
  ]
}

export default function SongView() {
  const { id } = useParams()
  const song = useSong(id)
  const loaded = useStore((s) => s.loaded)
  const [semis, setSemis] = usePref(`alabanza:transpose:${id}`, 0)
  const [showChords, setShowChords] = usePref('alabanza:showChords', true)
  const [fontSize, setFontSize] = usePref('alabanza:fontSize', 17)

  if (!song)
    return (
      <div>
        <Header title="Canción" back="/" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  const step = (d: number) => setSemis(((((semis + d) % 12) + 12 + 5) % 12) - 5) // rango −5…+6
  const key = song.key ? transposeKey(song.key, semis) : ''
  const capo = key ? capoSuggestion(key) : null

  return (
    <div className="pb-16">
      <Header
        title={song.title}
        back="/"
        actions={
          <Link to={`/cancion/${song.id}/editar`} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft">
            Editar
          </Link>
        }
      />

      {/* Controles: tono, acordes on/off, tamaño de letra */}
      <div className="sticky top-[53px] z-10 flex items-center gap-1.5 border-b border-line bg-ink/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center rounded-xl bg-panel">
          <button onClick={() => step(-1)} className="px-3 py-2 text-lg leading-none" aria-label="Bajar medio tono">
            −
          </button>
          <div className="min-w-11 text-center">
            <div className="text-[10px] leading-none text-slate-500 uppercase">Tono</div>
            <div className="font-bold text-accent">{key || (semis > 0 ? `+${semis}` : semis || '—')}</div>
          </div>
          <button onClick={() => step(1)} className="px-3 py-2 text-lg leading-none" aria-label="Subir medio tono">
            +
          </button>
        </div>
        {semis !== 0 && (
          <button onClick={() => setSemis(0)} className="rounded-xl px-1.5 py-2 text-xs leading-tight text-slate-500" title="Volver al tono original">
            ↺ {song.key || '0'}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowChords(!showChords)}
          className={`rounded-xl px-2.5 py-2 text-sm font-medium ${showChords ? 'bg-panel' : 'bg-accent text-white'}`}
        >
          {showChords ? 'Letra' : 'Acordes'}
        </button>
        <div className="flex rounded-xl bg-panel text-sm">
          <button onClick={() => setFontSize(Math.max(13, fontSize - 2))} className="px-2 py-2" aria-label="Letra más pequeña">
            A−
          </button>
          <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="px-2 py-2 font-semibold" aria-label="Letra más grande">
            A+
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <p className="text-sm text-slate-600">
          {[song.artist, song.tempo && TEMPO_LABEL[song.tempo], song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ')}
        </p>
        {showChords && capo && (
          <p className="mt-1 text-sm text-slate-500">
            Guitarra: capo {capo.capo} con forma de <b className="text-slate-700">{capo.shape}</b>
          </p>
        )}
        {song.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {song.tags.map((t) => (
              <span key={t} className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-slate-600">
                {t}
              </span>
            ))}
          </div>
        )}
        {song.notes && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap text-amber-900">{song.notes}</p>}

        <div className="mt-4">
          {song.content.trim() ? (
            <ChordSheet content={song.content} semitones={semis} targetKey={key} showChords={showChords} fontSize={fontSize} />
          ) : (
            <p className="text-slate-500">Esta canción todavía no tiene letra ni acordes.</p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          {song.youtube && (
            <a href={song.youtube} target="_blank" rel="noreferrer" className="text-accent underline">
              Escuchar en YouTube
            </a>
          )}
          {song.sourceUrl && (
            <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              Ver fuente original
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Última edición: {song.updatedBy}, {new Date(song.updatedAt).toLocaleDateString('es')}
        </p>
      </div>
    </div>
  )
}
