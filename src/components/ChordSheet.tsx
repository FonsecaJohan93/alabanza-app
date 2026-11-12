import { Fragment, useMemo } from 'react'
import { blocksOf, parseChordPro, transposeChord, type SheetLine } from '../lib/chordsheet'
import { CuePill } from './Cue'
import { drumsFor, type DrumChart } from '../lib/drums'
import { DynamicIcon, PartIcon } from './DrumIcons'

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
  drums,
  columns = false,
  drumIcons,
}: {
  content: string
  semitones?: number
  targetKey?: string
  showChords?: boolean
  fontSize?: number
  drums?: DrumChart
  /** En tablet horizontal, columnas que se pasan deslizando. */
  columns?: boolean
  /** Mostrar los iconos de batería en las secciones (por defecto, solo con acordes). */
  drumIcons?: boolean
}) {
  const lines = useMemo(() => parseChordPro(content), [content])
  const blocks = useMemo(() => blocksOf(lines), [lines])
  const t = (c: string) => transposeChord(c, semitones, targetKey)

  function renderLine(line: SheetLine, i: number) {
    switch (line.type) {
      case 'empty':
        return null
      case 'cue':
        return <CuePill key={i} text={line.text} />
      case 'section': {
        const d = (drumIcons ?? showChords) ? drumsFor(drums, line.name) : undefined
        return (
          <div key={i} className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">{line.name}</span>
            {d && (d.dynamic || d.parts.length > 0) && (
              <span className="flex items-center gap-1 rounded-full bg-black/5 px-1.5 py-0.5 text-slate-500" title={d.note}>
                {d.dynamic && (
                  <span className="text-accent">
                    <DynamicIcon dynamic={d.dynamic} size={16} />
                  </span>
                )}
                {d.parts.map((p) => (
                  <PartIcon key={p} part={p} size={16} />
                ))}
              </span>
            )}
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
              <span key={j}>{t(c)}</span>
            ))}
          </div>
        ) : null
      case 'lyrics': {
        const hasChords = showChords && line.parts.some((p) => p.chord)
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
                      <span className="c">{seg.chord ? t(seg.chord) : ''}</span>
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
    <div className={`sheet leading-snug ${showChords ? '' : 'no-chords'} ${columns ? 'pages' : ''}`} style={{ fontSize, ['--pages-top' as string]: '8.5rem' }}>
      {blocks.map((b) => {
        const rendered = b.lines.map(({ line, index }) => renderLine(line, index)).filter(Boolean)
        return rendered.length ? (
          <div key={b.start} className="mb-4 break-inside-avoid">
            {rendered}
          </div>
        ) : null
      })}
    </div>
  )
}
