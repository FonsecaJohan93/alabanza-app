import { ROLES, type Assignment, type Member } from '../lib/team'

/**
 * Por cada instrumento, quién lo toca ese día. En cada lista salen primero
 * las personas que dijeron en su perfil que tocan ese instrumento.
 */
export function TeamPicker({ members, value, onChange }: { members: Member[]; value: Assignment[]; onChange: (v: Assignment[]) => void }) {
  const nameOf = (u: string) => members.find((m) => m.username === u)?.name ?? u

  return (
    <ul className="divide-y divide-line">
      {ROLES.map(({ id, label }) => {
        const assigned = value.filter((a) => a.role === id)
        const free = members.filter((m) => !assigned.some((a) => a.username === m.username))
        const plays = free.filter((m) => m.roles.includes(id))
        const others = free.filter((m) => !m.roles.includes(id))
        return (
          <li key={id} className="flex flex-wrap items-center gap-1.5 py-2">
            <span className="w-32 shrink-0 text-sm font-medium text-slate-700">{label}</span>
            {assigned.map((a) => (
              <span key={a.username} className="flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-2.5 text-sm text-white">
                {nameOf(a.username)}
                <button
                  onClick={() => onChange(value.filter((x) => !(x.role === id && x.username === a.username)))}
                  className="grid h-5 w-5 place-items-center rounded-full text-xs active:bg-white/20"
                  aria-label={`Quitar a ${nameOf(a.username)} de ${label}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {free.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && onChange([...value, { role: id, username: e.target.value }])}
                className="rounded-full bg-black/5 px-2.5 py-1 text-sm text-slate-600"
                aria-label={`Agregar a ${label}`}
              >
                <option value="">+ Agregar</option>
                {plays.length > 0 && (
                  <optgroup label={`Tocan ${label.toLowerCase()}`}>
                    {plays.map((m) => (
                      <option key={m.username} value={m.username}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label={plays.length ? 'Otras personas' : 'Equipo'}>
                    {others.map((m) => (
                      <option key={m.username} value={m.username}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </li>
        )
      })}
    </ul>
  )
}
