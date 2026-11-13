import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DRUM_PARTS } from '../lib/drums'
import { countLabels, gridFor, hasHit, METERS, presets, toggleHit, type Meter, type Pattern } from '../lib/rhythm'
import type { RhythmDraft } from '../lib/api'
import { playRhythm, setClickOn, stopRhythm, useClickOn, usePlaying } from '../lib/drumAudio'
import { PartIcon } from './DrumIcons'
import { Button } from './ui'

/**
 * Cuadrícula tipo partitura de batería: filas = piezas, columnas = el compás
 * contado ("1 e y a 2…"). Se tocan las casillas y suena en bucle; el BPM se
 * puede mover mientras suena para practicar.
 */
export function RhythmEditor({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Partial<RhythmDraft>
  onSave: (draft: RhythmDraft) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [meter, setMeter] = useState<Meter>(initial?.meter ?? '4/4')
  const [bpm, setBpm] = useState(initial?.bpm ?? 80)
  const { beats, sub, steps } = gridFor(meter)
  const [pattern, setPattern] = useState<Pattern>(() => initial?.pattern ?? { steps, hits: {} })
  const ref = useRef(pattern)
  ref.current = pattern
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const playing = usePlaying()
  const isPlaying = playing?.id === 'editor'
  const labels = countLabels(beats, sub)
  const empty = !Object.keys(pattern.hits).length

  const changeMeter = (m: Meter) => {
    if (m === meter) return
    if (!empty && !confirm('Al cambiar el compás se borra la cuadrícula. ¿Seguir?')) return
    stopRhythm()
    setMeter(m)
    setPattern({ steps: gridFor(m).steps, hits: {} })
  }
  const close = () => {
    stopRhythm()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label="Ritmo" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <p className="min-w-0 flex-1 truncate font-semibold">{initial?.name ? `Editar: ${initial.name}` : 'Nuevo ritmo'}</p>
        <button onClick={close} className="rounded-full p-2 text-slate-500 active:bg-black/5" aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3 md:landscape:mx-auto md:landscape:w-full md:landscape:max-w-3xl">
        <label className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Balada suave, Coro fuerte, 6/8 lento…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base outline-none focus:border-accent"
          />
        </label>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
            {METERS.map((m) => (
              <button key={m} onClick={() => changeMeter(m)} className={`rounded-lg px-3 py-1 ${meter === m ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-xl bg-panel">
            <button onClick={() => setBpm(Math.max(40, bpm - 1))} className="px-3 py-1.5 text-lg" aria-label="Menos BPM">
              −
            </button>
            <span className="min-w-14 text-center font-bold tabular-nums">{bpm}</span>
            <button onClick={() => setBpm(Math.min(240, bpm + 1))} className="px-3 py-1.5 text-lg" aria-label="Más BPM">
              +
            </button>
            <span className="pr-3 text-xs text-slate-500">BPM</span>
          </div>
        </div>
        <input type="range" min={40} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mb-3 w-full accent-[var(--color-accent)]" aria-label="BPM" />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => (isPlaying ? stopRhythm() : void playRhythm('editor', () => ref.current, () => bpmRef.current, sub))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${isPlaying ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white'}`}
          >
            {isPlaying ? '■ Detener' : '▶ Escuchar'}
          </button>
          <ClickToggle />
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-slate-500">Empezar con:</span>
          {presets(steps).map((p) => (
            <button key={p.name} onClick={() => setPattern(p.pattern)} className="rounded-full bg-panel px-3 py-1 text-sm active:bg-black/5">
              {p.name}
            </button>
          ))}
          <button onClick={() => setPattern({ steps, hits: {} })} className="rounded-full px-3 py-1 text-sm text-slate-500 underline">
            Vaciar
          </button>
        </div>

        {/* Cuadrícula */}
        <div className="overflow-x-auto rounded-2xl bg-panel p-1.5 sm:p-2">
          <table className="border-separate" style={{ borderSpacing: '1px' }}>
            <thead>
              <tr>
                <th />
                {labels.map((l, i) => (
                  <th key={i} className={`w-[18px] min-w-[18px] text-center text-[10px] sm:w-7 sm:min-w-7 sm:text-[11px] ${i % sub === 0 ? 'font-bold text-slate-700' : 'font-normal text-slate-400'}`}>
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DRUM_PARTS.map(({ id, label }) => (
                <tr key={id}>
                  <th className="pr-1 text-left">
                    <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap text-slate-600" title={label}>
                      <span className="text-accent">
                        <PartIcon part={id} size={18} />
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  </th>
                  {Array.from({ length: steps }, (_, step) => {
                    const on = hasHit(pattern, id, step)
                    const now = isPlaying && playing?.step === step
                    return (
                      <td key={step} className="p-0">
                        <button
                          onClick={() => setPattern((p) => toggleHit(p, id, step))}
                          className={`block h-8 w-[18px] rounded-[5px] transition-colors sm:h-7 sm:w-7 sm:rounded-md ${
                            on ? (now ? 'bg-amber-400' : 'bg-accent') : now ? 'bg-amber-100' : step % sub === 0 ? 'bg-black/[0.08]' : 'bg-black/[0.04]'
                          } ${step % sub === 0 && step ? 'ml-0.5 sm:ml-1' : ''}`}
                          aria-label={`${label}, tiempo ${labels[step] || step + 1}`}
                          aria-pressed={on}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Toca una casilla para poner o quitar un golpe; el BPM se puede mover mientras suena. En una canción, el ritmo suena al BPM de la canción. En iPhone, quita el modo silencio.
        </p>
      </div>

      <div className="flex gap-2 border-t border-line px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        {onDelete && (
          <Button variant="danger" onClick={() => confirm(`¿Eliminar "${name || 'este ritmo'}" de la biblioteca?`) && (stopRhythm(), void onDelete())}>
            Eliminar
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button
          disabled={empty}
          onClick={() => {
            stopRhythm()
            void onSave({ name: name.trim() || 'Ritmo', meter, bpm, pattern })
          }}
        >
          Guardar ritmo
        </Button>
      </div>
    </div>,
    document.body,
  )
}

/** Botón ▶ para escuchar un ritmo (en una canción, al BPM de la canción). */
export function RhythmPlay({ id, pattern, bpm, meter, label = 'Ritmo' }: { id: string; pattern: Pattern; bpm?: number; meter?: Meter; label?: string }) {
  const playing = usePlaying()
  const on = playing?.id === id
  const ref = useRef(pattern)
  ref.current = pattern
  const { sub } = gridFor(meter)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        if (on) stopRhythm()
        else void playRhythm(id, () => ref.current, bpm || 80, sub)
      }}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white'}`}
      aria-label={on ? `Detener ${label}` : `Escuchar ${label}`}
    >
      {on ? '■' : '▶'} {label}
    </button>
  )
}

/** 🔔 Campana del metrónomo: encendida suma el clic; apagada, batería pura. */
export function ClickToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const on = useClickOn()
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setClickOn(!on)
      }}
      className={`rounded-xl ${compact ? 'grid h-9 w-9 place-items-center' : 'px-3 py-2'} text-sm font-semibold ${on ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'bg-panel text-slate-500'} ${className}`}
      aria-pressed={on}
      aria-label={on ? 'Sonido del metrónomo encendido' : 'Sonido del metrónomo apagado'}
      title={on ? 'Se oye la campana del metrónomo' : 'Sin sonido (solo luces)'}
    >
      {compact ? <span className={on ? '' : 'opacity-40 grayscale'}>🔔</span> : `🔔 ${on ? 'Campana' : 'Sin campana'}`}
    </button>
  )
}
