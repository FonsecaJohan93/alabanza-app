import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { nextAlternative, proposeSongs, proposeTeam, themeTags, type SongPick } from '../lib/propose'
import { longDate, upcomingSunday } from '../lib/service'
import { refreshMembers, useMembers, useSongs } from '../lib/store'
import type { Assignment } from '../lib/team'
import type { Service } from '../types'
import { TeamPicker } from '../components/TeamPicker'
import { Button, ErrorBox, Header, inputClass } from '../components/ui'

/** Los próximos domingos (el de esta semana y los siguientes). */
function nextSundays(n: number): string[] {
  const first = upcomingSunday()
  const [y, m, d] = first.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(y, m - 1, d + 7 * i)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  })
}

const SUGGESTED = ['Fe en la prueba', 'Gracia', 'Santa Cena', 'Espíritu Santo', 'Gozo y celebración', 'Fidelidad de Dios', 'Victoria', 'Segunda venida']

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="h-8 w-8 rounded-full bg-white text-lg shadow-sm" aria-label={`Menos ${label}`}>
          −
        </button>
        <span className="w-4 text-center font-bold tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(8, value + 1))} className="h-8 w-8 rounded-full bg-white text-lg shadow-sm" aria-label={`Más ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

export default function Plan() {
  const navigate = useNavigate()
  const songs = useSongs()
  const members = useMembers()
  const sundays = useMemo(() => nextSundays(4), [])
  const [date, setDate] = useState(sundays[0])
  const [theme, setTheme] = useState('')
  const [alabanza, setAlabanza] = useState(2)
  const [adoracion, setAdoracion] = useState(3)
  const [history, setHistory] = useState<Service[] | null>(null)
  const [picks, setPicks] = useState<SongPick[] | null>(null)
  const [ranked, setRanked] = useState<SongPick[]>([])
  const [team, setTeam] = useState<Assignment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refreshMembers()
    api
      .fetchServices()
      .then(setHistory)
      .catch((e) => setError((e as Error).message))
  }, [])

  const existing = history?.find((s) => s.date === date)
  const tags = themeTags(theme)

  function propose(e?: FormEvent) {
    e?.preventDefault()
    if (!history) return
    const r = proposeSongs(songs, { theme, alabanza, adoracion, history, date })
    setPicks(r.picks)
    setRanked(r.ranked)
    setTeam(proposeTeam(members, history, date))
  }

  async function use() {
    if (!picks) return
    if (existing?.items.length && !confirm(`Ya hay una lista para el ${longDate(date)}. ¿Reemplazarla con esta propuesta?`)) return
    setBusy(true)
    setError(null)
    try {
      // Si una canción ya tenía tono puesto por dirección ese día, se conserva
      const keys = new Map((existing?.items ?? []).map((i) => [i.songId, i.key]))
      const items = picks.map((p) => ({
        songId: p.song.id,
        section: p.song.tags.includes('alabanza') ? 'Alabanza' : 'Adoración',
        key: keys.get(p.song.id),
      }))
      await api.saveService(date, items, team, existing?.updatedAt)
      navigate(`/servicio/${date}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <Header title="Planear domingo" />
      <div className="space-y-4 px-4 pt-4 md:landscape:mx-auto md:landscape:max-w-3xl">
        <form onSubmit={propose} className="space-y-3 rounded-2xl bg-panel p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">¿Qué domingo?</span>
            <select value={date} onChange={(e) => (setDate(e.target.value), setPicks(null))} className={inputClass}>
              {sundays.map((d, i) => (
                <option key={d} value={d}>
                  {longDate(d)}
                  {i === 0 ? ' (este)' : ''}
                </option>
              ))}
            </select>
          </label>
          {existing?.items.length ? <p className="text-xs text-amber-700">Ese domingo ya tiene {existing.items.length} canciones; la propuesta la reemplazaría.</p> : null}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Tema o prédica</span>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} className={inputClass} placeholder="Ej.: fe en medio de la prueba" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((t) => (
              <button type="button" key={t} onClick={() => setTheme(t)} className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-slate-600 active:bg-black/10">
                {t}
              </button>
            ))}
          </div>
          {theme.trim() && (
            <p className="text-xs text-slate-500">{tags.length ? `Buscará canciones de: ${tags.join(', ')}` : 'Buscará el tema en títulos y letras.'}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Stepper label="Alabanza" value={alabanza} onChange={setAlabanza} />
            <Stepper label="Adoración" value={adoracion} onChange={setAdoracion} />
          </div>
          <Button type="submit" className="w-full" disabled={!history || !songs.length}>
            {!history ? 'Cargando historial…' : picks ? 'Proponer de nuevo' : 'Proponer'}
          </Button>
        </form>

        {error && <ErrorBox>{error}</ErrorBox>}

        {picks && (
          <>
            <section>
              <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Canciones propuestas</h2>
              {picks.length ? (
                <ol className="space-y-2">
                  {picks.map((p, i) => (
                    <li key={p.song.id} className="rounded-2xl bg-panel p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-5 text-sm font-semibold text-slate-400">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.song.title}</p>
                          <p className="truncate text-sm text-slate-500">
                            {[p.song.artist, p.song.tags.includes('alabanza') ? 'Alabanza' : 'Adoración', p.song.key].filter(Boolean).join(' · ')}
                          </p>
                          {p.reasons.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {p.reasons.map((r) => (
                                <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] ${/se tocó/.test(r) ? 'bg-amber-50 text-amber-800' : 'bg-accent-soft text-accent'}`}>
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const alt = nextAlternative(ranked, picks, p.song)
                            if (alt) setPicks(picks.map((x, j) => (j === i ? alt : x)))
                          }}
                          className="rounded-lg px-2 py-1 text-sm font-semibold text-accent active:bg-accent-soft"
                          title="Cambiar por otra"
                        >
                          ↻ Otra
                        </button>
                        <button onClick={() => setPicks(picks.filter((_, j) => j !== i))} className="px-1.5 py-1 text-red-600" aria-label="Quitar">
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-2xl bg-panel p-4 text-sm text-slate-500">No encontré canciones. Prueba con otro tema.</p>
              )}
            </section>

            <section className="rounded-2xl bg-panel px-3 pt-3 pb-1">
              <h2 className="font-semibold">Equipo propuesto</h2>
              <p className="text-sm text-slate-500">Según los instrumentos de cada perfil, rotando a quien hace más tiempo no toca.</p>
              {members.some((m) => m.roles.length) ? null : (
                <p className="mt-1 text-sm text-amber-700">Nadie ha marcado instrumentos en su perfil todavía; elige a mano.</p>
              )}
              <TeamPicker members={members} value={team} onChange={setTeam} />
            </section>
          </>
        )}
      </div>

      {picks && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-2xl">
            <Button onClick={use} disabled={busy || !picks.length} className="w-full py-3">
              {busy ? 'Guardando…' : `Usar esta propuesta para el ${longDate(date).replace(/^domingo,? /, '')}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
