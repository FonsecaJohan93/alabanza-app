import type { DrumPart, Dynamic } from '../lib/drums'

// Iconos simples de cada pieza, vistos de frente, para reconocerlos de un vistazo.
const PART_PATHS: Record<DrumPart, React.ReactNode> = {
  // Bombo: tambor grande de frente con el pedal
  bombo: (
    <>
      <circle cx="12" cy="11" r="7.5" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M12 18.5v3M9 21.5h6" />
    </>
  ),
  // Caja: tambor bajo con los bordones
  caja: (
    <>
      <ellipse cx="12" cy="8" rx="8" ry="2.5" />
      <path d="M4 8v7c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V8" />
      <path d="M7 10.3v6M12 10.5v7M17 10.3v6" strokeDasharray="1.5 1.5" />
    </>
  ),
  // Aro: el borde de la caja con la baqueta cruzada
  aro: (
    <>
      <ellipse cx="12" cy="13" rx="8" ry="2.5" />
      <path d="M5 4l9 10" strokeWidth={2.2} />
    </>
  ),
  // Hi-hat: dos platos juntos sobre un soporte
  hihat: (
    <>
      <path d="M4 8.5c2.5-1.6 13.5-1.6 16 0M4 10.5c2.5 1.6 13.5 1.6 16 0" />
      <path d="M12 5v4M12 12v9M9 21h6" />
    </>
  ),
  // Ride: plato grande con campana
  ride: (
    <>
      <path d="M2.5 11c3-2.2 16-2.2 19 0" />
      <path d="M10.3 9.3a1.8 1.8 0 0 1 3.4 0" />
      <path d="M12 11v10M9 21h6" />
    </>
  ),
  // Platos (crash): plato inclinado con destello
  crash: (
    <>
      <path d="M3 13.5c3.5-4 14-6.2 18-4.5" />
      <path d="M12 11.2V21M9 21h6" />
      <path d="M17 3l.6 2M20.5 4.5l-1.4 1.4M14 3.6l1 1.6" />
    </>
  ),
  // Toms: dos tambores medianos
  toms: (
    <>
      <ellipse cx="7.5" cy="9" rx="4.5" ry="1.6" />
      <path d="M3 9v5.5c0 .9 2 1.6 4.5 1.6S12 15.4 12 14.5V9" />
      <ellipse cx="16.5" cy="11" rx="4.5" ry="1.6" />
      <path d="M12 11v5.5c0 .9 2 1.6 4.5 1.6s4.5-.7 4.5-1.6V11" />
    </>
  ),
}

export function PartIcon({ part, size = 20 }: { part: DrumPart; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PART_PATHS[part]}
    </svg>
  )
}

/** Dinámicas con la notación de partitura: p, mf, f, reguladores, corte. */
export function DynamicIcon({ dynamic, size = 20 }: { dynamic: Dynamic; size?: number }) {
  const text = (t: string) => (
    <text x="12" y="16.5" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight="700" fontSize="13" fill="currentColor" stroke="none">
      {t}
    </text>
  )
  const body: Record<Dynamic, React.ReactNode> = {
    suave: text('p'),
    medio: text('mf'),
    fuerte: text('f'),
    crescendo: <path d="M22 6 3 12l19 6" />,
    decrescendo: <path d="M2 6l19 6-19 6" />,
    // Corte: fermata/stop — dos barras verticales
    corte: (
      <>
        <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
        <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      </>
    ),
    // Sin batería: silencio de redonda tachado
    silencio: (
      <>
        <rect x="6" y="9" width="12" height="4" fill="currentColor" stroke="none" />
        <path d="M3 11h18" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {body[dynamic]}
    </svg>
  )
}

/** Ícono de batería para el botón junto al tono. */
export function DrumKitIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="9" rx="8" ry="3" />
      <path d="M4 9v6c0 1.7 3.6 3 8 3s8-1.3 8-3V9" />
      <path d="M8 2.5l3 5.2M16 2.5l-3 5.2" />
    </svg>
  )
}
