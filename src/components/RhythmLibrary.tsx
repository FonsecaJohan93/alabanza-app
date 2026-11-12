import { useMemo, useState } from 'react'
import { cleanDrums, newRhythmId, type DrumChart, type Rhythm } from '../lib/drums'
import { saveSong } from '../lib/store'
import type { Song } from '../types'
import { RhythmEditor, RhythmPlay } from './RhythmEditor'
import { ErrorBox } from './ui'

/** "Ritmos de esta canción": escucharlos, crear y editar. Se usa en la pantalla de batería y en Crear ritmo. */
export function RhythmLibrary({ song, startCreating = false }: { song: Song; startCreating?: boolean }) {
  const chart: DrumChart = useMemo(() => cleanDrums(song.drums) ?? { sections: [] }, [song.drums])
  const rhythms = chart.rhythms ?? []
  const [editing, setEditing] = useState<Rhythm | 'new' | null>(startCreating ? 'new' : null)
  const [error, setError] = useState<string | null>(null)

  async function saveChart(next: DrumChart) {
    setError(null)
    try {
      await saveSong({ ...song, drums: next }, song)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <section className="rounded-2xl bg-panel p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Ritmos de esta canción</h2>
          <button onClick={() => setEditing('new')} className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-white">
            + Crear ritmo
          </button>
        </div>
        {rhythms.length ? (
          <ul className="flex flex-wrap gap-2">
            {rhythms.map((r) => (
              <li key={r.id} className="flex items-center gap-1 rounded-full bg-black/[0.04] py-1 pr-1 pl-1">
                <RhythmPlay id={`lib-${song.id}-${r.id}`} pattern={r.pattern} bpm={song.bpm} feel={chart.feel} label={r.name} />
                <button onClick={() => setEditing(r)} className="rounded-full px-2 py-0.5 text-sm text-slate-500 active:bg-black/5" aria-label={`Editar ${r.name}`}>
                  ✎
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Crea los ritmos de la canción (por ejemplo uno para el verso y otro para el coro) y luego elige cuál suena en cada sección.</p>
        )}
      </section>
      {error && <ErrorBox>{error}</ErrorBox>}

      {editing && (
        <RhythmEditor
          title={song.title}
          feel={chart.feel}
          bpm={song.bpm}
          initial={editing === 'new' ? undefined : editing.pattern}
          initialName={editing === 'new' ? `Ritmo ${rhythms.length + 1}` : editing.name}
          onSave={(pattern, name) => {
            if (!pattern) return setEditing(null)
            const list =
              editing === 'new'
                ? [...rhythms, { id: newRhythmId(), name: name || `Ritmo ${rhythms.length + 1}`, pattern }]
                : rhythms.map((x) => (x.id === editing.id ? { ...x, name: name || x.name, pattern } : x))
            void saveChart({ ...chart, rhythms: list })
            setEditing(null)
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  const gone = editing.id
                  void saveChart({
                    ...chart,
                    rhythms: rhythms.filter((x) => x.id !== gone),
                    sections: chart.sections.map((s) => (s.rhythm === gone ? { ...s, rhythm: undefined } : s)),
                  })
                  setEditing(null)
                }
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
