import { useEffect, useState } from 'react'
import { refreshMembers, saveProfile, useMembers, useSession } from '../lib/store'
import { ROLES, roleLabel, type Role } from '../lib/team'
import { Button, ErrorBox, Field, Header, inputClass } from '../components/ui'

export default function Team() {
  const session = useSession()
  const members = useMembers()

  useEffect(() => {
    void refreshMembers()
  }, [])

  return (
    <div className="pb-10">
      <Header title="Equipo" />
      <div className="space-y-5 px-4 pt-4">
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
            {members.length} {members.length === 1 ? 'persona' : 'personas'} en el equipo
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
            {members.map((m) => (
              <li key={m.username} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent">
                  {m.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.username === session?.username && <span className="ml-1.5 text-xs font-normal text-slate-400">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{m.roles.length ? m.roles.map(roleLabel).join(', ') : 'Sin instrumentos todavía'}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Para sumar a alguien, comparte el link de la app y el código del equipo; cada persona crea su cuenta.</p>
        </section>
      </div>
    </div>
  )
}

export function ProfileForm({ name: initialName, roles: initialRoles }: { name: string; roles: Role[] }) {
  const [name, setName] = useState(initialName)
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirty = name.trim() !== initialName || roles.join() !== initialRoles.join()

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveProfile(name, roles)
      setMsg('Guardado')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Nombre e instrumentos</h2>
      <Field label="Nombre">
        <input className={inputClass} value={name} onChange={(e) => (setName(e.target.value), setMsg(null))} />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">¿Qué tocas o haces en el equipo?</span>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map(({ id, label }) => {
            const on = roles.includes(id)
            return (
              <button
                key={id}
                onClick={() => (setRoles(on ? roles.filter((r) => r !== id) : [...roles, id]), setMsg(null))}
                className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-accent text-white' : 'bg-black/5 text-slate-700'}`}
                aria-pressed={on}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty || !name.trim()}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        {msg && !dirty && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </section>
  )
}
