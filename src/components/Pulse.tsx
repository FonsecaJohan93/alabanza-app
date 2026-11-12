import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { beatAt, beatsPerBar } from '../lib/pulse'

// Pulso visual (metrónomo sin sonido). El tiempo se calcula siempre desde el
// reloj del navegador (performance.now), no contando cuadros: así no se
// atrasa aunque el teléfono vaya lento o se salte cuadros.

function usePulse(bpm: number, running: boolean) {
  const [beat, setBeat] = useState(-1)
  useEffect(() => {
    if (!running || !bpm) {
      setBeat(-1)
      return
    }
    const start = performance.now()
    let last = -1
    let raf = 0
    const tick = () => {
      const b = beatAt(performance.now(), start, bpm)
      if (b !== last) {
        last = b
        setBeat(b)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bpm, running])
  return beat
}

/** Redoblante con la baqueta; la baqueta "pega" cada vez que cambia `hit`. */
function SnareHit({ hit, accent, ms }: { hit: number; accent: boolean; ms: number }) {
  return (
    <svg viewBox="0 0 64 48" width={56} height={42} aria-hidden="true" className="shrink-0 overflow-visible">
      {/* destello al golpear */}
      <circle
        key={'f' + hit}
        cx="30"
        cy="22"
        r="14"
        className="pulse-flash"
        fill={accent ? '#f59e0b' : '#a5b4fc'}
        style={{ animationDuration: `${ms}ms` }}
      />
      {/* redoblante */}
      <ellipse cx="32" cy="24" rx="22" ry="6" fill="#fff" stroke="#4c3fb8" strokeWidth="2.5" />
      <path d="M10 24v12c0 3.3 9.8 6 22 6s22-2.7 22-6V24" fill="#ece9fb" stroke="#4c3fb8" strokeWidth="2.5" />
      <path d="M17 29v10M32 30v11M47 29v10" stroke="#4c3fb8" strokeWidth="1.5" opacity=".5" />
      {/* baqueta: gira desde arriba y pega en el parche */}
      <g key={'s' + hit} className="pulse-stick" style={{ animationDuration: `${ms}ms` }}>
        <line x1="34" y1="22" x2="60" y2="2" stroke="#7c4a1e" strokeWidth="4" strokeLinecap="round" />
        <circle cx="34" cy="22" r="3" fill="#7c4a1e" />
      </g>
    </svg>
  )
}

/** Barra fija abajo con la baqueta y las luces de cada tiempo del compás. */
function PulseBar({ bpm, beats, onStop }: { bpm: number; beats: number; onStop: () => void }) {
  const beat = usePulse(bpm, true)
  const inBar = beat < 0 ? -1 : beat % beats
  const ms = Math.min(260, (60000 / bpm) * 0.8)
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-3 py-2 shadow-xl ring-1 ring-black/5 backdrop-blur" role="timer" aria-label={`Pulso a ${bpm} BPM`}>
        <SnareHit hit={beat} accent={inBar === 0} ms={ms} />
        <div className="flex items-center gap-2">
          {Array.from({ length: beats }, (_, i) => (
            <span
              key={i}
              className={`grid place-items-center rounded-full text-xs font-bold transition-colors duration-75 ${i === 0 ? 'h-7 w-7' : 'h-6 w-6'} ${
                i === inBar ? (i === 0 ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white') : 'bg-black/5 text-slate-400'
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <span className="text-sm font-semibold text-slate-600 tabular-nums">{bpm}</span>
        <button onClick={onStop} className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-slate-600 active:bg-black/10" aria-label="Detener pulso">
          ■
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Botón ♩ que enciende el pulso visual de la canción. */
export function PulseButton({ bpm, feel, className = '', autoStart = false }: { bpm?: number; feel?: string; className?: string; autoStart?: boolean }) {
  // Con "pulso al abrir una canción" arranca encendido
  const [on, setOn] = useState(autoStart)
  useEffect(() => {
    if (autoStart) setOn(true)
  }, [autoStart, bpm])
  const btn = useRef<HTMLButtonElement>(null)
  if (!bpm)
    return (
      <button
        disabled
        className={`rounded-xl px-2.5 py-2 text-sm text-slate-300 ${className}`}
        title="Falta el BPM: ponlo en el botón de batería"
        aria-label="Pulso (falta el BPM)"
      >
        ♩
      </button>
    )
  return (
    <>
      <button
        ref={btn}
        onClick={() => setOn(!on)}
        className={`rounded-xl px-2.5 py-2 text-sm font-semibold ${on ? 'bg-amber-400 text-amber-950' : 'bg-panel text-accent'} ${className}`}
        aria-pressed={on}
        title={`Pulso visual: ${bpm} BPM`}
      >
        ♩ {bpm}
      </button>
      {on && <PulseBar bpm={bpm} beats={beatsPerBar(feel)} onStop={() => setOn(false)} />}
    </>
  )
}

/** Tempo grande para la pantalla de batería: el BPM y los tiempos 1 2 3 4 iluminándose. */
export function BigPulse({ bpm, feel, autoStart = false }: { bpm?: number; feel?: string; autoStart?: boolean }) {
  const [on, setOn] = useState(autoStart)
  useEffect(() => {
    if (autoStart) setOn(true)
  }, [autoStart, bpm])
  const beats = beatsPerBar(feel)
  const beat = usePulse(bpm ?? 0, on && !!bpm)
  const inBar = beat < 0 ? -1 : beat % beats
  return (
    <section className="flex items-center gap-4 rounded-2xl bg-panel p-4" aria-label="Tempo">
      <button
        onClick={() => bpm && setOn(!on)}
        disabled={!bpm}
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl ${on ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white'} disabled:opacity-40`}
        aria-label={on ? 'Detener pulso' : 'Iniciar pulso'}
      >
        {on ? '■' : '▶'}
      </button>
      <div className="shrink-0 leading-none">
        <div className="text-5xl font-black tabular-nums">{bpm ?? '—'}</div>
        <div className="mt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">{bpm ? 'BPM' : 'Sin BPM'}</div>
      </div>
      <div className="flex flex-1 flex-wrap justify-end gap-2">
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={`grid h-12 w-12 place-items-center rounded-full text-2xl font-black transition-colors duration-75 md:h-16 md:w-16 md:text-3xl ${
              i === inBar ? (i === 0 ? 'bg-amber-400 text-amber-950' : 'bg-accent text-white') : 'bg-black/5 text-slate-400'
            }`}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </section>
  )
}
