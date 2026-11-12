import { useNavigate } from 'react-router-dom'
import type { Song } from '../types'

export function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  )
}

/** Abre la vista de voces (solo letra, grande). Sirve dentro de un link de la lista. */
export function VoiceButton({ song }: { song: Song }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={(e) => {
        // Va dentro del link de la fila: se corta para abrir las voces y no la hoja
        e.preventDefault()
        e.stopPropagation()
        navigate(`/cancion/${song.id}/voces`)
      }}
      className="grid h-8 w-9 place-items-center rounded-lg bg-black/5 text-slate-500 active:brightness-95"
      aria-label={`Voces de ${song.title}`}
      title="Voces: solo letra"
    >
      <MicIcon />
    </button>
  )
}
