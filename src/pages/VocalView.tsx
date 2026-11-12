import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { blocksOf, parseChordPro, type SheetBlock } from '../lib/chordsheet'
import { useMe, useSong, useStore } from '../lib/store'
import { CuePill } from '../components/Cue'
import { Header } from '../components/ui'
import { PulseButton } from '../components/Pulse'

function usePref(key: string, initial: number): [number, (v: number) => void] {
  const [v, setV] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) || initial
    } catch {
      return initial
    }
  })
  return [
    v,
    (n: number) => {
      setV(n)
      try {
        localStorage.setItem(key, String(n))
      } catch {
        /* nada */
      }
    },
  ]
}

/** Mantiene la pantalla encendida mientras se canta (si el navegador lo permite). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const get = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    void get()
    const onVis = () => document.visibilityState === 'visible' && void get()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => {})
    }
  }, [])
}

const lyricText = (b: SheetBlock) =>
  b.lines.filter((l) => l.line.type === 'lyrics').map((l) => (l.line.type === 'lyrics' ? l.line.parts.map((p) => p.text).join('').trim() : ''))

/** Solo la letra, grande, con los indicadores del equipo entre párrafos. */
export default function VocalView() {
  const { id } = useParams()
  const song = useSong(id)
  const { prefs } = useMe()
  const loaded = useStore((s) => s.loaded)
  const [fontSize, setFontSize] = usePref('alabanza:vocalFont', 26)
  useWakeLock()

  const blocks = useMemo(() => blocksOf(parseChordPro(song?.content ?? '')), [song?.content])

  if (!song)
    return (
      <div>
        <Header title="Voces" back="/" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  return (
    <div className="min-h-dvh bg-white pb-16">
      <Header
        title={song.title}
        back={`/cancion/${song.id}`}
        actions={
          <>
            <PulseButton bpm={song.bpm} feel={song.drums?.feel} autoStart={prefs.autoPulse} className="py-1.5" />
            <div className="flex rounded-xl bg-panel text-sm">
              <button onClick={() => setFontSize(Math.max(18, fontSize - 3))} className="px-2 py-1.5" aria-label="Letra más pequeña">
                A−
              </button>
              <button onClick={() => setFontSize(Math.min(56, fontSize + 3))} className="px-2 py-1.5 font-semibold" aria-label="Letra más grande">
                A+
              </button>
            </div>
            <Link to={`/cancion/${song.id}/estructura`} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft">
              Editar
            </Link>
          </>
        }
      />

      <div className="pages px-5 pt-4 leading-snug" style={{ fontSize, ['--pages-top' as string]: '4.5rem' }}>
        {blocks.map((b) => {
          const first = b.lines[0]?.line
          const section = first?.type === 'section' ? first.name : undefined
          const words = lyricText(b)
          let body: React.ReactNode
          if (first?.type === 'cue') {
            body = <CuePill text={first.text} size="lg" />
          } else if (!words.length) {
            // Sección sin letra (intro, solo…): se marca como instrumental
            if (!section) return null
            body = <p className="text-[0.6em] font-semibold tracking-wide text-slate-400 uppercase">♪ {section} · instrumental</p>
          } else {
            body = (
              <>
                {section && <p className="mb-1 text-[0.5em] font-bold tracking-wider text-accent uppercase">{section}</p>}
                {words.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </>
            )
          }
          return (
            <div key={b.start} className="mb-[0.8em] break-inside-avoid">
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
