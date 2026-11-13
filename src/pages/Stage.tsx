import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { capoSuggestion, guessKey, keyView, sharpKey, transposeKey } from '../lib/chordsheet'
import { upcomingSunday, useService } from '../lib/service'
import { formatClock, newClock, pause, readClock, resume, tick, type StageClock } from '../lib/stageClock'
import { useMe, usePersonal, useSongs } from '../lib/store'
import type { ServiceItem, Song } from '../types'
import { ChordSheet } from '../components/ChordSheet'
import { PulseButton } from '../components/Pulse'

/** Mantiene la pantalla encendida mientras se está en tarima (si el navegador lo permite). */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }
    if (!nav.wakeLock) return
    let lock: Lock | null = null
    const get = () => {
      if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => (lock = l), () => {})
    }
    get()
    document.addEventListener('visibilitychange', get)
    return () => {
      document.removeEventListener('visibilitychange', get)
      void lock?.release().catch(() => {})
    }
  }, [])
}

/** Los dos relojes: arrancan al entrar y siguen aunque se recargue la página. */
function useStageClock(date: string, songId: string | undefined) {
  const storeKey = `alabanza:tarima:${date}`
  const [clock, setClock] = useState<StageClock>(() => {
    try {
      return readClock(localStorage.getItem(storeKey)) ?? newClock(Date.now())
    } catch {
      return newClock(Date.now())
    }
  })
  const current = useRef(songId)
  // Al cambiar de canción, lo que iba se le suma a la anterior
  useEffect(() => {
    setClock((c) => tick(c, Date.now(), current.current))
    current.current = songId
  }, [songId])
  useEffect(() => {
    const t = window.setInterval(() => setClock((c) => tick(c, Date.now(), current.current)), 500)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(clock))
    } catch {
      /* sin almacenamiento: los relojes igual funcionan */
    }
  }, [clock, storeKey])
  return {
    clock,
    toggle: () => setClock((c) => (c.running ? pause(c, Date.now(), current.current) : resume(c, Date.now()))),
    reset: () => setClock(newClock(Date.now())),
  }
}

function Clock({ label, ms, running }: { label: string; ms: number; running: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-line">
      <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className={`text-4xl leading-none font-black tabular-nums md:text-6xl ${running ? 'text-slate-900' : 'text-slate-400'}`}>{formatClock(ms)}</p>
    </div>
  )
}

/**
 * Modo tarima: todas las canciones del domingo en pestañas, para tablet en
 * horizontal. Sin botones de editar; solo se puede transponer (para ti).
 */
