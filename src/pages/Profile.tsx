import { useEffect, useState } from 'react'
import { refreshMembers, saveEmail, useMembers, useSession } from '../lib/store'
import { cleanEmail } from '../lib/account'
import { roleLabel, type Member } from '../lib/team'
import { Button, ErrorBox, Header, inputClass } from '../components/ui'
import { ProfileForm } from './Team'
import { Preferences } from './Settings'

/** Mi perfil: nombre, instrumentos y preferencias, todo en un lugar. */
export default function Profile() {
  const session = useSession()
  const me = useMembers().find((m) => m.username === session?.username)

  useEffect(() => {
    void refreshMembers()
  }, [])

  return (
    <div className="pb-10">
      <Header title="Mi perfil" />
      <div className="space-y-5 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-2xl">
        {me && <Account me={me} />}
        {me ? <ProfileForm key={me.username} name={me.name} roles={me.roles} /> : <p className="text-center text-slate-500">Cargando…</p>}
        <h2 className="pt-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Preferencias</h2>
        <Preferences />
      </div>
    </div>
  )
}

/** Quién soy: nombre, usuario (con eso se entra) y correo para recuperar la cuenta. */
function Account({ me }: { me: Member }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(me.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missing = me.email === ''

  async function save() {
    const e = cleanEmail(email)
    if (!e) return setError('Ese correo no parece válido')
    setBusy(true)
    setError(null)
    try {
      await saveEmail(e)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-panel p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-2xl font-bold text-white">{me.name.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{me.name}</p>
          <p className="truncate text-sm text-slate-500">{me.roles.length ? me.roles.map(roleLabel).join(', ') : 'Sin instrumentos todavía'}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="w-16 shrink-0 text-slate-500">Usuario</dt>
          <dd className="min-w-0">
            <b className="text-base">{me.username}</b>
            <span className="block text-xs text-slate-500">Con esto (o con tu correo) entras a la app</span>
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="w-16 shrink-0 text-slate-500">Correo</dt>
          <dd className="min-w-0 flex-1">
            {editing || missing ? (
              <div className="space-y-2">
                {missing && !editing && <p className="text-xs text-amber-800">Agrega tu correo: si se te olvida la contraseña, te llega ahí un enlace para cambiarla.</p>}
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(e) => (setEmail(e.target.value), setEditing(true))}
                  placeholder="tu@correo.com"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                {error && <ErrorBox>{error}</ErrorBox>}
                {editing && (
                  <div className="flex gap-2">
                    <Button onClick={save} disabled={busy || !email.trim()}>
                      {busy ? 'Guardando…' : 'Guardar correo'}
                    </Button>
                    {!missing && (
                      <Button variant="ghost" onClick={() => (setEditing(false), setEmail(me.email ?? ''), setError(null))}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : me.email === undefined ? (
              <span className="text-slate-400">Cargando…</span>
            ) : (
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="break-all">{me.email}</span>
                <button onClick={() => setEditing(true)} className="font-semibold text-accent">
                  Cambiar
                </button>
              </span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  )
}
