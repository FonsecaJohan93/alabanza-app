import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Song } from '../types'
import { DrumKitIcon } from './DrumIcons'
import { DrumPanel } from './DrumPanel'

/** Botón con el ícono de batería; abre el panel. Sirve dentro de un link de la lista. */
export function DrumButton({ song, className = '' }: { song: Song; className?: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const filled = !!(song.drums || song.bpm)
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={`grid h-8 w-9 place-items-center rounded-lg ${filled ? 'bg-accent-soft text-accent' : 'bg-black/5 text-slate-400'} active:brightness-95 ${className}`}
        aria-label={`Batería de ${song.title}`}
        title="Batería"
      >
        <DrumKitIcon size={20} />
      </button>
      {open &&
        createPortal(
          // Los eventos de React suben por el árbol aunque el panel esté en otro
          // lugar del DOM: se cortan aquí para que no abran el link de la fila.
          <div onClick={(e) => e.stopPropagation()}>
            <DrumPanel song={song} onClose={close} />
          </div>,
          document.body,
        )}
    </>
  )
}
