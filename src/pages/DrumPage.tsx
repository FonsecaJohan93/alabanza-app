import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { blocksOf, parseChordPro } from '../lib/chordsheet'
import { cleanDrums, drumsFor, rhythmOf, sectionKey, type DrumChart } from '../lib/drums'
import { saveSong, useMe, useSong, useStore } from '../lib/store'
import type { Song } from '../types'
import { DrumEditor } from '../components/DrumPanel'
import { DynamicIcon, PartIcon } from '../components/DrumIcons'
import { BigPulse } from '../components/Pulse'
import { RhythmPlay } from '../components/RhythmEditor'
import { RhythmLibrary } from '../components/RhythmLibrary'
import { VoiceButton } from '../components/VoiceButton'
import { ErrorBox, Header } from '../components/ui'

/**
 * Pantalla del baterista: tempo grande, los ritmos de la canción y la letra
 * por secciones con el ▶ del ritmo elegido encima de cada una.
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
  // cleanDrums también pasa los ritmos antiguos (dentro de la sección) a la biblioteca
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  const rhythms = chart.rhythms ?? []
  const [error, setError] = useState<string | null>(null)
  const blocks = useMemo(() => blocksOf(parseChordPro(song.content)), [song.content])

  async function saveChart(next: DrumChart) {
    setError(null)
    try {
      await saveSong({ ...song, drums: next }, song)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /** Elige el ritmo de una sección de la letra (crea su entrada si no existe). */
  function chooseRhythm(sectionName: string, rhythmId: string | undefined) {
    const current = drumsFor(chart, sectionName)
    const base = sectionName.replace(/\s*\d+$/, '')
    const sections = current
      ? chart.sections.map((s) => (s === current ? { ...s, rhythm: rhythmId, pattern: undefined } : s))
      : [...chart.sections, { name: sectionKey(base) === sectionKey(sectionName) ? sectionName : base, parts: [], rhythm: rhythmId }]
    void saveChart({ ...chart, sections })
  }

  return (
    <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-4xl">
      <BigPulse bpm={song.bpm} feel={chart.feel} autoStart={autoPulse} />
      {chart.feel && <p className="-mt-2 px-1 text-sm text-slate-500">Feel: {chart.feel}</p>}

      <RhythmLibrary song={song} />
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
              const r = rhythmOf(chart, d)
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
                      {r && <RhythmPlay id={`sec-${b.start}`} pattern={r.pattern} bpm={song.bpm} feel={chart.feel} label={r.name} />}
                      {rhythms.length > 0 && (
                        <select
                          value={d?.rhythm ?? ''}
                          onChange={(e) => chooseRhythm(name, e.target.value || undefined)}
                          className="rounded-lg bg-black/5 px-1.5 py-0.5 text-xs text-slate-600"
                          aria-label={`Ritmo para ${name}`}
                        >
                          <option value="">{r ? 'Sin ritmo' : 'Elegir ritmo…'}</option>
                          {rhythms.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
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
