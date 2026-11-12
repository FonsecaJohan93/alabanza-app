import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { blocksOf, insertCue, parseChordPro, removeLine, type SheetBlock } from '../lib/chordsheet'
import { saveSong, useSong, useStore } from '../lib/store'
import { CUE_PRESETS, CuePill } from '../components/Cue'
import { ErrorBox, Header } from '../components/ui'

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
  const loaded = useStore((s) => s.loaded)
  const [fontSize, setFontSize] = usePref('alabanza:vocalFont', 26)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useWakeLock()

  const blocks = useMemo(() => blocksOf(parseChordPro(song?.content ?? '')), [song?.content])

  if (!song)
    return (
      <div>
        <Header title="Voces" back="/" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )

  async function change(content: string) {
    if (!song) return
    setBusy(true)
    setError(null)
    try {
      await saveSong({ ...song, content }, song)
      setAdding(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const lineCount = song.content.split('\n').length

  /** Lugar para poner un indicador (solo en modo edición). */
  const slot = (at: number) =>
    !editing ? null : adding === at ? (
      <CueChooser key={'c' + at} busy={busy} onPick={(text) => change(insertCue(song.content, at, text))} onCancel={() => setAdding(null)} />
    ) : (
      <button
        key={'s' + at}
        onClick={() => setAdding(at)}
        className="my-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-amber-300 px-3 py-1 text-left text-sm text-amber-700 active:bg-amber-50"
      >
        + Indicador aquí
      </button>
    )

  return (
    <div className="min-h-dvh bg-white pb-16">
      <Header
        title={song.title}
        back={`/cancion/${song.id}`}
        actions={
          <>
            <div className="flex rounded-xl bg-panel text-sm">
              <button onClick={() => setFontSize(Math.max(18, fontSize - 3))} className="px-2 py-1.5" aria-label="Letra más pequeña">
                A−
              </button>
              <button onClick={() => setFontSize(Math.min(56, fontSize + 3))} className="px-2 py-1.5 font-semibold" aria-label="Letra más grande">
                A+
              </button>
            </div>
            <button
              onClick={() => (setEditing(!editing), setAdding(null))}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${editing ? 'bg-amber-400 text-amber-950' : 'text-accent active:bg-accent-soft'}`}
            >
              {editing ? 'Listo' : 'Editar orden'}
            </button>
          </>
        }
      />
      {editing && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Toca “+ Indicador aquí” entre párrafos. Lo ve todo el equipo, también en la hoja de acordes.
        </p>
      )}
      {error && (
        <div className="px-4 pt-3">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      <div className="pages px-5 pt-4 leading-snug" style={{ fontSize, ['--pages-top' as string]: editing ? '7.5rem' : '4.5rem' }}>
        {blocks.map((b) => {
          const first = b.lines[0]?.line
          const section = first?.type === 'section' ? first.name : undefined
          const words = lyricText(b)
          let body: React.ReactNode
          if (first?.type === 'cue') {
            body = <CuePill text={first.text} size="lg" onRemove={editing ? () => change(removeLine(song.content, b.start)) : undefined} />
          } else if (!words.length) {
            // Sección sin letra (intro, solo…): se marca como instrumental
            if (!section) return <div key={b.start}>{slot(b.start)}</div>
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
            <div key={b.start} className="break-inside-avoid">
              {slot(b.start)}
              <div className="mb-[0.8em]">{body}</div>
            </div>
          )
        })}
        {slot(lineCount)}
      </div>
    </div>
  )
}

function CueChooser({ busy, onPick, onCancel }: { busy: boolean; onPick: (t: string) => void; onCancel: () => void }) {
  const [custom, setCustom] = useState('')
  return (
    <div className="my-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-base" style={{ fontSize: 15 }}>
      <div className="flex flex-wrap gap-1.5">
        {CUE_PRESETS.map((p) => (
          <button key={p} disabled={busy} onClick={() => onPick(p)} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-900 shadow-sm active:bg-amber-100">
            {p}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) onPick(custom.trim())
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Otro: p. ej. Coro x3, sube de tono…"
          className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-400"
        />
        <button type="submit" disabled={busy || !custom.trim()} className="rounded-lg bg-amber-400 px-3 text-sm font-semibold text-amber-950 disabled:opacity-40">
          Poner
        </button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-amber-800">
          Cancelar
        </button>
      </form>
    </div>
  )
}
