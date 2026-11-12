// Batería sintetizada en el navegador (Web Audio): no hay archivos de sonido
// que descargar. El secuenciador programa los golpes con ~0,1 s de
// anticipación usando el reloj de audio, así el tiempo es exacto aunque la
// pantalla vaya lenta.

import { useEffect, useSyncExternalStore } from 'react'
import type { DrumPart } from './drums'
import { stepSeconds, type Pattern } from './rhythm'

let ctx: AudioContext | null = null
let out: AudioNode | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    const gain = ctx.createGain()
    gain.gain.value = 0.9
    comp.connect(gain).connect(ctx.destination)
    out = comp
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return ctx
}

function env(g: GainNode, t: number, peak: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
}

function tone(t: number, type: OscillatorType, f0: number, f1: number, sweep: number, peak: number, decay: number) {
  const c = audio()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + sweep)
  env(g, t, peak, decay)
  o.connect(g).connect(out!)
  o.start(t)
  o.stop(t + decay + 0.05)
}

function hiss(t: number, filter: BiquadFilterType, freq: number, peak: number, decay: number, q = 0.7) {
  const c = audio()
  const s = c.createBufferSource()
  s.buffer = noise
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  env(g, t, peak, decay)
  s.connect(f).connect(g).connect(out!)
  s.start(t)
  s.stop(t + decay + 0.05)
}

/** Un golpe de cada pieza. `accent` lo hace un poco más fuerte. */
export function hit(part: DrumPart, t: number, accent = false) {
  const a = accent ? 1.2 : 1
  switch (part) {
    case 'bombo':
      tone(t, 'sine', 150, 45, 0.12, 1 * a, 0.4)
      break
    case 'caja':
      hiss(t, 'highpass', 1200, 0.7 * a, 0.2)
      tone(t, 'triangle', 200, 160, 0.05, 0.45 * a, 0.12)
      break
    case 'aro':
      tone(t, 'triangle', 1700, 1500, 0.02, 0.5 * a, 0.05)
      hiss(t, 'bandpass', 2500, 0.3 * a, 0.04, 4)
      break
    case 'hihat':
      hiss(t, 'highpass', 7500, 0.35 * a, 0.05)
      break
    case 'ride':
      hiss(t, 'bandpass', 6000, 0.22 * a, 0.45, 1.5)
      tone(t, 'square', 3200, 3150, 0.3, 0.04 * a, 0.35)
      break
    case 'crash':
      hiss(t, 'highpass', 3000, 0.55 * a, 1.3)
      break
    case 'toms':
      tone(t, 'sine', 210, 110, 0.25, 0.85 * a, 0.35)
      break
  }
}

/** Campana del metrónomo: más aguda y fuerte en el 1 del compás. */
export function bell(t: number, accent: boolean) {
  tone(t, 'sine', accent ? 2000 : 1500, accent ? 2000 : 1500, 0.01, accent ? 0.6 : 0.35, 0.12)
  tone(t, 'sine', accent ? 4000 : 3000, accent ? 4000 : 3000, 0.01, 0.08, 0.06)
}

// ---- Campana encendida o apagada (preferencia del teléfono)

const CLICK_KEY = 'alabanza:click'
let clickOn = (() => {
  try {
    return localStorage.getItem(CLICK_KEY) === '1'
  } catch {
    return false
  }
})()
const clickListeners = new Set<() => void>()
export function setClickOn(v: boolean) {
  clickOn = v
  try {
    localStorage.setItem(CLICK_KEY, v ? '1' : '0')
  } catch {
    /* nada */
  }
  clickListeners.forEach((l) => l())
}
export const useClickOn = () =>
  useSyncExternalStore(
    (l) => (clickListeners.add(l), () => clickListeners.delete(l)),
    () => clickOn,
  )

// ---- Un solo ritmo sonando a la vez en toda la app

interface Playing {
  id: string
  step: number
}
let playing: Playing | null = null
let timer: number | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function stopRhythm() {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  playing = null
  emit()
}

/** Toca el ritmo en bucle. `id` identifica qué botón lo inició. */
/** `onlyClick`: solo la campana (metrónomo), sin batería. */
export async function playRhythm(id: string, getPattern: () => Pattern, bpm: number, sub: number, onlyClick = false) {
  stopRhythm()
  const c = audio()
  if (c.state === 'suspended') await c.resume() // los navegadores piden un toque del usuario
  const dur = stepSeconds(bpm, sub)
  let step = 0
  let next = c.currentTime + 0.06
  playing = { id, step: -1 }
  emit()
  const schedule = () => {
    while (next < c.currentTime + 0.12) {
      // Se lee el ritmo en cada golpe: los cambios se oyen sin reiniciar
      const pattern = getPattern()
      for (const [part, steps] of Object.entries(pattern.hits)) if (steps?.includes(step)) hit(part as DrumPart, next, step === 0)
      // Campana en cada tiempo (si está encendida): con ella se cuenta; sin ella, batería pura
      if ((clickOn || onlyClick) && step % sub === 0) bell(next, step === 0)
      const s = step
      const delay = Math.max(0, (next - c.currentTime) * 1000)
      window.setTimeout(() => {
        if (playing?.id === id) {
          playing = { id, step: s }
          emit()
        }
      }, delay)
      next += dur
      step = (step + 1) % getPattern().steps
    }
  }
  schedule()
  timer = window.setInterval(schedule, 25)
}

/** Qué ritmo suena y en qué casilla va (para dibujar la línea de avance). */
export function usePlaying(): Playing | null {
  const p = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => playing,
  )
  // Al salir de la pantalla, se calla
  useEffect(() => () => void (playing && stopRhythm()), [])
  return p
}
