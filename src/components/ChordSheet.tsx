import { Fragment, useMemo, type ReactNode } from 'react'
import { blocksOf, parseChordPro, transposeChord, type SheetLine } from '../lib/chordsheet'
import { CuePill } from './Cue'

type Seg = { chord?: string; text: string }

/**
 * Parte la línea en palabras (null = espacio). Una palabra puede tener varios
 * acordes ("renuev[G]ame"), por eso cada palabra es una lista de segmentos que
 * nunca se separa al cambiar de renglón.
 */
function wordGroups(parts: Seg[]): (Seg[] | null)[] {
  const out: (Seg[] | null)[] = []
  let group: Seg[] = []
  const flush = () => {
    if (group.length) out.push(group)
    group = []
  }
  for (const part of parts) {
    part.text.split(/(\s+)/).forEach((piece, k) => {
      const chord = k === 0 ? part.chord : undefined
      if (/^\s+$/.test(piece)) {
        flush()
        out.push(null)
      } else if (piece || chord) {
        group.push({ chord, text: piece })
        // Un acorde sobre un espacio queda como palabra propia
        if (!piece) flush()
      }
    })
  }
  flush()
  return out
}

/**
 * Muestra la hoja con los acordes encima de la letra. Cada palabra es un
 * bloque con su acorde arriba, así en el teléfono la línea se parte por
 * palabras sin que los acordes se desalineen.
 */
export function ChordSheet({
  content,
  semitones = 0,
  targetKey,
  showChords = true,
  fontSize = 17,
  showLyrics = true,
  showCues = true,
  sectionExtra,
  columns = false,
  onChord,
  pagesTop = '8.5rem',
}: {
  content: string
  semitones?: number
  targetKey?: string
  showChords?: boolean
  fontSize?: number
  /** Sin letra: quedan solo los acordes de cada sección. */
  showLyrics?: boolean
  /** Indicaciones del equipo ("coro 2 veces"…). */
  showCues?: boolean
  /** Algo junto al nombre de cada sección (la batería: matiz y ▶ del ritmo). */
  sectionExtra?: (sectionName: string) => ReactNode
  /** En tablet horizontal, columnas que se pasan deslizando. */
  columns?: boolean
  /** Tocar un acorde (ya transpuesto) para ver cómo se pone. */
  onChord?: (chord: string) => void
  /** Alto de lo que va arriba de la hoja (para que las columnas quepan en pantalla). */
  pagesTop?: string
}) {
  const lines = useMemo(() => parseChordPro(content), [content])
  const blocks = useMemo(() => blocksOf(lines), [lines])
  const t = (c: string) => transposeChord(c, semitones, targetKey)

  function renderLine(line: SheetLine, i: number) {
    switch (line.type) {
      case 'empty':
        return null
      case 'cue':
        return showCues ? <CuePill key={i} text={line.text} /> : null
      case 'section': {
        const extra = sectionExtra?.(line.name)
        return (
          <div key={i} className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[max(0.75rem,0.45em)] font-bold tracking-wider text-slate-500 uppercase">{line.name}</span>
            {extra}
          </div>
        )
      }
      case 'tab':
        return showChords ? (
          <pre key={i} className="overflow-x-auto font-mono text-[0.8em] text-slate-600">
            {line.text}
          </pre>
        ) : null
      case 'chords':
        return showChords ? (
          <div key={i} className="flex flex-wrap gap-x-4 font-bold text-accent">
            {line.chords.map((c, j) => (
              <span key={j} data-chord={t(c)}>
                {t(c)}
              </span>
            ))}
          </div>
        ) : null
      case 'lyrics': {
        const hasChords = showChords && line.parts.some((p) => p.chord)
        // Sin letra: solo los acordes de la línea, en fila
        if (!showLyrics)
          return hasChords ? (
            <div key={i} className="flex flex-wrap gap-x-4 font-bold text-accent">
              {line.parts
                .filter((p) => p.chord)
                .map((p, j) => (
                  <span key={j} data-chord={t(p.chord!)}>
                    {t(p.chord!)}
                  </span>
                ))}
            </div>
          ) : null
        if (!hasChords) return <div key={i}>{line.parts.map((p) => p.text).join('')}</div>
        return (
          <div key={i} className="mt-1">
            {wordGroups(line.parts).map((g, j) =>
              g === null ? (
                <Fragment key={j}> </Fragment>
              ) : (
                <span key={j} className="whitespace-nowrap">
                  {g.map((seg, k) => (
                    <span key={k} className="w">
                      <span className="c" data-chord={seg.chord ? t(seg.chord) : undefined}>
                        {seg.chord ? t(seg.chord) : ''}
                      </span>
                      <span>{seg.text || (seg.chord ? ' ' : '')}</span>
                    </span>
                  ))}
                </span>
              ),
            )}
          </div>
        )
      }
    }
  }

  // Cada estrofa es un bloque que no se parte: en tablet horizontal la hoja va a dos columnas
  return (
    <div
      className={`sheet leading-snug ${showChords ? '' : 'no-chords'} ${columns ? 'pages' : ''} ${onChord ? 'tappable' : ''}`}
      style={{ fontSize, ['--pages-top' as string]: pagesTop }}
      onClick={
        onChord &&
        ((e) => {
          const c = (e.target as HTMLElement).closest<HTMLElement>('[data-chord]')?.dataset.chord
          if (c) onChord(c)
        })
      }
    >
      {blocks.map((b) => {
        const rendered = b.lines.map(({ line, index }) => renderLine(line, index)).filter(Boolean)
        // Sección sin letra (intro, solo…) cuando no se ven acordes: se marca como instrumental
        const hasWords = b.lines.some(({ line }) => line.type === 'lyrics' && line.parts.some((p) => p.text.trim()))
        if (!showChords && showLyrics && !hasWords && b.lines[0]?.line.type === 'section')
          rendered.push(
            <p key="inst" className="text-[0.7em] font-semibold tracking-wide text-slate-400">
              ♪ Instrumental
            </p>,
          )
        return rendered.length ? (
          <div key={b.start} className="mb-4 break-inside-avoid">
            {rendered}
          </div>
        ) : null
      })}
    </div>
  )
}
