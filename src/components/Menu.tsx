import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { signOut, useMe, useSession } from '../lib/store'
import type { Role } from '../lib/team'

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const ITEMS: { to: string; label: string; icon: string; only?: Role[] }[] = [
  { to: '/', label: 'Inicio', icon: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5' },
  { to: '/planear', label: 'Planear domingo', icon: 'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7.5 1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2-.3 1-2Z' },
  { to: '/repertorio', label: 'Repertorio', icon: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  { to: '/equipo', label: 'Equipo', icon: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7' },
  { to: '/ritmos', label: 'Crear ritmo', only: ['direccion', 'bateria'], icon: 'M4 9h16M4 9c0-1.7 3.6-3 8-3s8 1.3 8 3v6c0 1.7-3.6 3-8 3s-8-1.3-8-3V9ZM7 3l3 5M17 3l-3 5' },
]

const MenuContext = createContext<() => void>(() => {})

/** Envuelve la app: guarda si el panel lateral está abierto y lo dibuja. */
export function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const session = useSession()
  const { roles } = useMe()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <MenuContext.Provider value={() => setOpen(true)}>
      {children}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`pb-safe fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-[300px] flex-col bg-panel shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menú"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 pt-6 pb-5">
          <img src="/pwa-192x192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0">
            <div className="text-lg leading-tight font-bold">Alabanza</div>
            {session && (
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm text-slate-600">{session.name}</span>
                <NavLink to="/perfil" className="shrink-0 text-sm font-semibold text-accent underline-offset-2 hover:underline">
                  Ver perfil
                </NavLink>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {ITEMS.filter((it) => !it.only || it.only.some((r) => roles.includes(r))).map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-base ${
                  isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-slate-800 active:bg-ink'
                }`
              }
            >
              <span className="text-accent">
                <Icon d={icon} />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base text-slate-600 active:bg-ink">
            <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            Cerrar sesión
          </button>
          <p className="px-3 pt-2 text-xs text-slate-400">v{__APP_VERSION__}</p>
        </div>
      </aside>
    </MenuContext.Provider>
  )
}

export function MenuButton() {
  const openMenu = useContext(MenuContext)
  return (
    <button
      onClick={openMenu}
      className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-accent active:bg-accent-soft"
      aria-label="Abrir menú"
    >
      <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  )
}
