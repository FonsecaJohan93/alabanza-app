import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { blocksOf, parseChordPro } from '../lib/chordsheet'
import { cleanDrums, drumsFor, sectionKey, type DrumChart } from '../lib/drums'
import { meterOf } from '../lib/rhythm'
import { savePersonal, useMe, usePersonal, useRhythms, useSong, useStore } from '../lib/store'
import type { Song } from '../types'
import { DrumEditor } from '../components/DrumPanel'
import { DynamicIcon, PartIcon } from '../components/DrumIcons'
import { BigPulse } from '../components/Pulse'
import { RhythmPlay } from '../components/RhythmEditor'
import { VoiceButton } from '../components/VoiceButton'
import { ErrorBox, Header } from '../components/ui'

/**
 * Pantalla del baterista: tempo grande y la letra por secciones con el ▶
 * del ritmo que cada quien eligió (de la biblioteca del equipo) encima.
 */
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
            {!editing && (
              <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft" title="Feel, piezas y dinámica">
                Editar
              </button>
            )}
          </>
        }
      />
      {editing ? <DrumEditor song={song} onDone={() => setEditing(false)} /> : <Board song={song} autoPulse={!!prefs.autoPulse} />}
    </div>
  )
}

function Board({ song, autoPulse }: { song: Song; autoPulse: boolean }) {
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  const library = useRhythms()
  const mine = usePersonal(song.id)
  const { roles } = useMe()
  const canEdit = roles.includes('direccion') || roles.includes('bateria')
  const songMeter = meterOf(chart.feel)
  // Primero los ritmos del mismo compás de la canción
  const options = useMemo(() => [...library].sort((a, b) => Number(b.meter === songMeter) - Number(a.meter === songMeter) || a.name.localeCompare(b.name)), [library, songMeter])
  const [error, setError] = useState<string | null>(null)
  const blocks = useMemo(() => blocksOf(parseChordPro(song.content)), [song.content])

  /** Mi ritmo para una sección (guardado en mi cuenta, no lo ve el resto). */
  async function chooseRhythm(sectionName: string, rhythmId: string) {
    setError(null)
    const key = sectionKey(sectionName.replace(/\s*\d+$/, ''))
    const rhythms = { ...(mine.rhythms ?? {}) }
    if (rhythmId) rhythms[key] = rhythmId
    else delete rhythms[key]
    try {
      await savePersonal(song.id, { rhythms: Object.keys(rhythms).length ? rhythms : undefined })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const assigned = (sectionName: string) => {
    const id = mine.rhythms?.[sectionKey(sectionName.replace(/\s*\d+$/, ''))]
    return id ? library.find((r) => r.id === id) : undefined
  }

  return (
    <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-4xl">
      <BigPulse bpm={song.bpm} feel={chart.feel} autoStart={autoPulse} />
      {chart.feel && <p className="-mt-2 px-1 text-sm text-slate-500">Feel: {chart.feel}</p>}

      <p className="-mt-1 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-slate-500">
        <span>Elige el ritmo de cada sección; suena a {song.bpm ?? 80} BPM y queda guardado para ti.</span>
        {canEdit && (
          <Link to="/ritmos" className="font-semibold text-accent">
            Crear o editar ritmos →
          </Link>
        )}
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}

      {/* Letra por secciones con el ritmo elegido encima */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">Letra y ritmos por sección</h2>
        {song.content.trim() ? (
          <div className="pages space-y-1" style={{ ['--pages-top' as string]: '4.5rem' }}>
            {blocks.map((b) => {
              const first = b.lines[0]?.line
              if (first?.type === 'cue')
                return (
                  <p key={b.start} className="my-2 break-inside-avoid text-sm font-semibold text-amber-800">
                    ↻ {first.text}
                  </p>
                )
              const name = first?.type === 'section' ? first.name : undefined
              const lyrics = b.lines.flatMap((l) => (l.line.type === 'lyrics' ? [l.line.parts.map((p) => p.text).join('').trim()] : [])).filter(Boolean)
              const d = name ? drumsFor(chart, name) : undefined
              const r = name ? assigned(name) : undefined
              return (
                <div key={b.start} className="mb-3 break-inside-avoid rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
                  {name && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold tracking-wider text-accent uppercase">{name}</span>
                      {d?.dynamic && (
                        <span className="text-accent" title={d.dynamic}>
                          <DynamicIcon dynamic={d.dynamic} size={16} />
                        </span>
                      )}
                      {d?.parts.map((p) => (
                        <span key={p} className="text-slate-400">
                          <PartIcon part={p} size={16} />
                        </span>
                      ))}
                      <span className="flex-1" />
                      {r && <RhythmPlay id={`sec-${b.start}`} pattern={r.pattern} bpm={song.bpm ?? r.bpm} meter={r.meter} label={r.name} />}
                      {options.length > 0 && (
                        <select
                          value={r?.id ?? ''}
                          onChange={(e) => void chooseRhythm(name, e.target.value)}
                          className="rounded-lg bg-black/5 px-1.5 py-0.5 text-xs text-slate-600"
                          aria-label={`Ritmo para ${name}`}
                        >
                          <option value="">{r ? 'Sin ritmo' : 'Elegir ritmo…'}</option>
                          {options.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                              {x.meter !== songMeter ? ` (${x.meter})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {lyrics.length ? (
                    <div className="text-[17px] leading-snug">
                      {lyrics.map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">♪ Instrumental</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-slate-500">Esta canción todavía no tiene letra.</p>
        )}
      </section>

    </div>
  )
}
