import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DRUM_PARTS } from '../lib/drums'
import { countLabels, gridFor, hasHit, presets, toggleHit, type Pattern } from '../lib/rhythm'
import { playRhythm, stopRhythm, usePlaying } from '../lib/drumAudio'
import { PartIcon } from './DrumIcons'
import { Button } from './ui'

/**
 * Cuadrícula tipo partitura de batería: filas = piezas, columnas = el compás
 * contado ("1 e y a 2…"). Se tocan las casillas y suena en bucle al BPM.
 */
export function RhythmEditor({
  title,
  feel,
  bpm,
  initial,
  onSave,
  onClose,
}: {
  title: string
  feel?: string
  bpm?: number
  initial?: Pattern
  onSave: (p: Pattern | undefined) => void
  onClose: () => void
}) {
  const { beats, sub, steps } = gridFor(feel)
  const [pattern, setPattern] = useState<Pattern>(() => (initial && initial.steps === steps ? initial : { steps, hits: {} }))
  const ref = useRef(pattern)
  ref.current = pattern
  const playing = usePlaying()
  const isPlaying = playing?.id === 'editor'
  const tempo = bpm || 80
  const labels = countLabels(beats, sub)

  const close = () => {
    stopRhythm()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={`Ritmo: ${title}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Ritmo · {feel || '4/4'}</p>
          <p className="truncate font-semibold">{title}</p>
        </div>
        <button onClick={close} className="rounded-full p-2 text-slate-500 active:bg-black/5" aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => (isPlaying ? stopRhythm() : void playRhythm('editor', () => ref.current, tempo, sub))}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${isPlaying ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white'}`}
          >
            {isPlaying ? '■ Detener' : '▶ Escuchar'}
          </button>
          <span className="text-sm text-slate-500">
            {tempo} BPM{!bpm && ' (la canción aún no tiene BPM)'}
          </span>
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
        <p className="mt-2 text-xs text-slate-500">Toca una casilla para poner o quitar un golpe. Se escucha sin reiniciar. En iPhone, quita el modo silencio para oírlo.</p>
      </div>

      <div className="flex gap-2 border-t border-line px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        {initial && (
          <Button variant="danger" onClick={() => (stopRhythm(), onSave(undefined))}>
            Quitar ritmo
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            stopRhythm()
            onSave(Object.keys(pattern.hits).length ? pattern : undefined)
          }}
        >
          Usar este ritmo
        </Button>
      </div>
    </div>,
    document.body,
  )
}

/** Botón ▶ para escuchar el ritmo de una sección. */
export function RhythmPlay({ id, pattern, bpm, feel, label = 'Ritmo' }: { id: string; pattern: Pattern; bpm?: number; feel?: string; label?: string }) {
  const playing = usePlaying()
  const on = playing?.id === id
  const ref = useRef(pattern)
  ref.current = pattern
  const { sub } = gridFor(feel)
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
