import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Cómo se acomoda y se mueve la hoja en pantalla:
 * - En horizontal (tablet o teléfono acostado) las columnas miden exactamente
 *   el alto que queda libre entre lo fijo de arriba y lo fijo de abajo, así se
 *   lee solo deslizando hacia el lado, sin bajar.
 * - El autoscroll baja la hoja (o la corre hacia el lado si va en columnas).
 *
 * Lo fijo se marca con `data-pin="top"` o `data-pin="bottom"`.
 */

const LANDSCAPE = '(orientation: landscape) and (min-width: 640px)'
const GAP = 8

function pinnedTop() {
  let top = 0
  document.querySelectorAll<HTMLElement>('[data-pin="top"]').forEach((el) => {
    top = Math.max(top, el.getBoundingClientRect().bottom)
  })
  return Math.max(0, top)
}

function pinnedBottom() {
  let bottom = 0
  document.querySelectorAll<HTMLElement>('[data-pin="bottom"]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.height) bottom = Math.max(bottom, window.innerHeight - r.top)
  })
  return Math.max(0, bottom)
}

/** El elemento que hace el scroll vertical (la tarima tiene el suyo; la canción usa la página). */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

/** Deja el borde de arriba de la hoja justo debajo de lo fijo. */
let aligningUntil = 0
export function alignSheet(el: HTMLElement) {
  if (performance.now() < aligningUntil) return // ya va en camino
  const d = el.getBoundingClientRect().top - pinnedTop() - GAP
  if (Math.abs(d) <= GAP) return
  aligningUntil = performance.now() + 500
  scrollParent(el).scrollBy({ top: d, behavior: 'smooth' })
}

/**
 * En horizontal: el alto de las columnas medido en vivo (null = vertical,
 * la hoja va normal). `bottom` es el espacio que hay que dejar abajo.
 */
export function useFitPages(ref: RefObject<HTMLElement | null>, on: boolean) {
  const [fit, setFit] = useState<{ height: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    if (!on) return setFit(null)
    const mq = window.matchMedia(LANDSCAPE)
    const ro = new ResizeObserver(() => measure())
    function measure() {
      if (!mq.matches || !ref.current) return setFit(null)
      document.querySelectorAll('[data-pin]').forEach((el) => ro.observe(el))
      const bottom = pinnedBottom()
      const height = Math.floor(window.innerHeight - pinnedTop() - bottom - GAP * 2)
      // Muy poco alto (teléfono acostado con mucho encima): mejor bajar normal
      if (height < 260) return setFit(null)
      setFit((f) => (f && f.height === height && f.bottom === bottom ? f : { height, bottom }))
    }
    measure()
    // La barra del pulso aparece y desaparece (va en un portal al final de la página)
    const mo = new MutationObserver(measure)
    mo.observe(document.body, { childList: true })
    window.addEventListener('resize', measure)
    mq.addEventListener('change', measure)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', measure)
      mq.removeEventListener('change', measure)
    }
  }, [on, ref])
  return fit
}

/** Mantiene la pantalla encendida (si el navegador lo permite). */
export function useWakeLock(on = true) {
  useEffect(() => {
    if (!on) return
    type Lock = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }
    if (!nav.wakeLock) return
    let lock: Lock | null = null
    let done = false
    const get = () => {
      if (document.visibilityState === 'visible')
        nav.wakeLock!.request('screen').then(
          (l) => (done ? void l.release().catch(() => {}) : (lock = l)),
          () => {},
        )
    }
    get()
    document.addEventListener('visibilitychange', get)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', get)
      void lock?.release().catch(() => {})
    }
  }, [on])
}

const SPEED_KEY = 'alabanza:autoSpeed'
export const MIN_SPEED = 1
export const MAX_SPEED = 10

/** Píxeles por segundo de lectura según la velocidad (1–10) y el tamaño de letra. */
export const readingSpeed = (level: number, fontPx: number) => level * 0.35 * fontPx

function readSpeed() {
  try {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(localStorage.getItem(SPEED_KEY)) || 3))
  } catch {
    return 3
  }
}

/**
 * Autoscroll de la hoja. Si va en columnas corre hacia el lado (a la misma
 * velocidad de lectura); si no, baja. Si la persona mueve la hoja con el dedo,
 * espera un momento y sigue desde ahí. Al llegar al final se apaga.
 */
