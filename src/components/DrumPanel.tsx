import { useEffect, useRef, useState } from 'react'
import { chartFromSong, DRUM_PARTS, DYNAMICS, FEELS, type DrumChart, type DrumPart, type DrumSection, type Dynamic } from '../lib/drums'
import { saveSong } from '../lib/store'
import type { Song } from '../types'
import { DrumKitIcon, DynamicIcon, PartIcon } from './DrumIcons'
import { RhythmEditor, RhythmPlay } from './RhythmEditor'
import { Button, ErrorBox, inputClass } from './ui'

const partLabel = (p: DrumPart) => DRUM_PARTS.find((x) => x.id === p)?.label ?? p
const dynLabel = (d: Dynamic) => DYNAMICS.find((x) => x.id === d)?.label ?? d

/** Hoja de batería de una canción, en un panel que sube desde abajo. */
export function DrumPanel({ song, onClose }: { song: Song; onClose: () => void }) {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Batería: ${song.title}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-ink shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 pt-4 pb-3">
          <span className="text-accent">
            <DrumKitIcon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Batería</p>
            <p className="truncate font-semibold">{song.title}</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft">
              Editar
            </button>
          )}
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 active:bg-black/5" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {editing ? <DrumEditor song={song} onDone={() => setEditing(false)} /> : <DrumView song={song} onEdit={() => setEditing(true)} />}
      </div>
    </div>
  )
}

