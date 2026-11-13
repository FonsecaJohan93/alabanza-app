import { useEffect, useMemo, useRef, useState } from 'react'
import { transposeChord } from '../lib/chordsheet'
import { chordNotes, guitarVoicings, stringNotes, type Voicing } from '../lib/guitar'

const STRINGS = ['E', 'A', 'D', 'G', 'B', 'e']

/** Diagrama de un acorde en el mástil: cuerdas verticales, la 6.ª a la izquierda. */
export function GuitarDiagram({ v, className = '' }: { v: Voicing; className?: string }) {
  const fretted = v.frets.filter((f) => f > 0)
  const maxF = fretted.length ? Math.max(...fretted) : 0
  const minF = fretted.length ? Math.min(...fretted) : 0
  const base = maxF <= 4 ? 1 : minF
  const x = (s: number) => 34 + s * 20
  const y0 = 40
  const fh = 28
  const yOf = (f: number) => y0 + (f - base + 0.5) * fh
  const notes = stringNotes(v)
  return (
    <svg viewBox="0 0 160 212" className={className} role="img" aria-label={`Trastes ${v.frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`}>
      {base > 1 && (
        <text x={2} y={y0 + fh * 0.5 + 5} className="fill-slate-500 text-[13px] font-semibold">
          {base}
        </text>
      )}
      {/* trastes */}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={x(0)} x2={x(5)} y1={y0 + i * fh} y2={y0 + i * fh} className="stroke-slate-300" strokeWidth={i === 0 && base === 1 ? 5 : 1.5} />
      ))}
      {/* cuerdas */}
      {STRINGS.map((_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={y0} y2={y0 + 5 * fh} className="stroke-slate-400" strokeWidth={1.2 + (5 - s) * 0.25} />
      ))}
      {/* al aire / no se toca */}
      {v.frets.map((f, s) =>
        f < 0 ? (
          <text key={s} x={x(s)} y={28} textAnchor="middle" className="fill-slate-400 text-[14px] font-semibold">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={s} cx={x(s)} cy={23} r={5.5} fill="none" className="stroke-slate-500" strokeWidth={1.6} />
        ) : null,
      )}
      {v.barre && (
        <rect x={x(v.barre.from) - 9} y={yOf(v.barre.fret) - 9} width={x(v.barre.to) - x(v.barre.from) + 18} height={18} rx={9} className="fill-accent" />
      )}
      {v.frets.map((f, s) =>
        f > 0 && !(v.barre && f === v.barre.fret) ? (
          <g key={s}>
            <circle cx={x(s)} cy={yOf(f)} r={9} className="fill-accent" />
            {v.fingers[s] > 0 && (
              <text x={x(s)} y={yOf(f) + 4.5} textAnchor="middle" className="fill-white text-[12px] font-bold">
                {v.fingers[s]}
              </text>
            )}
          </g>
        ) : null,
      )}
      {v.barre && (
        <text x={x(v.barre.from)} y={yOf(v.barre.fret) + 4.5} textAnchor="middle" className="fill-white text-[12px] font-bold">
          1
        </text>
      )}
      {/* nota que suena en cada cuerda */}
      {notes.map((n, s) => (
        <text key={s} x={x(s)} y={y0 + 5 * fh + 22} textAnchor="middle" className="fill-slate-600 text-[11px] font-semibold">
          {n ?? ''}
        </text>
      ))}
      {STRINGS.map((n, s) => (
        <text key={s} x={x(s)} y={y0 + 5 * fh + 38} textAnchor="middle" className="fill-slate-400 text-[9px]">
          {n}
        </text>
      ))}
    </svg>
  )
}

/** Panel que sube desde abajo con el acorde tocado y los demás de la canción. */
export function ChordPanel({ chords, initial, capo, onClose }: { chords: string[]; initial: string; capo: number; onClose: () => void }) {
  const [chord, setChord] = useState(initial)
  const [pos, setPos] = useState(0)
  const voicings = useMemo(() => guitarVoicings(chord), [chord])
  const v = voicings[Math.min(pos, voicings.length - 1)]
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      const i = chords.indexOf(chord)
      if (e.key === 'ArrowRight' && i < chords.length - 1) pick(chords[i + 1])
      if (e.key === 'ArrowLeft' && i > 0) pick(chords[i - 1])
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })

  useEffect(() => {
    strip.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [chord])

  function pick(c: string) {
    setChord(c)
    setPos(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Acorde ${chord}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-ink shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Guitarra</p>
            <p className="text-3xl font-bold text-accent">{chord}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 active:bg-black/5" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {chords.length > 1 && (
          <div ref={strip} className="flex gap-1.5 overflow-x-auto px-5 pt-3 pb-1">
            {chords.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                aria-pressed={c === chord}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${c === chord ? 'bg-accent text-white' : 'bg-panel text-accent'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto px-5 pt-2 pb-4">
          {v ? (
            <>
              <GuitarDiagram v={v} className="mx-auto block h-64 w-auto" />
              {voicings.length > 1 && (
                <div className="mt-1 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPos((p) => (p - 1 + voicings.length) % voicings.length)}
                    className="h-9 w-9 rounded-full bg-panel text-lg"
                    aria-label="Posición anterior"
                  >
                    ‹
                  </button>
                  <span className="text-sm text-slate-600">
                    Posición {pos + 1} de {voicings.length}
                  </span>
                  <button onClick={() => setPos((p) => (p + 1) % voicings.length)} className="h-9 w-9 rounded-full bg-panel text-lg" aria-label="Otra posición">
                    ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="py-10 text-center text-slate-500">No encontré cómo poner «{chord}» en la guitarra.</p>
          )}
          <p className="mt-3 text-center text-sm text-slate-600">
            Notas: <b>{chordNotes(chord).join(' · ') || '—'}</b>
          </p>
          {capo > 0 && (
            <p className="mt-1 text-center text-xs text-slate-500">
              Con capo {capo}: la forma es {chord}, suena {transposeChord(chord, capo)}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
