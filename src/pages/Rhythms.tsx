import { useEffect } from 'react'
import { refreshRhythms, useMe } from '../lib/store'
import { RhythmLibrary } from '../components/RhythmLibrary'
import { Header } from '../components/ui'

/** Crear ritmo: la biblioteca de ritmos del equipo (para dirección y batería). */
export default function Rhythms() {
  const { roles, loaded } = useMe()
  const allowed = roles.includes('direccion') || roles.includes('bateria')

  useEffect(() => {
    void refreshRhythms()
  }, [])

  if (loaded && !allowed)
    return (
      <div>
        <Header title="Crear ritmo" />
        <p className="p-6 text-center text-slate-500">Esta opción es para quien tiene Dirección o Batería en su perfil.</p>
      </div>
    )

  return (
    <div className="pb-24">
      <Header title="Ritmos" />
      <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-3xl">
        <p className="text-sm text-slate-600">Ritmos del equipo. Aquí se crean y se practican con su propio BPM; en cada canción eliges cuál va en cada sección y suena al BPM de la canción.</p>
        <RhythmLibrary />
      </div>
    </div>
  )
}
