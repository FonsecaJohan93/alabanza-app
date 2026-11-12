import { useCallback, useEffect, useState } from 'react'
import type { Service, ServiceItem } from '../types'
import type { Assignment } from './team'
import * as api from './api'

// ---- fechas (siempre en la hora local del teléfono)

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** El domingo de esta semana: hoy si es domingo, si no el siguiente. */
export function upcomingSunday(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return iso(d)
}

export const isToday = (date: string) => date === iso(new Date())

/** "domingo 15 de noviembre" */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ---- lista de un servicio, con copia en el teléfono para verla sin señal

const cacheKey = (date: string) => `alabanza:service:${date}`

function readCache(date: string): Service | null {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(date)) ?? 'null')
  } catch {
    return null
  }
}

function writeCache(s: Service) {
  try {
    localStorage.setItem(cacheKey(s.date), JSON.stringify(s))
  } catch {
    /* nada */
  }
}

export function useService(date: string) {
  const [service, setService] = useState<Service | null>(() => readCache(date))
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .fetchService(date)
      .then((s) => {
        if (!alive) return
        setService(s)
        if (s) writeCache(s)
        setError(null)
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [date])

  const save = useCallback(
    async (items: ServiceItem[], team?: Assignment[]) => {
      try {
        const s = await api.saveService(date, items, team, service?.updatedAt)
        setService(s)
        writeCache(s)
        return s
      } catch (e) {
        // Otra persona la cambió: se muestra su versión y se avisa
        const err = e as api.ApiError
        if (err.status === 409 && err.body.service) setService(err.body.service as Service)
        throw e
      }
    },
    [date, service?.updatedAt],
  )

  return { service, loaded, error, save }
}

/** Agrupa las canciones por bloque, respetando el orden de la lista. */
export function groupBySection(items: ServiceItem[]): { section?: string; items: ServiceItem[] }[] {
  const groups: { section?: string; items: ServiceItem[] }[] = []
  for (const it of items) {
    const last = groups[groups.length - 1]
    if (last && last.section === it.section) last.items.push(it)
    else groups.push({ section: it.section, items: [it] })
  }
  return groups
}
