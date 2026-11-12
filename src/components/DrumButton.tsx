import { useNavigate } from 'react-router-dom'
import type { Song } from '../types'
import { DrumKitIcon } from './DrumIcons'

/**
 * Botón con el ícono de batería: abre la pantalla de batería de la canción
 * (tempo grande, 1 2 3 4 y el ritmo de cada sección). Sirve dentro de un link de la lista.
 */
export function DrumButton({ song, className = '' }: { song: Song; className?: string }) {
  const navigate = useNavigate()
  const filled = !!(song.drums || song.bpm)
  return (
    <button
      onClick={(e) => {
        // Va dentro del link de la fila: se corta para abrir la batería y no la hoja
        e.preventDefault()
        e.stopPropagation()
        navigate(`/cancion/${song.id}/bateria`)
      }}
      className={`grid h-8 w-9 place-items-center rounded-lg ${filled ? 'bg-accent-soft text-accent' : 'bg-black/5 text-slate-400'} active:brightness-95 ${className}`}
      aria-label={`Batería de ${song.title}`}
      title="Batería"
    >
      <DrumKitIcon size={20} />
    </button>
  )
}
