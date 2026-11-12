import { useEffect } from 'react'
import { refreshMembers, useMembers, useSession } from '../lib/store'
import { Header } from '../components/ui'
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
        {me ? <ProfileForm key={me.username} name={me.name} roles={me.roles} /> : <p className="text-center text-slate-500">Cargando…</p>}
        <h2 className="pt-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Preferencias</h2>
        <Preferences />
      </div>
    </div>
  )
}
