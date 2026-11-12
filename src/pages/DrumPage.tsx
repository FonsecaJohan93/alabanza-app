import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { blocksOf, parseChordPro } from '../lib/chordsheet'
import { chartFromSong, cleanDrums, drumsFor, DYNAMICS, FEELS, sectionKey, type DrumChart, type Dynamic } from '../lib/drums'
import { meterOf, type LibraryRhythm } from '../lib/rhythm'
import { saveSong, savePersonal, useMe, usePersonal, useRhythms, useSong, useStore } from '../lib/store'
import type { Song } from '../types'
import { DynamicIcon } from '../components/DrumIcons'
import { useTapTempo } from '../components/DrumPanel'
import { BigPulse } from '../components/Pulse'
import { RhythmPlay } from '../components/RhythmEditor'
import { VoiceButton } from '../components/VoiceButton'
import { Button, ErrorBox, Header, inputClass } from '../components/ui'

const dynLabel = (d: Dynamic) => DYNAMICS.find((x) => x.id === d)?.label ?? d
/** Clave de una sección para guardar mi ritmo: "Coro 2" y "CORO" → "coro". */
const keyOf = (name: string) => sectionKey(name.replace(/\s*\d+$/, ''))

/** Mi ritmo para cada sección (de la biblioteca del equipo). */
function useMyRhythms(song: Song) {
  const library = useRhythms()
  const mine = usePersonal(song.id)
  return (sectionName: string): LibraryRhythm | undefined => {
    const id = mine.rhythms?.[keyOf(sectionName)]
    return id ? library.find((r) => r.id === id) : undefined
  }
}

/**
 * Pantalla del baterista: tempo grande y la letra por secciones con el ▶ del
 * ritmo que cada quien eligió y el matiz de la sección. Se elige en "Editar".
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
              <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft" title="Ritmo y matiz por sección">
                Editar
              </button>
            )}
          </>
        }
      />
      {editing ? <SectionsEditor key={song.updatedAt} song={song} onDone={() => setEditing(false)} /> : <Board song={song} autoPulse={!!prefs.autoPulse} onEdit={() => setEditing(true)} />}
    </div>
  )
}

function Board({ song, autoPulse, onEdit }: { song: Song; autoPulse: boolean; onEdit: () => void }) {
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  const rhythmFor = useMyRhythms(song)
  const blocks = useMemo(() => blocksOf(parseChordPro(song.content)), [song.content])
  const anyRhythm = blocks.some((b) => {
    const l = b.lines[0]?.line
    return l?.type === 'section' && !!rhythmFor(l.name)
  })

  return (
    <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-4xl">
      <BigPulse bpm={song.bpm} feel={chart.feel} autoStart={autoPulse} />
      {chart.feel && <p className="-mt-2 px-1 text-sm text-slate-500">Feel: {chart.feel}</p>}
      {!anyRhythm && (
        <button onClick={onEdit} className="w-full rounded-2xl bg-accent-soft p-3 text-sm font-semibold text-accent">
          Elegir el ritmo y el matiz de cada sección →
        </button>
      )}

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
              const r = name ? rhythmFor(name) : undefined
              return (
                <div key={b.start} className="mb-3 break-inside-avoid rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line">
                  {name && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold tracking-wider text-accent uppercase">{name}</span>
                      {d?.dynamic && (
                        <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                          <DynamicIcon dynamic={d.dynamic} size={15} />
                          {dynLabel(d.dynamic)}
                        </span>
                      )}
                      <span className="flex-1" />
                      {r && <RhythmPlay id={`sec-${b.start}`} pattern={r.pattern} bpm={song.bpm ?? r.bpm} meter={r.meter} label={r.name} />}
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

/**
 * Editar en batería: BPM y feel de la canción, y por sección el ritmo (mío,
 * de la biblioteca) y el matiz (de la canción, para todos).
 */
