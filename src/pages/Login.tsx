import { useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { signIn } from '../lib/store'
import { Button, ErrorBox, Field, inputClass } from '../components/ui'

type Mode = 'login' | 'register' | 'forgot'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = (m: Mode) => (setMode(m), setError(null), setSentTo(null))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'forgot') setSentTo((await api.forgotPassword(username)).sentTo)
      else signIn(mode === 'login' ? await api.login(username, password) : await api.register(username, password, name, invite, email))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <img src="/pwa-192x192.png" alt="" className="mb-4 h-16 w-16 rounded-2xl" />
      <h1 className="text-2xl font-bold">Alabanza</h1>
      <p className="mb-6 text-slate-600">El repertorio del equipo: canciones, acordes y tonos.</p>

      {mode === 'forgot' ? (
        <div className="mb-5">
          <h2 className="text-lg font-semibold">¿Olvidaste tu contraseña?</h2>
          <p className="text-sm text-slate-600">Escribe tu usuario o tu correo. Te mandamos un correo con tu usuario y un enlace para poner una contraseña nueva.</p>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm font-medium">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" onClick={() => go(m)} className={`rounded-lg py-2 ${mode === m ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
              {m === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>
      )}

      {sentTo ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
            Listo. Te mandamos un correo a <b>{sentTo}</b> con tu usuario y el enlace (sirve por 1 hora). Si no lo ves, revisa en spam.
          </p>
          <Button variant="ghost" onClick={() => go('login')} className="w-full">
            ← Volver a entrar
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <Field label="Tu nombre" hint="Así te verá el resto del equipo">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          )}
          <Field
            label={mode === 'register' ? 'Usuario' : 'Usuario o correo'}
            hint={mode === 'register' ? 'Con esto entras. Letras, números, punto o guion; sin espacios.' : undefined}
          >
            <input
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete={mode === 'register' ? 'username' : 'username email'}
              required
            />
          </Field>
          {mode === 'register' && (
            <Field label="Correo" hint="Para recuperar tu usuario o contraseña si se te olvidan. Solo tú lo ves.">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoComplete="email"
                required
              />
            </Field>
          )}
          {mode !== 'forgot' && (
            <Field label="Contraseña">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </Field>
          )}
          {mode === 'register' && (
            <Field label="Código del equipo" hint="Pídeselo a quien administra la app">
              <input className={inputClass} value={invite} onChange={(e) => setInvite(e.target.value)} autoCapitalize="none" required />
            </Field>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Mandarme el correo'}
          </Button>
          {mode === 'login' && (
            <button type="button" onClick={() => go('forgot')} className="block w-full text-center text-sm font-medium text-accent">
              ¿Olvidaste tu usuario o contraseña?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => go('login')} className="block w-full text-center text-sm font-medium text-accent">
              ← Volver a entrar
            </button>
          )}
        </form>
      )}
    </div>
  )
}
