import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cleanDrums, drumsFor, DYNAMICS, sectionKey, type DrumChart, type Dynamic } from '../lib/drums'
import type { Show } from '../lib/show'
import { usePersonal, useRhythms } from '../lib/store'
import type { Song } from '../types'
import { ChordSheet } from './ChordSheet'
import { DynamicIcon } from './DrumIcons'
import { BigPulse } from './Pulse'
import { RhythmPlay } from './RhythmEditor'

const dynLabel = (d: Dynamic) => DYNAMICS.find((x) => x.id === d)?.label ?? d
/** Clave de una sección para guardar mi ritmo: "Coro 2" y "CORO" → "coro". */
export const rhythmKey = (name: string) => sectionKey(name.replace(/\s*\d+$/, ''))

/**
 * El ritmo que suena en cada sección: el que yo elegí, o si no elegí, el que
 * propone Dirección. "none" = elegí no tener ritmo.
 */
export function useSectionRhythms(song: Song, chart: DrumChart) {
  const library = useRhythms()
  const mine = usePersonal(song.id)
  const find = (id?: string) => (id ? library.find((r) => r.id === id) : undefined)
  return (sectionName: string) => {
    const own = mine.rhythms?.[rhythmKey(sectionName)]
    const sec = drumsFor(chart, sectionName)
    const proposed = find(sec?.proposed)
    const rhythm = own === 'none' ? undefined : own ? find(own) : proposed
    return { rhythm, proposed, proposedBy: sec?.proposedBy, fromProposal: !own && !!proposed }
  }
}

/**
 * Lo que se ve de una canción según los interruptores de "Ver": tempo grande,
 * batería por sección, acordes, letra e indicaciones. Lo usan la canción y la tarima.
 */
export function SongBody({
  song,
  show,
  semitones,
  targetKey,
  fontSize,
  pagesTop,
  autoPulse,
  onChord,
  canEditDrums = false,
}: {
  song: Song
  show: Show
  semitones: number
  targetKey?: string
  fontSize: number
  /** Alto de lo que hay arriba (para las columnas en tablet horizontal). */
  pagesTop: string
  autoPulse?: boolean
  onChord?: (chord: string) => void
  canEditDrums?: boolean
}) {
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  const rhythmsFor = useSectionRhythms(song, chart)

  const sectionExtra = show.drums
    ? (name: string) => {
        const d = drumsFor(chart, name)
        const info = rhythmsFor(name)
        const r = info.rhythm
        if (!d?.dynamic && !r && !info.proposed) return null
        return (
          <>
            {d?.dynamic && (
              <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent normal-case">
                <DynamicIcon dynamic={d.dynamic} size={15} />
                {dynLabel(d.dynamic)}
              </span>
            )}
            {r && (
              <span className="text-xs">
                <RhythmPlay id={`sec-${song.id}-${rhythmKey(name)}`} pattern={r.pattern} bpm={song.bpm ?? r.bpm} meter={r.meter} label={r.name} />
              </span>
            )}
            {info.proposed && (
              <span className="text-[11px] text-slate-500">
                {info.fromProposal
                  ? `propuesto por ${info.proposedBy ?? 'dirección'}`
                  : info.proposed.id !== r?.id
                    ? `${info.proposedBy ?? 'Dirección'} propone: ${info.proposed.name}`
                    : ''}
              </span>
            )}
          </>
        )
      }
    : undefined

  // Con el tempo grande arriba, las columnas de la tablet son más bajas
  const top = show.tempo ? `calc(${pagesTop} + 7.5rem)` : pagesTop

  return (
    <>
      {show.tempo && (
        <div className="mb-3">
          <BigPulse bpm={song.bpm} feel={chart.feel} autoStart={autoPulse} />
        </div>
      )}
      {(show.tempo || show.drums) && (chart.feel || chart.note || canEditDrums) && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-slate-600">
          {chart.feel && <span>Feel: {chart.feel}</span>}
          {chart.note && <span className="whitespace-pre-wrap text-amber-900">{chart.note}</span>}
          {canEditDrums && (
            <Link to={`/cancion/${song.id}/bateria`} className="font-semibold text-accent">
              Editar batería →
            </Link>
          )}
        </div>
      )}
      {!show.chords && !show.lyrics ? (
        <p className="rounded-xl bg-panel p-4 text-sm text-slate-500">Apagaste los acordes y la letra. Préndelos en “Ver”.</p>
      ) : song.content.trim() ? (
        <ChordSheet
          content={song.content}
          semitones={semitones}
          targetKey={targetKey}
          showChords={show.chords}
          showLyrics={show.lyrics}
          showCues={show.cues}
          sectionExtra={sectionExtra}
          fontSize={fontSize}
          columns
          pagesTop={top}
          onChord={show.chords ? onChord : undefined}
        />
      ) : (
        <p className="text-slate-500">Esta canción todavía no tiene letra ni acordes.</p>
      )}
    </>
  )
}
