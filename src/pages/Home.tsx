import { Link } from 'react-router-dom'
import { groupBySection, isToday, longDate, upcomingSunday, useService } from '../lib/service'
import { useMembers, useSession, useMe, useSongs } from '../lib/store'
import { ROLES } from '../lib/team'
import { songPath } from '../lib/team'
import { DrumButton } from '../components/DrumButton'
import { VoiceButton } from '../components/VoiceButton'
import { ErrorBox, Header } from '../components/ui'

export default function Home() {
  const session = useSession()
  const songs = useSongs()
  const { views } = useMe()
  const members = useMembers()
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
          {isToday(date) ? 'Para hoy' : 'Para este domingo'},{' '}
          <span className="font-medium text-slate-800">{longDate(date).replace(/^domingo,? /, '')}</span>, las canciones son:
        </p>

        {/* En tablet horizontal: canciones a la izquierda, equipo a la derecha */}
        <div className="md:landscape:grid md:landscape:grid-cols-[3fr_2fr] md:landscape:items-start md:landscape:gap-8">
          <div>
            {error && !service && (
              <div className="mt-4">
                <ErrorBox>{error}</ErrorBox>
              </div>
            )}

            {!loaded && !service ? (
              <p className="py-10 text-center text-slate-500">Cargando…</p>
            ) : !items.length ? (
              <div className="mt-5 rounded-2xl bg-panel p-6 text-center">
                <p className="font-medium">Todavía no hay canciones para este domingo</p>
                <Link
                  to={`/servicio/${date}`}
                  className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
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
                            <Link to={songPath(s.id, views)} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{s.title}</p>
                                {s.artist && <p className="truncate text-sm text-slate-500">{s.artist}</p>}
                              </div>
                              {s.key && <span className="rounded-lg bg-accent-soft px-2 py-1 text-sm font-bold text-accent">{s.key}</span>}
                              {views.lyrics && views.primary !== 'voces' && <VoiceButton song={s} />}
                              {views.drums && views.primary !== 'bateria' && <DrumButton song={s} />}
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
          {loaded || service ? <SundayTeam date={date} team={service?.team ?? []} members={members} me={session?.username} /> : null}
        </div>
      </div>
    </div>
  )
}

function SundayTeam({
  date,
  team,
  members,
  me,
}: {
  date: string
  team: { role: string; username: string }[]
  members: { username: string; name: string }[]
  me?: string
}) {
  const nameOf = (u: string) => members.find((m) => m.username === u)?.name ?? u
  const mine = ROLES.filter((r) => team.some((a) => a.role === r.id && a.username === me)).map((r) => r.label.toLowerCase())
  const rows = ROLES.map((r) => ({
    ...r,
    people: team.filter((a) => a.role === r.id).map((a) => a.username),
  })).filter((r) => r.people.length)
  return (
    <section className="mt-8 md:landscape:mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Quién toca</h2>
        <Link to={`/servicio/${date}`} className="text-sm font-semibold text-accent">
          {rows.length ? 'Cambiar' : 'Asignar'}
        </Link>
      </div>
      {mine.length > 0 && (
        <p className="mb-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
          Este domingo te toca: <b>{mine.join(', ')}</b>
        </p>
      )}
      {rows.length ? (
        <dl className="divide-y divide-line overflow-hidden rounded-2xl bg-panel">
          {rows.map((r) => (
            <div key={r.id} className="flex gap-3 px-4 py-2.5">
              <dt className="w-36 shrink-0 text-sm text-slate-500">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-sm font-medium">{r.people.map(nameOf).join(', ')}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">Todavía no se ha asignado quién toca este domingo.</p>
      )}
    </section>
  )
}
