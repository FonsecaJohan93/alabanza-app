import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { capoSuggestion, guessKey, keyView } from '../lib/chordsheet'
import { upcomingSunday, useService } from '../lib/service'
import { savePersonal, useMe, usePersonal, useSong, useStore } from '../lib/store'
import { ChordSheet } from '../components/ChordSheet'
import { DrumButton } from '../components/DrumButton'
import { VoiceButton } from '../components/VoiceButton'
import { PulseButton } from '../components/Pulse'
import { ErrorBox, Header, TEMPO_LABEL } from '../components/ui'

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
  const { prefs, views } = useMe()
  const loaded = useStore((s) => s.loaded)
  const mine = usePersonal(id)
  // El tono en que suena: el que puso dirección para el domingo, o el de la canción
  const { service } = useService(upcomingSunday())
  const sundayKey = service?.items.find((i) => i.songId === id)?.key
  const [showChords, setShowChords] = usePref('alabanza:showChords', true)
  const [fontSize, setFontSize] = usePref('alabanza:fontSize', 17)

  if (!song)
    return (
      <div>
        <Header title="Canción" back="/repertorio" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  const written = song.key || guessKey(song.content)
  const sounding = sundayKey || written
  const capo = mine.capo ?? 0
  const { semis, shapeKey } = keyView(written, sounding, capo)
  const suggested = sounding ? capoSuggestion(sounding) : null

  return (
    <div className="pb-16">
      <Header
        title={song.title}
        back="/repertorio"
        actions={
          <>
          {views.lyrics && <VoiceButton song={song} />}
          {views.drums && <DrumButton song={song} />}
          <Link to={`/cancion/${song.id}/editar`} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft">
            Editar
          </Link>
          </>
        }
      />

      {/* Controles: tono, acordes on/off, tamaño de letra */}
      <div className="sticky top-[53px] z-10 flex flex-wrap items-center gap-1.5 border-b border-line bg-ink/95 px-4 py-2 backdrop-blur">
        {/* El tono lo decide dirección; aquí solo se ve. El capo es de cada uno. */}
        <div className="flex items-baseline gap-1.5 rounded-xl bg-panel px-3 py-2" title={sundayKey ? 'Tono del domingo: lo pone dirección' : 'Tono de la canción'}>
          <span className="text-sm text-slate-500">Suena en</span>
          <b className="text-accent">{sounding || '—'}</b>
          {sundayKey && <span className="text-[10px] font-semibold text-slate-400 uppercase">domingo</span>}
        </div>
        {showChords && sounding && (
          <label className="flex items-center rounded-xl bg-panel px-2 py-1.5">
            <span className="sr-only">Capo</span>
            <select
              value={capo}
              onChange={(e) => void savePersonal(song.id, { capo: Number(e.target.value) || undefined })}
              className="bg-transparent text-sm font-medium"
              aria-label="Mi capo"
            >
              <option value={0}>Sin capo</option>
              {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                <option key={c} value={c}>
                  Capo {c} · {keyView(written, sounding, c).shapeKey}
                  {suggested?.capo === c ? ' ★' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex-1" />
        <PulseButton bpm={song.bpm} feel={song.drums?.feel} autoStart={prefs.autoPulse} />
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
        {showChords && capo > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            Suena en <b>{sounding}</b> · tú con capo {capo}, formas de <b className="text-accent">{shapeKey}</b>
          </p>
        )}
        {showChords && !capo && suggested && (
          <p className="mt-1 text-xs text-slate-500">
            Guitarra: con capo {suggested.capo} se toca con formas de {suggested.shape} (★ en el menú de capo)
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
        <MyNotes key={song.id + (mine.updatedAt ?? '')} songId={song.id} initial={mine.notes ?? ''} />

        <div className="mt-4">
          {song.content.trim() ? (
            <ChordSheet content={song.content} semitones={semis} targetKey={shapeKey} showChords={showChords} fontSize={fontSize} drums={song.drums} columns />
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

/** Notas y arreglos propios de esta canción: se guardan en mi cuenta y nadie más los ve. */
function MyNotes({ songId, initial }: { songId: string; initial: string }) {
  const [open, setOpen] = useState(!!initial)
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (text === initial) return
    setState('saving')
    setError(null)
    try {
      await savePersonal(songId, { notes: text.trim() || undefined })
      setState('saved')
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-accent">
        + Mis notas y arreglos
      </button>
    )
  return (
    <div className="mt-3 rounded-xl border border-dashed border-accent/40 bg-white px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-accent">Mis notas y arreglos · solo tú las ves</span>
        <span className="text-slate-400">{state === 'saving' ? 'Guardando…' : state === 'saved' ? 'Guardado' : ''}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => (setText(e.target.value), setState('idle'))}
        onBlur={save}
        rows={Math.max(2, text.split('\n').length)}
        placeholder="Ej.: en el puente cambio a la eléctrica, arpegio en el verso 2…"
        className="mt-1 w-full resize-none bg-transparent text-sm outline-none"
      />
      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  )
}
