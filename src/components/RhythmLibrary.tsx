import { useState } from 'react'
import { deleteRhythm, saveRhythm, useMe, useRhythms } from '../lib/store'
import type { LibraryRhythm } from '../lib/rhythm'
import { RhythmEditor, RhythmPlay } from './RhythmEditor'
import { ErrorBox } from './ui'

/** Biblioteca de ritmos del equipo: escuchar, crear y editar (no depende de ninguna canción). */
export function RhythmLibrary() {
  const rhythms = useRhythms()
  const { roles } = useMe()
  const canEdit = roles.includes('direccion') || roles.includes('bateria')
  const [editing, setEditing] = useState<LibraryRhythm | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      setEditing(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const byMeter = (['4/4', '3/4', '6/8'] as const).map((m) => [m, rhythms.filter((r) => r.meter === m)] as const).filter(([, l]) => l.length)

  return (
    <>
      {canEdit && (
        <button onClick={() => setEditing('new')} className="w-full rounded-2xl bg-accent py-3 text-base font-semibold text-white active:brightness-110">
          + Crear ritmo
        </button>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {rhythms.length ? (
        byMeter.map(([meter, list]) => (
          <section key={meter}>
            <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{meter}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
              {list.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <RhythmPlay id={`lib-${r.id}`} pattern={r.pattern} bpm={r.bpm} meter={r.meter} label="" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.bpm} BPM · de {r.createdBy}
                    </p>
                  </div>
                  {canEdit && (
                    <button onClick={() => setEditing(r)} className="rounded-lg px-2.5 py-1 text-sm font-semibold text-accent active:bg-accent-soft">
                      Editar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="rounded-2xl bg-panel p-4 text-sm text-slate-500">Todavía no hay ritmos. Crea el primero; luego en cada canción eliges cuál va en cada sección.</p>
      )}

      {editing && (
        <RhythmEditor
          initial={editing === 'new' ? { name: `Ritmo ${rhythms.length + 1}` } : editing}
          onSave={(draft) => run(() => saveRhythm(draft, editing === 'new' ? undefined : editing.id))}
          onDelete={editing === 'new' ? undefined : () => run(() => deleteRhythm(editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
