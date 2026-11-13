/**
 * Posiciones de acordes en guitarra (afinación estándar). En vez de un
 * diccionario fijo, busca todas las digitaciones tocables de un acorde y las
 * ordena: primero las abiertas y cercanas a la cejuela, después las de cejilla.
 * Así sirve para cualquier acorde que aparezca en una hoja (C#m7, G/B, Dsus4…).
 */
import { noteIndex } from './chordsheet.ts'

/** Cuerdas de la 6.ª (E grave) a la 1.ª (e aguda). */
export const TUNING = [4, 9, 2, 7, 11, 4]
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (pc: number) => NAMES[((pc % 12) + 12) % 12]

export type ChordSpec = { root: number; bass: number; required: number[]; optional: number[] }

export type Voicing = {
  /** Traste por cuerda (6.ª → 1.ª); -1 = no se toca, 0 = al aire. */
  frets: number[]
  /** Dedo por cuerda (0 = ninguno). */
  fingers: number[]
  barre?: { fret: number; from: number; to: number }
}

/** Lee el nombre del acorde y devuelve sus notas (en semitonos desde la raíz). */
export function parseChordName(name: string): ChordSpec | null {
  const m = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(name.trim())
  if (!m) return null
  const root = noteIndex(m[1])
  const bassNote = m[3] ? noteIndex(m[3]) : root
  if (root < 0 || bassNote < 0) return null

  let s = m[2].replace(/[()/,]/g, ' ').trim()
  let third: number | null = 4
  let fifth = 7
  let seventh: number | null = null
  const ext: number[] = []
  let fifthAltered = false
  const take = (re: RegExp) => {
    const r = re.exec(s)
    if (r) s = s.slice(r[0].length).trimStart()
    return r
  }

  if (take(/^(m7b5|ø7?)/)) (third = 3), (fifth = 6), (seventh = 10), (fifthAltered = true)
  else if (take(/^(dim7|°7|º7)/)) (third = 3), (fifth = 6), (seventh = 9), (fifthAltered = true)
  else if (take(/^(dim|°|º)/)) (third = 3), (fifth = 6), (fifthAltered = true)
  else if (take(/^(aug|\+)/)) (fifth = 8), (fifthAltered = true)
  else if (take(/^(min|m(?!aj)|-)/)) third = 3

  let guard = 0
  while (s && guard++ < 10) {
    let r: RegExpExecArray | null
    if ((r = take(/^(maj|Maj|M|Δ|7M)(13|11|9|7)?/))) {
      seventh = 11
      const n = r[2]
      if (n === '9') ext.push(2)
      if (n === '11') ext.push(5)
      if (n === '13') ext.push(9)
    } else if ((r = take(/^sus(2|4)?/))) third = r[1] === '2' ? 2 : 5
    else if ((r = take(/^add(\d+)/))) ext.push(Number(r[1]) % 12 === 4 ? 5 : 2)
    else if ((r = take(/^([b#])(5|9|11|13)/))) {
      const d = r[1] === 'b' ? -1 : 1
      if (r[2] === '5') (fifth = 7 + d), (fifthAltered = true)
      else ext.push({ '9': 2, '11': 5, '13': 9 }[r[2]]! + d)
    } else if ((r = take(/^(13|11|9|7|6|5|4|2)/))) {
      const n = r[1]
      if (n === '7') seventh = seventh ?? 10
      else if (n === '9') (seventh = seventh ?? 10), ext.push(2)
      else if (n === '11') (seventh = seventh ?? 10), ext.push(5)
      else if (n === '13') (seventh = seventh ?? 10), ext.push(9)
      else if (n === '6') ext.push(9)
      else if (n === '5') third = null
      else if (n === '4') third = 5
      else if (n === '2') ext.push(2)
    } else s = s.slice(1).trimStart()
  }

  const required = new Set<number>([0])
  const optional = new Set<number>()
  if (third !== null) required.add(third)
  ;(fifthAltered || third === null || (seventh === null && !ext.length) ? required : optional).add(fifth)
  if (seventh !== null) required.add(seventh)
  // En acordes de muchas notas la más "alta" es la que da el color; las demás pueden faltar
  ext.forEach((e, i) => (i === ext.length - 1 ? required : optional).add(((e % 12) + 12) % 12))
  const bass = (((bassNote - root) % 12) + 12) % 12
  required.add(bass)
  for (const r of required) optional.delete(r)
  return { root, bass: bassNote, required: [...required].map((i) => (i + root) % 12), optional: [...optional].map((i) => (i + root) % 12) }
}

/** Asigna dedos: con cejilla el 1 es la cejilla; el resto por traste y cuerda. */
function fingering(frets: number[]): Pick<Voicing, 'fingers' | 'barre'> | null {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x) => x.f > 0)
  const fingers = frets.map(() => 0)
  if (!fretted.length) return { fingers }
  const minF = Math.min(...fretted.map((x) => x.f))
  if (fretted.length <= 4) {
    fretted.sort((a, b) => a.f - b.f || a.s - b.s).forEach((x, i) => (fingers[x.s] = i + 1))
    return { fingers }
  }
  // Cejilla: desde la primera cuerda pisada en el traste más bajo hasta la 1.ª, sin cuerdas al aire ni muteadas debajo
  const from = fretted.find((x) => x.f === minF)!.s
  for (let s = from; s < 6; s++) if (frets[s] < minF) return null
  const rest = fretted.filter((x) => x.f > minF).sort((a, b) => a.f - b.f || a.s - b.s)
  if (rest.length > 3) return null
  for (const x of fretted) if (x.f === minF) fingers[x.s] = 1
  rest.forEach((x, i) => (fingers[x.s] = i + 2))
  return { fingers, barre: { fret: minF, from, to: 5 } }
}

function score(v: Voicing): number {
  const sounding = v.frets.filter((f) => f >= 0).length
  const fretted = v.frets.filter((f) => f > 0)
  const minF = fretted.length ? Math.min(...fretted) : 0
  const maxF = fretted.length ? Math.max(...fretted) : 0
  const span = maxF - minF
  const open = v.frets.filter((f) => f === 0).length
  const used = new Set(v.fingers.filter(Boolean)).size
  // Cuerda al aire entre dedos pisados con los 4 dedos ocupados: rara e incómoda
  const firstF = v.frets.findIndex((f) => f > 0)
  const lastF = 5 - [...v.frets].reverse().findIndex((f) => f > 0)
  const openInside = v.frets.some((f, s) => f === 0 && s > firstF && s < lastF)
  return (
    minF * 1.1 -
    sounding * 1.2 +
    (span >= 3 ? 4.5 : span === 2 ? 0.4 : 0) +
    (v.barre ? 1.2 : 0) +
    used * 0.4 +
    (maxF > 3 ? open * 2 : 0) +
    (v.frets[5] < 0 ? 0.6 : 0) +
    (openInside && used >= 4 && minF === 1 && span >= 2 ? 4 : 0)
  )
}

/**
 * Las posiciones que cualquier guitarrista espera ver primero. Para todo lo
 * demás (y como alternativas) manda la búsqueda.
 */
const PREFERRED: Record<string, string> = {
  C: 'x32010', 'C#': 'x46664', D: 'xx0232', 'D#': 'x68886', E: '022100', F: '133211', 'F#': '244322', G: '320003', 'G#': '466544', A: 'x02220', 'A#': 'x13331', B: 'x24442',
  Cm: 'x35543', 'C#m': 'x46654', Dm: 'xx0231', 'D#m': 'x68876', Em: '022000', Fm: '133111', 'F#m': '244222', Gm: '355333', 'G#m': '466444', Am: 'x02210', 'A#m': 'x13321', Bm: 'x24432',
}
const fretsKey = (frets: number[]) => frets.map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : String(f))).join('')

