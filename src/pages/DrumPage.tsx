import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMe, useSong, useStore } from '../lib/store'
import { ChordSheet } from '../components/ChordSheet'
import { DrumEditor, DrumView } from '../components/DrumPanel'
import { PulseButton } from '../components/Pulse'
import { VoiceButton } from '../components/VoiceButton'
import { Header } from '../components/ui'

/** Pantalla del baterista: pulso, feel, piezas por sección y la letra con sus iconos. */
export default function DrumPage() {
  const { id } = useParams()
  const song = useSong(id)
  const loaded = useStore((s) => s.loaded)
  const { prefs, views } = useMe()
  const [editing, setEditing] = useState(false)

  if (!song)
    return (
      <div>
        <Header title="Batería" back="/" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  return (
    <div className="pb-24">
      <Header
        title={song.title}
        back="/"
        actions={
          <>
            {views.lyrics && <VoiceButton song={song} />}
            <PulseButton bpm={song.bpm} feel={song.drums?.feel} autoStart={prefs.autoPulse} className="py-1.5" />
            {!editing && (
              <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft">
                Editar
              </button>
            )}
          </>
        }
      />
      <div className="md:landscape:grid md:landscape:grid-cols-2 md:landscape:gap-6">
        <div className="bg-ink">{editing ? <DrumEditor song={song} onDone={() => setEditing(false)} /> : <DrumView song={song} onEdit={() => setEditing(true)} />}</div>
        {song.content.trim() && (
          <div className="px-5 pt-2">
            <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Letra y estructura</h2>
            <ChordSheet content={song.content} showChords={false} drums={song.drums} drumIcons />
          </div>
        )}
      </div>
    </div>
  )
}
