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

/** En columnas: segundos que se queda en cada columna antes de pasar a la siguiente (vel 3 = 30 s). */
export const secondsPerColumn = (level: number) => Math.round(90 / level)

/**
 * Autoscroll de la hoja. En vertical baja despacio y seguido. En columnas
 * (horizontal) no se mueve de a poco: espera unos segundos según la velocidad
 * y pasa de una a la siguiente columna. Si la persona mueve la hoja con el
 * dedo, espera un momento y sigue desde ahí. Al llegar al final se detiene
 * (en esa canción).
 *
 * Prendido o apagado es el interruptor "Autoscroll" de "Ver" (`wanted`), así
 * cada quien lo deja prendido por defecto en Mi perfil. Al abrir una canción
 * con él prendido espera unos segundos antes de empezar.
 */
export function useAutoScroll(wanted: boolean, setWanted: (on: boolean) => void, resetKey?: string) {
  // Llegó al final de esta canción (se queda quieto hasta que se vuelva a tocar "Auto")
  const [ended, setEnded] = useState<string | undefined>()
  const on = wanted && ended !== resetKey
  const manual = useRef(false)
  const [speed, setSpeedState] = useState(readSpeed)
  const speedRef = useRef(speed)
  speedRef.current = speed
  // En columnas: cuántos segundos faltan para pasar (null = va bajando en vertical)
  const [left, setLeft] = useState<number | null>(null)
  const since = useRef(0)
  useWakeLock(on)

  useEffect(() => {
    if (!on) return
    const sheet = document.querySelector<HTMLElement>('.sheet')
    if (!sheet) return
    // Con el botón arranca ya; al abrir la canción, deja ver el comienzo un momento
    const byHand = manual.current
    manual.current = false
    if (byHand) alignSheet(sheet)
    let holdUntil = performance.now() + (byHand ? 600 : 3000)
    since.current = performance.now()
    const hold = () => {
      holdUntil = performance.now() + 1500
      since.current = performance.now() // en columnas, la cuenta empieza de nuevo
    }
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
        since.current = now
      }
      if (horiz) {
        // Por páginas: se queda en la columna y, cumplido el tiempo, pasa a la siguiente
        const wait = secondsPerColumn(speedRef.current)
        const gone = (now - since.current) / 1000
        const max = el.scrollWidth - el.clientWidth
        if (gone >= wait) {
          if (el.scrollLeft >= max - 1) return setEnded(resetKey) // ya se vio la última
          const col = (parseFloat(cs.columnWidth) || fontPx * 17) + (parseFloat(cs.columnGap) || 48)
          const next = Math.min(max, (Math.round(el.scrollLeft / col) + 1) * col)
          el.scrollTo({ left: next, behavior: 'smooth' })
          since.current = now
        }
        const l = Math.max(0, Math.ceil(wait - (now - since.current) / 1000))
        setLeft((x) => (x === l ? x : l))
        raf = requestAnimationFrame(step)
        return
      }
      setLeft(null)
      // Lo movió la persona: seguir desde donde quedó
      if (Math.abs(el[p] - pos) > 3) pos = el[p]
      if (now >= holdUntil) {
        const v = readingSpeed(speedRef.current, fontPx)
        const max = el.scrollHeight - el.clientHeight
        pos = Math.min(max, pos + v * dt)
        el[p] = pos
        stuck = el[p] >= max - 1 ? stuck + dt : 0
        if (stuck > 1.5) return setEnded(resetKey) // llegó al final
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      setLeft(null)
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', hold, opts)
      window.removeEventListener('touchstart', hold, opts)
      window.removeEventListener('touchmove', hold, opts)
    }
  }, [on, resetKey])

  const setSpeed = (n: number) => {
    const v = Math.min(MAX_SPEED, Math.max(MIN_SPEED, n))
    setSpeedState(v)
    since.current = performance.now()
    try {
      localStorage.setItem(SPEED_KEY, String(v))
    } catch {
      /* nada */
    }
  }
  const start = () => {
    manual.current = true
    setEnded(undefined)
    if (!wanted) setWanted(true)
  }
  return { on, start, stop: () => setWanted(false), speed, setSpeed, left }
}

/** Botón "Auto" y, cuando va andando, la velocidad. */
export function AutoScrollControl({ auto, big = false }: { auto: ReturnType<typeof useAutoScroll>; big?: boolean }) {
  const pad = big ? 'px-2.5 py-2' : 'px-2 py-2'
  if (!auto.on)
    return (
      <button onClick={auto.start} className={`rounded-xl bg-panel ${pad} text-sm font-semibold text-accent`} aria-label="Autoscroll">
        Auto ▶
      </button>
    )
  return (
    <div className="flex items-center rounded-xl bg-accent text-sm text-white">
      <button onClick={() => auto.setSpeed(auto.speed - 1)} disabled={auto.speed <= MIN_SPEED} className={`${pad} disabled:opacity-40`} aria-label="Más lento">
        −
      </button>
      <span
        className="min-w-[2.5rem] text-center font-semibold tabular-nums"
        aria-label={auto.left === null ? `Velocidad ${auto.speed}` : `Velocidad ${auto.speed}: ${secondsPerColumn(auto.speed)} segundos por columna`}
      >
        Vel {auto.speed}
        {auto.left !== null && <span className="ml-1.5 font-normal text-white/75">{auto.left}s</span>}
      </span>
      <button onClick={() => auto.setSpeed(auto.speed + 1)} disabled={auto.speed >= MAX_SPEED} className={`${pad} disabled:opacity-40`} aria-label="Más rápido">
        +
      </button>
      <button onClick={auto.stop} className={`${pad} border-l border-white/30 font-semibold`} aria-label="Parar autoscroll">
        ■
      </button>
    </div>
  )
}
