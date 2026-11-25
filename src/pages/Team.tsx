import { useEffect, useState } from 'react'
import { refreshMembers, saveMemberRoles, saveProfile, useMe, useMembers, useSession } from '../lib/store'
import * as api from '../lib/api'
import { ROLES, roleLabel, type Member, type Role } from '../lib/team'
import { Button, ErrorBox, Field, Header, inputClass } from '../components/ui'

export default function Team() {
  const session = useSession()
  const members = useMembers()
  const { isDirector } = useMe()

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
              <MemberRow key={m.username} member={m} isMe={m.username === session?.username} canEdit={isDirector && m.username !== session?.username} />
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

/** Una persona del equipo; Dirección puede marcarle los instrumentos. */
function MemberRow({ member: m, isMe, canEdit }: { member: Member; isMe: boolean; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<Role[]>(m.roles)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveMemberRoles(m.username, roles)
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{m.name.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.name}
            {isMe && <span className="ml-1.5 text-xs font-normal text-slate-400">(tú)</span>}
          </p>
          <p className="truncate text-sm text-slate-500">{m.roles.length ? m.roles.map(roleLabel).join(', ') : 'Sin instrumentos todavía'}</p>
        </div>
        {canEdit && !open && (
          <button onClick={() => (setRoles(m.roles), setOpen(true))} className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold text-accent active:bg-accent-soft">
            Instrumentos
          </button>
        )}
      </div>
      {canEdit && !isMe && <ResetLink member={m} />}
      {open && (
        <div className="mt-2 ml-12 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map(({ id, label }) => {
              const on = roles.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => setRoles(on ? roles.filter((r) => r !== id) : [...roles, id])}
                  className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-accent text-white' : 'bg-black/5 text-slate-700'}`}
                  aria-pressed={on}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Dirección: enlace para que alguien que olvidó la contraseña (y no tiene correo) ponga una nueva. */
function ResetLink({ member: m }: { member: Member }) {
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function make() {
    if (!confirm(`¿Crear un enlace para que ${m.name} ponga una contraseña nueva? Sirve por 24 horas.`)) return
    setBusy(true)
    setError(null)
    try {
      // Con la dirección desde la que se abrió la app (en local el servidor ve otro puerto)
      const u = new URL(await api.resetLinkFor(m.username))
      setLink(`${location.origin}${u.pathname}${u.search}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const text = () => `Hola ${m.name}, tu usuario de Alabanza es "${m.username}". Con este enlace pones una contraseña nueva (sirve por 24 horas): ${link}`

  async function share() {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) return void nav.share({ text: text() }).catch(() => {})
    try {
      await navigator.clipboard.writeText(text())
      setCopied(true)
    } catch {
      setError('No se pudo copiar; mantén presionado el enlace para copiarlo')
    }
  }

  if (!link)
    return (
      <div className="mt-1 ml-12">
        <button onClick={make} disabled={busy} className="text-xs font-medium text-slate-500 underline disabled:opacity-50">
          {busy ? 'Creando…' : '¿Olvidó la contraseña? Crear enlace'}
        </button>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    )
  return (
    <div className="mt-2 ml-12 space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      <p>
        Mándale este enlace a {m.name} (sirve 24 horas). Su usuario es <b>{m.username}</b>.
      </p>
      <p className="break-all rounded-lg bg-white px-2 py-1 font-mono text-xs select-all">{link}</p>
      <div className="flex gap-2">
        <Button onClick={share}>{copied ? 'Copiado ✓' : 'Compartir / copiar'}</Button>
        <Button variant="ghost" onClick={() => setLink(null)}>
          Cerrar
        </Button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  )
}
