import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { capoSuggestion, guessKey, isChord, keyView, parseChordPro, semitonesBetween, sharpKey, transposeChord, transposeChordPro, transposeKey } from '../lib/chordsheet'
import { ChordPanel } from '../components/ChordPanel'
import { upcomingSunday, useService } from '../lib/service'
import { savePersonal, saveSong, useMe, usePersonal, useSong, useStore } from '../lib/store'
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
  const { prefs, views, isDirector } = useMe()
  const loaded = useStore((s) => s.loaded)
  const mine = usePersonal(id)
  const [trans, setTrans] = useState(0)
  // El tono en que suena: el que puso dirección para el domingo, o el de la canción
  const { service, save: saveSunday } = useService(upcomingSunday())
  const sundayItem = service?.items.find((i) => i.songId === id)
  const sundayKey = sundayItem?.key ? sharpKey(sundayItem.key) : undefined
  const [chordOpen, setChordOpen] = useState<string | null>(null)
  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [showChords, setShowChords] = usePref('alabanza:showChords', true)
  const [fontSize, setFontSize] = usePref('alabanza:fontSize', 17)

  if (!song)
    return (
      <div>
        <Header title="Canción" back="/repertorio" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  const written = sharpKey(song.key || guessKey(song.content))
  const teamKey = sundayKey || written
  // Transponer para practicar: temporal, solo en esta pantalla (no se guarda ni cambia lo del equipo)
  const sounding = trans && teamKey ? transposeKey(teamKey, trans) : teamKey
  const capo = mine.capo ?? 0
  const { semis, shapeKey } = keyView(written, sounding, capo)
  const suggested = sounding ? capoSuggestion(sounding) : null
  // Los acordes de la canción, como se ven en la hoja (con transposición y capo), sin repetir
  const songChords = (() => {
    const seen = new Set<string>()
    for (const l of parseChordPro(song.content)) {
      const cs = l.type === 'chords' ? l.chords : l.type === 'lyrics' ? l.parts.map((p) => p.chord).filter((c): c is string => !!c) : []
      for (const c of cs) if (isChord(c)) seen.add(transposeChord(c, semis, shapeKey))
    }
    return [...seen]
  })()

  // Dirección convierte la transposición en el tono definitivo:
  // si está en la lista del domingo, cambia el tono del domingo; si no, reescribe la canción
  async function fixKey() {
    if (!song || !sounding) return
    setFixing(true)
    setFixError(null)
    try {
      if (sundayItem && service) await saveSunday(service.items.map((i) => (i.songId === song.id ? { ...i, key: sounding } : i)))
      else await saveSong({ ...song, key: sounding, content: transposeChordPro(song.content, semitonesBetween(written, sounding)) }, song)
      setTrans(0)
    } catch (e) {
      setFixError((e as Error).message)
    } finally {
      setFixing(false)
    }
  }
  const stepTrans = (d: number) => setTrans(((((trans + d) % 12) + 12 + 5) % 12) - 5) // −5…+6

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
        <div
          className={`flex items-center rounded-xl ${trans ? 'bg-amber-100 ring-1 ring-amber-300' : 'bg-panel'}`}
          title={sundayKey ? 'Tono del domingo: lo pone dirección. −/+ transpone solo para ti, por ahora.' : 'Tono de la canción. −/+ transpone solo para ti, por ahora.'}
        >
          <button onClick={() => stepTrans(-1)} disabled={!teamKey} className="px-2.5 py-2 text-lg leading-none disabled:opacity-30" aria-label="Bajar medio tono (solo para mí)">
            −
          </button>
          <span className="flex items-baseline gap-1.5 py-2">
            <span className="text-sm text-slate-500">{trans ? 'Viendo en' : 'Suena en'}</span>
            <b className={trans ? 'text-amber-900' : 'text-accent'}>{sounding || '—'}</b>
            {sundayKey && !trans && <span className="text-[10px] font-semibold text-slate-400 uppercase">domingo</span>}
          </span>
          <button onClick={() => stepTrans(1)} disabled={!teamKey} className="px-2.5 py-2 text-lg leading-none disabled:opacity-30" aria-label="Subir medio tono (solo para mí)">
            +
          </button>
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

      {trans !== 0 && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span className="min-w-0 flex-1">
            Estás viendo en <b>{sounding}</b> ({trans > 0 ? `+${trans}` : trans}) · el equipo toca en <b>{teamKey}</b>. Solo para ti, no se guarda.
          </span>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            {isDirector && (
              <button onClick={fixKey} disabled={fixing} className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white shadow-sm active:bg-amber-700 disabled:opacity-50">
                {fixing ? 'Guardando…' : sundayItem ? `Fijar ${sounding} el domingo` : `Guardar en ${sounding}`}
              </button>
            )}
            <button onClick={() => setTrans(0)} className="rounded-lg bg-white px-2.5 py-1 font-semibold shadow-sm active:bg-amber-100">
              Volver a {teamKey}
            </button>
          </div>
        </div>
      )}
      {fixError && (
        <div className="px-4 pt-2">
          <ErrorBox>{fixError}</ErrorBox>
        </div>
      )}

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
            <>
              {showChords && songChords.length > 0 && <p className="mb-2 text-xs text-slate-400">Toca un acorde para ver cómo se pone en la guitarra.</p>}
              <ChordSheet
                content={song.content}
                semitones={semis}
                targetKey={shapeKey}
                showChords={showChords}
                fontSize={fontSize}
                drums={song.drums}
                columns
                onChord={setChordOpen}
              />
              {chordOpen && <ChordPanel chords={songChords} initial={chordOpen} capo={capo} onClose={() => setChordOpen(null)} />}
            </>
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
