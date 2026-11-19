import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SHOW_ITEMS, type Show } from '../lib/show'
import { saveProfile, useMe, useSession } from '../lib/store'
import { ShowList } from '../pages/Settings'

/**
 * Lo que veo ahora: mi forma por defecto (Mi perfil) más lo que cambié con
 * "Ver". Al cambiar `resetKey` (otra canción) vuelve a lo de siempre.
 */
export function useShow(resetKey?: string) {
  const { show: base } = useMe()
  const [override, setOverride] = useState<Show | null>(null)
  useEffect(() => setOverride(null), [resetKey])
  const show = override ?? base
  // Cada interruptor parte de lo último (aunque se toquen dos muy rápido)
  const latest = useRef(show)
  latest.current = show
  const changed = !!override && SHOW_ITEMS.some(({ id }) => override[id] !== base[id])
  const setShow = (patch: Partial<Show>) => {
    latest.current = { ...latest.current, ...patch }
    setOverride(latest.current)
  }
  return { show, setShow, changed, reset: () => setOverride(null) }
}

/** Fuente: la normal o la de "Letra grande", cada una se recuerda en el teléfono. */
export function useFontSize(big: boolean): [number, (n: number) => void, number] {
  const key = big ? 'alabanza:vocalFont' : 'alabanza:fontSize'
  const initial = big ? 26 : 17
  const read = () => {
    try {
      return Number(localStorage.getItem(key)) || initial
    } catch {
      return initial
    }
  }
  const [size, setSize] = useState(read)
  useEffect(() => setSize(read()), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (n: number) => {
    const v = Math.max(13, Math.min(56, n))
    setSize(v)
    try {
      localStorage.setItem(key, String(v))
    } catch {
      /* nada */
    }
  }
  return [size, set, big ? 3 : 2]
}

/** Botón "Ver" con los interruptores de qué se muestra en esta canción. */
export function ViewMenu({ show, onChange, changed, onReset }: { show: Show; onChange: (patch: Partial<Show>) => void; changed: boolean; onReset: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const session = useSession()
  const { prefs, roles, loaded } = useMe()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  async function keep() {
    if (!session) return
    setSaving(true)
    try {
      await saveProfile(session.name, loaded ? roles : undefined, { ...prefs, show })
      onReset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`rounded-xl px-3 py-2 text-sm font-semibold ${open || changed ? 'bg-accent text-white' : 'bg-panel text-accent'}`}
      >
        Ver
      </button>
      {open && (
        <div className="fixed inset-x-3 top-24 z-40 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/10 sm:right-4 sm:left-auto sm:w-[22rem]">
          <p className="px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">Qué ver en esta canción</p>
          <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-1">
            <ShowList show={show} onChange={onChange} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-1 pt-2">
            {changed ? (
              <>
                <button onClick={onReset} className="rounded-lg bg-panel px-2.5 py-1.5 text-sm font-semibold text-slate-600">
                  Volver a lo de siempre
                </button>
                <button onClick={keep} disabled={saving} className="rounded-lg bg-accent px-2.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Usar siempre así'}
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-500">
                Es tu forma de siempre ·{' '}
                <Link to="/perfil" className="font-semibold text-accent">
                  Mi perfil
                </Link>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