export function DrumView({ song, onEdit }: { song: Song; onEdit: () => void }) {
  const chart = song.drums
  return (
    <div className="overflow-y-auto px-5 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-panel p-3">
          <p className="text-xs text-slate-500">BPM</p>
          <p className="text-2xl font-bold">{song.bpm ?? '—'}</p>
        </div>
        <div className="rounded-2xl bg-panel p-3">
          <p className="text-xs text-slate-500">Feel</p>
          <p className="text-lg leading-tight font-semibold">{chart?.feel ?? '—'}</p>
        </div>
      </div>
      {chart?.note && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap text-amber-900">{chart.note}</p>}

      {chart?.sections.length ? (
        <ol className="mt-4 space-y-2">
          {chart.sections.map((s, i) => (
            <li key={i} className="rounded-2xl bg-panel p-3">
              <div className="flex items-center gap-2">
                <p className="flex-1 font-semibold">{s.name}</p>
                {s.pattern && <RhythmPlay id={`view-${song.id}-${i}`} pattern={s.pattern} bpm={song.bpm} feel={chart?.feel} />}
                {s.dynamic && (
                  <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-sm text-accent">
                    <DynamicIcon dynamic={s.dynamic} size={18} />
                    {dynLabel(s.dynamic)}
                  </span>
                )}
              </div>
              {s.parts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                  {s.parts.map((p) => (
                    <span key={p} className="flex items-center gap-1 text-sm text-slate-700">
                      <span className="text-accent">
                        <PartIcon part={p} />
                      </span>
                      {partLabel(p)}
                    </span>
                  ))}
                </div>
              )}
              {s.note && <p className="mt-1.5 text-sm text-slate-600">{s.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 rounded-2xl bg-panel p-5 text-center">
          <p className="text-slate-600">Todavía no hay indicaciones de batería.</p>
          <Button onClick={onEdit} className="mt-3">
            Agregar
          </Button>
        </div>
      )}
    </div>
  )
}

/** Toca el botón al ritmo de la canción y calcula el BPM. */
function useTapTempo(onBpm: (bpm: number) => void) {
  const taps = useRef<number[]>([])
  return () => {
    const now = performance.now()
    const last = taps.current[taps.current.length - 1]
    if (last && now - last > 2000) taps.current = []
    taps.current = [...taps.current, now].slice(-6)
    if (taps.current.length >= 3) {
      const t = taps.current
      const avg = (t[t.length - 1] - t[0]) / (t.length - 1)
      const bpm = Math.round(60000 / avg)
      if (bpm >= 40 && bpm <= 240) onBpm(bpm)
    }
  }
}

export function DrumEditor({ song, onDone }: { song: Song; onDone: () => void }) {
  const [bpm, setBpm] = useState<number | undefined>(song.bpm)
  const [chart, setChart] = useState<DrumChart>(() => song.drums ?? chartFromSong(song.content))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tap = useTapTempo(setBpm)
  const [rhythmFor, setRhythmFor] = useState<number | null>(null)

  const setSection = (i: number, patch: Partial<DrumSection>) =>
    setChart((c) => ({ ...c, sections: c.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const move = (i: number, d: number) =>
    setChart((c) => {
      const sections = [...c.sections]
      const [s] = sections.splice(i, 1)
      sections.splice(i + d, 0, s)
      return { ...c, sections }
    })

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveSong({ ...song, bpm, drums: { ...chart, sections: chart.sections.filter((s) => s.name.trim()) } }, song)
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex items-end gap-2">
          <label className="w-28">
            <span className="mb-1 block text-sm font-medium text-slate-700">BPM</span>
            <input
              className={inputClass}
              inputMode="numeric"
              value={bpm ?? ''}
              onChange={(e) => setBpm(Number(e.target.value.replace(/\D/g, '')) || undefined)}
            />
          </label>
          <button onClick={tap} className="flex-1 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent active:bg-accent active:text-white">
            Toca al ritmo (tap tempo)
          </button>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Feel</span>
          <div className="flex flex-wrap gap-1.5">
            {FEELS.map((f) => (
              <button
                key={f}
                onClick={() => setChart((c) => ({ ...c, feel: c.feel === f ? undefined : f }))}
                className={`rounded-full px-3 py-1 text-sm ${chart.feel === f ? 'bg-accent text-white' : 'bg-panel text-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            className={`${inputClass} mt-2`}
            placeholder="Otro feel…"
            value={chart.feel && !FEELS.includes(chart.feel) ? chart.feel : ''}
            onChange={(e) => setChart((c) => ({ ...c, feel: e.target.value || undefined }))}
          />
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Por sección</span>
          {chart.sections.map((s, i) => (
            <div key={i} className="rounded-2xl bg-panel p-3">
              <div className="flex items-center gap-1">
                <input className={`${inputClass} py-1.5 font-semibold`} value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 text-lg text-slate-500 disabled:opacity-25" aria-label="Subir">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} disabled={i === chart.sections.length - 1} className="px-2 text-lg text-slate-500 disabled:opacity-25" aria-label="Bajar">
                  ↓
                </button>
                <button
                  onClick={() => setChart((c) => ({ ...c, sections: c.sections.filter((_, j) => j !== i) }))}
                  className="px-2 text-lg text-red-600"
                  aria-label="Quitar sección"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {DRUM_PARTS.map(({ id, label }) => {
                  const on = s.parts.includes(id)
                  return (
                    <button
                      key={id}
                      onClick={() => setSection(i, { parts: on ? s.parts.filter((p) => p !== id) : [...s.parts, id] })}
                      className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${on ? 'bg-accent text-white' : 'bg-black/5 text-slate-600'}`}
                      aria-pressed={on}
                    >
                      <PartIcon part={id} size={22} />
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DYNAMICS.map(({ id, label }) => {
                  const on = s.dynamic === id
                  return (
                    <button
                      key={id}
                      onClick={() => setSection(i, { dynamic: on ? undefined : id })}
                      className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs ${on ? 'bg-accent text-white' : 'bg-black/5 text-slate-600'}`}
                      aria-pressed={on}
                    >
                      <DynamicIcon dynamic={id} size={18} />
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setRhythmFor(i)}
                  className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent active:brightness-95"
                >
                  {s.pattern ? '🥁 Editar ritmo' : '🥁 Crear ritmo'}
                </button>
                {s.pattern && <RhythmPlay id={`edit-${i}`} pattern={s.pattern} bpm={bpm} feel={chart.feel} label="Escuchar" />}
              </div>
              <input
                className={`${inputClass} mt-2 py-1.5 text-sm`}
                placeholder="Nota: p. ej. entrar en el 2.º compás, fill en toms"
                value={s.note ?? ''}
                onChange={(e) => setSection(i, { note: e.target.value || undefined })}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setChart((c) => ({ ...c, sections: [...c.sections, { name: '', parts: [] }] }))}>
              + Sección
            </Button>
            {!song.drums && (
              <Button variant="ghost" className="flex-1" onClick={() => setChart((c) => ({ ...chartFromSong(song.content), feel: c.feel }))}>
                Usar las de la canción
              </Button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Notas generales</span>
          <textarea
            className={inputClass}
            rows={2}
            value={chart.note ?? ''}
            onChange={(e) => setChart((c) => ({ ...c, note: e.target.value || undefined }))}
            placeholder="Ej.: entra el baterista después del primer coro"
          />
        </label>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
      {rhythmFor !== null && chart.sections[rhythmFor] && (
        <RhythmEditor
          title={`${song.title} · ${chart.sections[rhythmFor].name || 'Sección'}`}
          feel={chart.feel}
          bpm={bpm}
          initial={chart.sections[rhythmFor].pattern}
          onSave={(pattern) => {
            setSection(rhythmFor, { pattern })
            setRhythmFor(null)
          }}
          onClose={() => setRhythmFor(null)}
        />
      )}
      <div className="flex gap-2 border-t border-line px-5 py-3">
        <Button variant="ghost" onClick={onDone} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={save} disabled={busy} className="flex-1">
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </>
  )
}
