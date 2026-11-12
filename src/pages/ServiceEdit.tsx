import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { longDate, useService } from '../lib/service'
import { useMe, useMembers, useSongs } from '../lib/store'
import { guessKey } from '../lib/chordsheet'
import type { Assignment } from '../lib/team'
import { TeamPicker } from '../components/TeamPicker'
import { Button, ErrorBox, Header, inputClass } from '../components/ui'
import type { ServiceItem } from '../types'

const SECTIONS = ['Alabanza', 'Adoración', 'Santa Cena', 'Ofrenda']
const BASE_KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const KEYS = [...BASE_KEYS, ...BASE_KEYS.map((k) => k + 'm')]

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export default function ServiceEdit() {
  const { date = '' } = useParams()
  const navigate = useNavigate()
  const songs = useSongs()
  const { isDirector } = useMe()
  const members = useMembers()
  const { service, loaded, save } = useService(date)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [team, setTeam] = useState<Assignment[]>([])
  const [touched, setTouched] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Al llegar la lista del servidor se usa como punto de partida (si no se ha tocado nada)
  useEffect(() => {
    if (!touched && service) {
      setItems(service.items)
      setTeam(service.team ?? [])
    }
  }, [service, touched])

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  const change = (next: ServiceItem[]) => {
    setTouched(true)
    setItems(next)
  }
  const move = (i: number, d: number) => {
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(i + d, 0, it)
    change(next)
  }
  // Al agregar, hereda el bloque de la última canción de la lista
  const add = (songId: string) => {
    change([...items, { songId, section: items[items.length - 1]?.section }])
    setQ('')
  }

  const terms = fold(q).split(/\s+/).filter(Boolean)
  const results = terms.length
    ? songs.filter((s) => !items.some((i) => i.songId === s.id) && terms.every((t) => fold(`${s.title} ${s.artist}`).includes(t))).slice(0, 8)
    : []

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await save(items, team)
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setTouched(false) // muestra la versión del otro
    } finally {
      setBusy(false)
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  return (
    <div className="pb-28">
      <Header title={`Lista del ${longDate(date)}`} back="/" />
      <div className="space-y-4 px-4 pt-4">
        {!loaded && !service && <p className="text-center text-slate-500">Cargando…</p>}

        {items.length > 0 && (
          <ol className="space-y-2">
            {items.map((it, i) => {
              const s = byId.get(it.songId)
              return (
                <li key={it.songId} className="rounded-2xl bg-panel p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 w-5 text-sm font-semibold text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s?.title ?? 'Canción borrada'}</p>
                      <p className="truncate text-sm text-slate-500">{s?.artist}</p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 text-lg text-slate-500 disabled:opacity-25" aria-label="Subir">
                        ↑
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="px-2 py-1 text-lg text-slate-500 disabled:opacity-25" aria-label="Bajar">
                        ↓
                      </button>
                      <button onClick={() => change(items.filter((_, j) => j !== i))} className="px-2 py-1 text-lg text-red-600" aria-label="Quitar">
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* Tono del domingo: lo elige solo dirección; los demás lo ven */}
                  <div className="mt-2 ml-7 flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Suena en</span>
                    {isDirector ? (
                      <select
                        value={it.key ?? ''}
                        onChange={(e) => change(items.map((x, j) => (j === i ? { ...x, key: e.target.value || undefined } : x)))}
                        className="rounded-lg bg-accent-soft px-2 py-1 font-bold text-accent"
                        aria-label={`Tono del domingo para ${s?.title ?? 'la canción'}`}
                      >
                        <option value="">{(s?.key || (s && guessKey(s.content)) || '—') + ' (el de la canción)'}</option>
                        {KEYS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-lg bg-accent-soft px-2 py-0.5 font-bold text-accent">{it.key || s?.key || '—'}</span>
                    )}
                  </div>
                  <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                    {SECTIONS.map((sec) => (
                      <button
                        key={sec}
                        onClick={() => change(items.map((x, j) => (j === i ? { ...x, section: x.section === sec ? undefined : sec } : x)))}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${it.section === sec ? 'bg-accent text-white' : 'bg-black/5 text-slate-600'}`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="rounded-2xl bg-panel p-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar canción para agregar…"
            className={inputClass}
          />
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {results.map((s) => (
                <li key={s.id}>
                  <button onClick={() => add(s.id)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left active:bg-slate-50">
                    <span className="text-lg text-accent">+</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      {s.artist && <span className="block truncate text-sm text-slate-500">{s.artist}</span>}
                    </span>
                    {s.key && <span className="text-sm font-bold text-accent">{s.key}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {terms.length > 0 && !results.length && <p className="px-1 pt-2 text-sm text-slate-500">No está en el repertorio. Agrégala primero desde Repertorio.</p>}
        </div>

        <section className="rounded-2xl bg-panel px-3 pt-3 pb-1">
          <h2 className="font-semibold">Quién toca</h2>
          <p className="text-sm text-slate-500">Elige quién va en cada instrumento este día.</p>
          <TeamPicker
            members={members}
            value={team}
            onChange={(v) => {
              setTouched(true)
              setTeam(v)
            }}
          />
        </section>

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl">
          <Button onClick={submit} disabled={busy || !touched} className="w-full py-3">
            {busy ? 'Guardando…' : 'Guardar lista'}
          </Button>
        </div>
      </div>
    </div>
  )
}
