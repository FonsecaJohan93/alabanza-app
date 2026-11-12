import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Header({ title, back, actions }: { title: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
      {back && (
        <Link to={back} aria-label="Volver" className="-ml-2 rounded-full p-2 text-slate-600 active:bg-black/5">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.5 4 6.5 10l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {actions}
    </header>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-white active:brightness-110 disabled:opacity-50',
    ghost: 'bg-panel text-slate-700 active:bg-slate-50 disabled:opacity-50',
    danger: 'bg-panel text-red-700 active:bg-red-50',
  }[variant]
  return (
    <button className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>
}

export const TEMPO_LABEL = { rapida: 'Rápida', media: 'Media', lenta: 'Lenta' } as const