export function useAutoScroll(resetKey?: string) {
  const [on, setOn] = useState(false)
  const [speed, setSpeedState] = useState(readSpeed)
  const speedRef = useRef(speed)
  speedRef.current = speed
  useEffect(() => setOn(false), [resetKey])
  useWakeLock(on)

  useEffect(() => {
    if (!on) return
    const sheet = document.querySelector<HTMLElement>('.sheet')
    if (!sheet) return setOn(false)
    alignSheet(sheet)
    let holdUntil = performance.now() + 600 // deja terminar el acomodo
    const hold = () => (holdUntil = performance.now() + 1500)
    const opts = { passive: true, capture: true }
    window.addEventListener('wheel', hold, opts)
    window.addEventListener('touchstart', hold, opts)
    window.addEventListener('touchmove', hold, opts)

    let raf = 0
    let last = performance.now()
    let target: HTMLElement | null = null
    let prop: 'scrollLeft' | 'scrollTop' = 'scrollTop'
    let pos = 0
    let stuck = 0
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const cs = getComputedStyle(sheet)
      const fontPx = parseFloat(cs.fontSize) || 17
      const horiz = sheet.classList.contains('pages') && sheet.scrollWidth > sheet.clientWidth + 1
      const el = horiz ? sheet : scrollParent(sheet)
      const p = horiz ? 'scrollLeft' : 'scrollTop'
      if (el !== target || p !== prop) {
        target = el
        prop = p
        pos = el[p]
      }
      // Lo movió la persona: seguir desde donde quedó
      if (Math.abs(el[p] - pos) > 3) pos = el[p]
      if (now >= holdUntil) {
        let v = readingSpeed(speedRef.current, fontPx)
        // En columnas: una columna de ancho por cada columna de alto leída
        if (horiz) v *= ((parseFloat(cs.columnWidth) || fontPx * 17) + (parseFloat(cs.columnGap) || 48)) / Math.max(1, sheet.clientHeight)
        const max = horiz ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight
        pos = Math.min(max, pos + v * dt)
        el[p] = pos
        stuck = el[p] >= max - 1 ? stuck + dt : 0
        if (stuck > 1.5) return setOn(false) // llegó al final
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', hold, opts)
      window.removeEventListener('touchstart', hold, opts)
      window.removeEventListener('touchmove', hold, opts)
    }
  }, [on])

  const setSpeed = (n: number) => {
    const v = Math.min(MAX_SPEED, Math.max(MIN_SPEED, n))
    setSpeedState(v)
    try {
      localStorage.setItem(SPEED_KEY, String(v))
    } catch {
      /* nada */
    }
  }
  return { on, setOn, speed, setSpeed }
}

/** Botón "Auto" y, cuando va andando, la velocidad. */
export function AutoScrollControl({ auto, big = false }: { auto: ReturnType<typeof useAutoScroll>; big?: boolean }) {
  const pad = big ? 'px-2.5 py-2' : 'px-2 py-2'
  if (!auto.on)
    return (
      <button onClick={() => auto.setOn(true)} className={`rounded-xl bg-panel ${pad} text-sm font-semibold text-accent`} aria-label="Autoscroll">
        Auto ▶
      </button>
    )
  return (
    <div className="flex items-center rounded-xl bg-accent text-sm text-white">
      <button onClick={() => auto.setSpeed(auto.speed - 1)} disabled={auto.speed <= MIN_SPEED} className={`${pad} disabled:opacity-40`} aria-label="Más lento">
        −
      </button>
      <span className="min-w-[2.5rem] text-center font-semibold tabular-nums" aria-label={`Velocidad ${auto.speed}`}>
        Vel {auto.speed}
      </span>
      <button onClick={() => auto.setSpeed(auto.speed + 1)} disabled={auto.speed >= MAX_SPEED} className={`${pad} disabled:opacity-40`} aria-label="Más rápido">
        +
      </button>
      <button onClick={() => auto.setOn(false)} className={`${pad} border-l border-white/30 font-semibold`} aria-label="Parar autoscroll">
        ■
      </button>
    </div>
  )
}
