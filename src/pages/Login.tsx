import { useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { signIn } from '../lib/store'
import { Button, ErrorBox, Field, inputClass } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      signIn(mode === 'login' ? await api.login(username, password) : await api.register(username, password, name, invite))
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

      <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm font-medium">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {m === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <Field label="Tu nombre" hint="Así te verá el resto del equipo">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Usuario">
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </Field>
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
        {mode === 'register' && (
          <Field label="Código del equipo" hint="Pídeselo a quien administra la app">
            <input className={inputClass} value={invite} onChange={(e) => setInvite(e.target.value)} autoCapitalize="none" required />
          </Field>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" disabled={busy} className="w-full py-3">
          {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>
    </div>
  )
}