export default function Stage() {
  const date = upcomingSunday()
  const { service, loaded } = useService(date)
  const songs = useSongs()
  const { views, prefs } = useMe()
  const byId = new Map(songs.map((s) => [s.id, s]))
  const items = (service?.items ?? []).filter((i) => byId.has(i.songId))
  const [idx, setIdx] = useState(0)
  const [trans, setTrans] = useState<Record<string, number>>({})
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('alabanza:stageFont')) || 20)
  const item = items[Math.min(idx, items.length - 1)]
  const { clock, toggle, reset } = useStageClock(date, item?.songId)
  const top = useRef<HTMLDivElement>(null)
  const [topH, setTopH] = useState(180)
  const tabs = useRef<HTMLDivElement>(null)
  useWakeLock()

  useLayoutEffect(() => {
    const el = top.current
    if (!el) return
    const ro = new ResizeObserver(() => setTopH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])

  useEffect(() => {
    tabs.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [idx])

  useEffect(() => {
    try {
      localStorage.setItem('alabanza:stageFont', String(fontSize))
    } catch {
      /* nada */
    }
  }, [fontSize])

  if (!items.length)
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">{loaded || service ? 'Todavía no hay canciones para este domingo.' : 'Cargando…'}</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-accent">
          ← Volver
        </Link>
      </div>
    )

  const song = byId.get(item.songId)!

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-ink md:landscape:overflow-hidden">
      <div ref={top} className="sticky top-0 z-10 border-b border-line bg-ink/95 backdrop-blur">
        {/* Pestañas: una por canción */}
        <div className="flex items-center gap-2 px-3 pt-2">
          <Link to="/" className="shrink-0 rounded-xl bg-panel px-3 py-2 text-sm font-semibold text-slate-600" aria-label="Salir del modo tarima">
            ✕ Salir
          </Link>
          <div ref={tabs} role="tablist" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
            {items.map((it, i) => {
              const s = byId.get(it.songId)!
              const on = i === idx
              const spent = clock.perSong[it.songId]
              return (
                <button
                  key={it.songId}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setIdx(i)}
                  className={`flex shrink-0 items-baseline gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${on ? 'bg-accent text-white' : 'bg-panel text-slate-700'}`}
                >
                  <span className={on ? 'text-white/70' : 'text-slate-400'}>{i + 1}</span>
                  <span className="max-w-[14rem] truncate">{s.title}</span>
                  {spent && !on ? <span className="text-[11px] font-medium text-slate-400 tabular-nums">{formatClock(spent)}</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* Relojes y lo único que se puede tocar: tono, pulso y tamaño */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Clock label="Ministración" ms={clock.total} running={clock.running} />
          <Clock label="Esta canción" ms={clock.perSong[item.songId] ?? 0} running={clock.running} />
          <div className="flex flex-col gap-1">
            <button onClick={toggle} className="h-9 w-9 rounded-full bg-panel text-sm" aria-label={clock.running ? 'Pausar relojes' : 'Seguir relojes'}>
              {clock.running ? '⏸' : '▶'}
            </button>
            <button
              onClick={() => confirm('¿Reiniciar los relojes a 0:00?') && reset()}
              className="h-9 w-9 rounded-full bg-panel text-sm text-slate-500"
              aria-label="Reiniciar relojes"
            >
              ↺
            </button>
          </div>
          <div className="flex-1" />
          <KeyControl
            key={song.id}
            song={song}
            item={item}
            trans={trans[song.id] ?? 0}
            setTrans={(n) => setTrans({ ...trans, [song.id]: n })}
            showChords={views.chords}
          />
          <PulseButton key={'p' + song.id} bpm={song.bpm} feel={song.drums?.feel} autoStart={prefs.autoPulse} />
          <div className="flex rounded-xl bg-panel text-sm">
            <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="px-2.5 py-2" aria-label="Letra más pequeña">
              A−
            </button>
            <button onClick={() => setFontSize(Math.min(36, fontSize + 2))} className="px-2.5 py-2 font-semibold" aria-label="Letra más grande">
              A+
            </button>
          </div>
        </div>
      </div>

      <StageSheet key={song.id} song={song} item={item} trans={trans[song.id] ?? 0} fontSize={fontSize} showChords={views.chords} pagesTop={`${topH + 16}px`} />

      {idx < items.length - 1 && (
        <button
          onClick={() => setIdx(idx + 1)}
          className="fixed right-3 bottom-20 z-20 rounded-xl md:landscape:bottom-3 bg-accent/90 px-3 py-2 text-sm font-semibold text-white shadow-lg"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          Siguiente: {byId.get(items[idx + 1].songId)!.title} ›
        </button>
      )}
    </div>
  )
}

/** Tono en que se ve la canción: el del domingo (o el de la canción), más mi transposición y mi capo. */
function useStageKey(song: Song, item: ServiceItem, trans: number) {
  const mine = usePersonal(song.id)
  const written = sharpKey(song.key || guessKey(song.content))
  const teamKey = (item.key ? sharpKey(item.key) : '') || written
  const sounding = trans && teamKey ? transposeKey(teamKey, trans) : teamKey
  const capo = mine.capo ?? 0
  return { written, teamKey, sounding, capo, ...keyView(written, sounding, capo) }
}

function KeyControl({ song, item, trans, setTrans, showChords }: { song: Song; item: ServiceItem; trans: number; setTrans: (n: number) => void; showChords: boolean }) {
  const { teamKey, sounding, capo, shapeKey } = useStageKey(song, item, trans)
  const step = (d: number) => setTrans(((((trans + d) % 12) + 12 + 5) % 12) - 5)
  const suggested = sounding ? capoSuggestion(sounding) : null
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center rounded-xl ${trans ? 'bg-amber-100 ring-1 ring-amber-300' : 'bg-panel'}`}>
        <button onClick={() => step(-1)} disabled={!teamKey} className="px-3 py-2 text-xl leading-none disabled:opacity-30" aria-label="Bajar medio tono (solo para mí)">
          −
        </button>
        <span className="flex items-baseline gap-1.5 py-2">
          <span className="text-sm text-slate-500">{trans ? 'Viendo en' : 'Suena en'}</span>
          <b className={`text-lg ${trans ? 'text-amber-900' : 'text-accent'}`}>{sounding || '—'}</b>
        </span>
        <button onClick={() => step(1)} disabled={!teamKey} className="px-3 py-2 text-xl leading-none disabled:opacity-30" aria-label="Subir medio tono (solo para mí)">
          +
        </button>
      </div>
      {trans !== 0 && (
        <button onClick={() => setTrans(0)} className="rounded-xl bg-white px-2.5 py-2 text-sm font-semibold text-amber-900 shadow-sm ring-1 ring-amber-300">
          Volver a {teamKey}
        </button>
      )}
      {showChords && capo > 0 && (
        <span className="text-sm text-slate-500" title={suggested ? `Sugerido: capo ${suggested.capo}` : undefined}>
          Capo {capo} · {shapeKey}
        </span>
      )}
    </div>
  )
}

function StageSheet({ song, item, trans, fontSize, showChords, pagesTop }: { song: Song; item: ServiceItem; trans: number; fontSize: number; showChords: boolean; pagesTop: string }) {
  const { semis, shapeKey } = useStageKey(song, item, trans)
  return (
    <div className="px-4 pt-3 pb-16">
      {song.content.trim() ? (
        <ChordSheet content={song.content} semitones={semis} targetKey={shapeKey} showChords={showChords} fontSize={fontSize} drums={song.drums} columns pagesTop={pagesTop} />
      ) : (
        <p className="text-slate-500">Esta canción todavía no tiene letra ni acordes.</p>
      )}
    </div>
  )
}
