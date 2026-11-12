// Indicadores para el equipo entre párrafos: "Otra vez al coro", "Solo instrumental"…

export const CUE_PRESETS = ['Otra vez al coro', 'Otra vez al puente', 'Solo instrumental', 'Repetir', 'Más suave', 'Todos juntos', 'Final']

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Ícono según lo que dice el indicador. */
function cueIcon(text: string): string {
  const t = fold(text)
  if (/instrumental|solo musica|interludio/.test(t)) return '♪'
  if (/otra vez|volver|de nuevo|repet|x\s?\d|\d\s?x|bis/.test(t)) return '↻'
  if (/final|termina|fin\b|corte/.test(t)) return '■'
  if (/suave|baja|despacio/.test(t)) return '↘'
  if (/sube|fuerte|todos|crescendo/.test(t)) return '↗'
  return '➜'
}

export function CuePill({ text, size = 'md', onRemove }: { text: string; size?: 'md' | 'lg'; onRemove?: () => void }) {
  return (
    <div
      className={`my-2 inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-amber-50 font-semibold text-amber-900 ${
        size === 'lg' ? 'px-4 py-1.5 text-[0.75em]' : 'px-3 py-0.5 text-sm'
      }`}
    >
      <span aria-hidden="true">{cueIcon(text)}</span>
      {text}
      {onRemove && (
        <button onClick={onRemove} className="-mr-1 grid h-6 w-6 place-items-center rounded-full text-sm text-amber-700 active:bg-amber-200" aria-label={`Quitar "${text}"`}>
          ✕
        </button>
      )}
    </div>
  )
}
