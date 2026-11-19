import { useState } from 'react'
import { saveProfile, useMe, useSession } from '../lib/store'
import type { Prefs } from '../lib/team'
import { SHOW_ITEMS, type Show } from '../lib/show'
import { ErrorBox } from '../components/ui'

/** Interruptor (lo usan Mi perfil y el menú "Ver" de la canción). */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** La lista de interruptores de qué se ve en una canción. */
export function ShowList({ show, onChange }: { show: Show; onChange: (patch: Partial<Show>) => void }) {
  return (
    <ul className="divide-y divide-line">
      {SHOW_ITEMS.map(({ id, label, hint }) => (
        <li key={id} className="flex items-center gap-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{label}</span>
            <span className="block text-sm text-slate-500">{hint}</span>
          </span>
          <Switch on={show[id]} onChange={(v) => onChange({ [id]: v })} label={label} />
        </li>
      ))}
    </ul>
  )
}

/** Preferencias de la cuenta (van dentro de Mi perfil). */
export function Preferences() {
  const session = useSession()
  const { prefs, roles, loaded, show } = useMe()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function update(patch: Prefs) {
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      // Si aún no se sabe qué tocas, no se mandan los instrumentos (el servidor los conserva)
      await saveProfile(session.name, loaded ? roles : undefined, { ...prefs, ...patch })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {saving && <p className="text-right text-sm text-slate-400">Guardando…</p>}
        <section className="rounded-2xl bg-panel p-4">
          <h2 className="font-semibold">Al abrir una canción, mostrar…</h2>
          <p className="text-sm text-slate-500">En cada canción lo cambias con el botón “Ver”; la siguiente vuelve a esto.</p>
          <div className="mt-1">
            <ShowList show={show} onChange={(patch) => void update({ show: { ...show, ...patch } })} />
          </div>
        </section>

        <section className="rounded-2xl bg-panel p-4">
          <label className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Pulso al abrir una canción</span>
              <span className="block text-sm text-slate-500">El pulso visual arranca solo con el BPM de la canción.</span>
            </span>
            <Switch on={!!prefs.autoPulse} onChange={(v) => void update({ autoPulse: v })} label="Pulso al abrir una canción" />
          </label>
        </section>
        {error && <ErrorBox>{error}</ErrorBox>}
    </>
  )
}