function SectionsEditor({ song, onDone }: { song: Song; onDone: () => void }) {
  const library = useRhythms()
  const mine = usePersonal(song.id)
  const { roles } = useMe()
  const canCreate = roles.includes('direccion') || roles.includes('bateria')
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  // Secciones en el orden de la canción (sin repetir); y las que solo estén en la hoja de batería
  const names = useMemo(() => {
    const fromSong = chartFromSong(song.content).sections.map((s) => s.name)
    const extra = chart.sections.map((s) => s.name).filter((n) => !fromSong.some((m) => keyOf(m) === keyOf(n)))
    return [...fromSong, ...extra]
  }, [song.content, chart.sections])

  const [bpm, setBpm] = useState<number | undefined>(song.bpm)
  const [feel, setFeel] = useState<string | undefined>(chart.feel)
  const [dyn, setDyn] = useState<Record<string, Dynamic | undefined>>(() => Object.fromEntries(names.map((n) => [keyOf(n), drumsFor(chart, n)?.dynamic])))
  const [rhy, setRhy] = useState<Record<string, string>>(() => ({ ...(mine.rhythms ?? {}) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tap = useTapTempo(setBpm)
  const songMeter = meterOf(feel)
  const options = [...library].sort((a, b) => Number(b.meter === songMeter) - Number(a.meter === songMeter) || a.name.localeCompare(b.name))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      // Matiz, BPM y feel: de la canción (para todo el equipo). Lo demás de cada sección se conserva.
      const sections = names.map((n) => ({ ...(drumsFor(chart, n) ?? { name: n, parts: [] }), dynamic: dyn[keyOf(n)] }))
      const others = chart.sections.filter((s) => !names.some((n) => keyOf(n) === keyOf(s.name)))
      const drums: DrumChart = { ...chart, feel, sections: [...sections, ...others] }
      if (bpm !== song.bpm || JSON.stringify(drums) !== JSON.stringify(chart)) await saveSong({ ...song, bpm, drums }, song)
      // Ritmo de cada sección: mío
      const clean = Object.fromEntries(Object.entries(rhy).filter(([, v]) => v))
      if (JSON.stringify(clean) !== JSON.stringify(mine.rhythms ?? {})) await savePersonal(song.id, { rhythms: Object.keys(clean).length ? clean : undefined })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-24 md:landscape:mx-auto md:landscape:max-w-3xl">
      <div className="flex items-end gap-2">
        <label className="w-28">
          <span className="mb-1 block text-sm font-medium text-slate-700">BPM</span>
          <input className={inputClass} inputMode="numeric" value={bpm ?? ''} onChange={(e) => setBpm(Number(e.target.value.replace(/\D/g, '')) || undefined)} />
        </label>
        <button onClick={tap} className="flex-1 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent active:bg-accent active:text-white">
          Toca al ritmo (tap tempo)
        </button>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Feel</span>
        <div className="flex flex-wrap gap-1.5">
          {FEELS.map((f) => (
            <button key={f} onClick={() => setFeel(feel === f ? undefined : f)} className={`rounded-full px-3 py-1 text-sm ${feel === f ? 'bg-accent text-white' : 'bg-panel text-slate-700'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Por sección</h2>
        {canCreate && (
          <Link to="/ritmos" className="text-sm font-semibold text-accent">
            Crear o editar ritmos →
          </Link>
        )}
      </div>
      {!library.length && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Todavía no hay ritmos en la biblioteca. Créalos en “Crear ritmo” y vuelve aquí para elegirlos.</p>
      )}

      <ol className="space-y-2">
        {names.map((n) => {
          const k = keyOf(n)
          const r = library.find((x) => x.id === rhy[k])
          return (
            <li key={k} className="rounded-2xl bg-panel p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-accent uppercase">{n}</span>
                <span className="flex-1" />
                {r && <RhythmPlay id={`ed-${k}`} pattern={r.pattern} bpm={bpm ?? r.bpm} meter={r.meter} label="" />}
                <select
                  value={rhy[k] ?? ''}
                  onChange={(e) => setRhy({ ...rhy, [k]: e.target.value })}
                  disabled={!library.length}
                  className="max-w-[60%] rounded-lg bg-accent-soft px-2 py-1 text-sm font-semibold text-accent disabled:opacity-50"
                  aria-label={`Ritmo para ${n}`}
                >
                  <option value="">Sin ritmo</option>
                  {options.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.meter !== songMeter ? ` (${x.meter})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DYNAMICS.map(({ id, label }) => {
                  const on = dyn[k] === id
                  return (
                    <button
                      key={id}
                      onClick={() => setDyn({ ...dyn, [k]: on ? undefined : id })}
                      className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs ${on ? 'bg-accent text-white' : 'bg-black/5 text-slate-600'}`}
                      aria-pressed={on}
                    >
                      <DynamicIcon dynamic={id} size={18} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-slate-500">El ritmo de cada sección se guarda para ti; el matiz, el BPM y el feel son de la canción, para todo el equipo.</p>
      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="ghost" onClick={onDone} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy} className="flex-[2]">
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