const cache = new Map<string, Voicing[]>()

/** Hasta `max` posiciones tocables del acorde, la más cómoda primero. */
export function guitarVoicings(name: string, max = 4): Voicing[] {
  const key = `${name}|${max}`
  const hit = cache.get(key)
  if (hit) return hit
  const spec = parseChordName(name)
  if (!spec) return []
  const allowed = new Set([...spec.required, ...spec.optional])
  const minStrings = spec.required.length <= 2 ? 3 : 4
  const found = new Map<string, Voicing>()

  for (let pos = 1; pos <= 12; pos++) {
    const options = TUNING.map((open) => {
      const o = [-1]
      for (const f of [0, pos, pos + 1, pos + 2, pos + 3]) if (allowed.has((open + f) % 12) && !o.includes(f)) o.push(f)
      return o
    })
    const frets: number[] = []
    const walk = (s: number) => {
      if (s === 6) return check([...frets])
      for (const f of options[s]) {
        frets[s] = f
        walk(s + 1)
      }
    }
    walk(0)
  }

  function check(frets: number[]) {
    const sounding = frets.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0)
    if (sounding.length < minStrings) return
    // Solo se apagan cuerdas graves seguidas, y como mucho la 1.ª: nada en medio
    const first = sounding[0]
    const last = sounding[sounding.length - 1]
    if (last < (minStrings === 3 ? 2 : 4) || sounding.length !== last - first + 1) return
    if ((TUNING[first] + frets[first]) % 12 !== spec!.bass) return
    const pcs = new Set(sounding.map((s) => (TUNING[s] + frets[s]) % 12))
    if (!spec!.required.every((n) => pcs.has(n))) return
    const fretted = frets.filter((f) => f > 0)
    if (fretted.length) {
      const span = Math.max(...fretted) - Math.min(...fretted)
      if (span > 3) return
      if (frets.includes(0) && Math.max(...fretted) > 5) return
    }
    const fg = fingering(frets)
    if (!fg) return
    found.set(frets.join(','), { frets, ...fg })
  }

  const m = /^([A-G][#b]?)(m?)$/.exec(name.trim())
  const preferred = m ? PREFERRED[noteName(noteIndex(m[1])) + m[2]] : undefined
  const rank = (v: Voicing) => (preferred && fretsKey(v.frets) === preferred ? -100 : score(v))
  const sorted = [...found.values()].sort((a, b) => rank(a) - rank(b))
  // Que las opciones sean distintas de verdad (no la misma con una cuerda más)
  const picked: Voicing[] = []
  for (const v of sorted) {
    const same = (p: Voicing) => {
      const diff = p.frets.map((_, i) => i).filter((i) => p.frets[i] !== v.frets[i])
      return diff.length === 0 || (diff.length === 1 && (p.frets[diff[0]] < 0 || v.frets[diff[0]] < 0))
    }
    if (picked.some(same)) continue
    picked.push(v)
    if (picked.length >= max) break
  }
  cache.set(key, picked)
  return picked
}

/** Notas que suenan en cada cuerda (null si no se toca). */
export const stringNotes = (v: Voicing) => v.frets.map((f, s) => (f < 0 ? null : noteName(TUNING[s] + f)))

/** Notas del acorde en orden (raíz primero), para mostrarlas. */
export function chordNotes(name: string): string[] {
  const spec = parseChordName(name)
  if (!spec) return []
  const all = [...new Set([...spec.required, ...spec.optional])]
  return all.sort((a, b) => ((a - spec.root + 12) % 12) - ((b - spec.root + 12) % 12)).map(noteName)
}
