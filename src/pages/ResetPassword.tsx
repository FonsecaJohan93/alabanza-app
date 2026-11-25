import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../lib/api'
import { signIn } from '../lib/store'
import { Button, ErrorBox, Field, inputClass } from '../components/ui'

/** /restablecer?u=usuario&t=token: el enlace del correo (o el que da Dirección). */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const username = params.get('u') ?? ''
  const token = params.get('t') ?? ''
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password !== again) return setError('Las dos contraseñas no son iguales')
    setBusy(true)
    setError(null)
    try {
      signIn(await api.resetPassword(username, token, password))
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <img src="/pwa-192x192.png" alt="" className="mb-4 h-16 w-16 rounded-2xl" />
      <h1 className="text-2xl font-bold">Contraseña nueva</h1>
      {username && token ? (
        <>
          <p className="mb-6 text-slate-600">
            Tu usuario es <b className="text-slate-900">{username}</b>. Escribe la contraseña nueva y entras de una vez.
          </p>
          <form onSubmit={submit} className="space-y-4">
            {/* Para que el gestor de contraseñas del teléfono la guarde con el usuario */}
            <input type="text" value={username} autoComplete="username" readOnly hidden />
            <Field label="Contraseña nueva">
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Field label="Repítela">
              <input className={inputClass} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <Button type="submit" disabled={busy} className="w-full py-3">
              {busy ? 'Un momento…' : 'Guardar y entrar'}
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-2 text-slate-600">Este enlace está incompleto. Pide otro desde "¿Olvidaste tu usuario o contraseña?".</p>
      )}
      <button onClick={() => navigate('/', { replace: true })} className="mt-6 text-sm font-medium text-accent">
        ← Ir a la app
      </button>
    </div>
  )
}
