import { Fragment, useMemo } from 'react'
import { parseChordPro, transposeChord } from '../lib/chordsheet'

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
}: {
  content: string
  semitones?: number
  targetKey?: string
  showChords?: boolean
  fontSize?: number
}) {
  const lines = useMemo(() => parseChordPro(content), [content])
  const t = (c: string) => transposeChord(c, semitones, targetKey)

  return (
    <div className={`sheet leading-snug ${showChords ? '' : 'no-chords'}`} style={{ fontSize }}>
      {lines.map((line, i) => {
        switch (line.type) {
          case 'empty':
            return <div key={i} className="h-3" />
          case 'section':
            return (
              <div key={i} className="mt-3 mb-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
                {line.name}
              </div>
            )
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
      })}
    </div>
  )
}
