import { useState } from 'react'
import { Link } from 'react-router-dom'
import { saveProfile, useMe, useSession } from '../lib/store'
import { roleLabel, VIEW_MODES, viewsFor, type Prefs } from '../lib/team'
import { ErrorBox, Header } from '../components/ui'

/** Explica en palabras lo que la persona va a ver. */
function describe(v: ReturnType<typeof viewsFor>): string {
  const parts = [v.chords && 'acordes', v.lyrics && 'letra grande', v.drums && 'batería'].filter(Boolean)
  if (parts.length === 3) return 'Todo: acordes, letra y batería'
  return parts.join(' y ').replace(/^./, (c) => c.toUpperCase())
}

export default function Settings() {
  const session = useSession()
  const { prefs, roles, loaded } = useMe()
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

  const view = prefs.view ?? 'auto'
  const auto = viewsFor(roles, 'auto')

  return (
    <div className="pb-10">
      <Header title="Configuración" actions={saving ? <span className="text-sm text-slate-400">Guardando…</span> : undefined} />
      <div className="space-y-5 px-4 pt-4">
        <section className="rounded-2xl bg-panel p-4">
          <label className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Pulso al abrir una canción</span>
              <span className="block text-sm text-slate-500">El pulso visual arranca solo con el BPM de la canción.</span>
            </span>
            <button
              role="switch"
              aria-checked={!!prefs.autoPulse}
              onClick={() => update({ autoPulse: !prefs.autoPulse })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs.autoPulse ? 'bg-accent' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs.autoPulse ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
        </section>

        <section className="rounded-2xl bg-panel p-4">
          <h2 className="font-semibold">Qué ver al abrir una canción</h2>
          <div className="mt-3 space-y-1.5">
            {VIEW_MODES.map((m) => {
              const on = view === m.id
              const hint =
                m.id === 'auto'
                  ? roles.length
                    ? `${roles.map(roleLabel).join(', ')} → ${describe(auto).toLowerCase()}`
                    : 'Aún no marcas instrumentos: ves todo'
                  : m.hint
              return (
                <button
                  key={m.id}
                  onClick={() => update({ view: m.id })}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? 'bg-accent-soft ring-2 ring-accent' : 'bg-black/[0.03] active:bg-black/5'}`}
                  aria-pressed={on}
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-slate-300'}`}>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-medium ${on ? 'text-accent' : ''}`}>{m.label}</span>
                    <span className="block text-sm text-slate-500">{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Tus instrumentos se marcan en{' '}
            <Link to="/equipo" className="font-medium text-accent underline">
              Equipo
            </Link>
            . Si un día necesitas otra vista, cámbiala aquí.
          </p>
        </section>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </div>
  )
}
