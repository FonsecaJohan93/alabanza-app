import { Link } from 'react-router-dom'
import { groupBySection, isToday, longDate, upcomingSunday, useService } from '../lib/service'
import { useSession, useSongs } from '../lib/store'
import { ErrorBox, Header } from '../components/ui'

export default function Home() {
  const session = useSession()
  const songs = useSongs()
  const date = upcomingSunday()
  const { service, loaded, error } = useService(date)
  const byId = new Map(songs.map((s) => [s.id, s]))
  const items = (service?.items ?? []).filter((i) => byId.has(i.songId))

  return (
    <div className="pb-10">
      <Header title="Inicio" />
      <div className="px-4 pt-5">
        <p className="text-2xl font-bold">Hola, {session?.name}</p>
        <p className="mt-1 text-slate-600">
          {isToday(date) ? 'Para hoy' : 'Para este domingo'}, <span className="font-medium text-slate-800">{longDate(date).replace(/^domingo,? /, '')}</span>, las
          canciones son:
        </p>

        {error && !service && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}

        {!loaded && !service ? (
          <p className="py-10 text-center text-slate-500">Cargando…</p>
        ) : !items.length ? (
          <div className="mt-5 rounded-2xl bg-panel p-6 text-center">
            <p className="font-medium">Todavía no hay canciones para este domingo</p>
            <Link to={`/servicio/${date}`} className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
              Armar la lista
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {groupBySection(items).map((g, gi) => (
              <section key={gi}>
                {g.section && <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{g.section}</h2>}
                <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
                  {g.items.map((it) => {
                    const s = byId.get(it.songId)!
                    return (
                      <li key={it.songId}>
                        <Link to={`/cancion/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{s.title}</p>
                            {s.artist && <p className="truncate text-sm text-slate-500">{s.artist}</p>}
                          </div>
                          {s.key && <span className="rounded-lg bg-accent-soft px-2 py-1 text-sm font-bold text-accent">{s.key}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{service && `Lista de ${service.updatedBy}`}</span>
              <Link to={`/servicio/${date}`} className="text-sm font-semibold text-accent">
                Editar lista
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
