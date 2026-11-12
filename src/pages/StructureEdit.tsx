import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { parseChordPro } from '../lib/chordsheet'
import { applyLyrics, lyricsOf, moveBlock, newId, parseStructure, renames, serializeStructure, type Block } from '../lib/structure'
import { saveSong, useSong, useStore } from '../lib/store'
import { CUE_PRESETS, CuePill } from '../components/Cue'
import { Button, ErrorBox, Header } from '../components/ui'
import type { Song } from '../types'

const SECTION_NAMES = ['Intro', 'Estrofa 1', 'Estrofa 2', 'Pre-coro', 'Coro', 'Puente', 'Interludio', 'Final']

/** Solo el texto de la letra de una sección (sin acordes). */
const lyricLines = (body: string[]) =>
  parseChordPro(body.join('\n')).flatMap((l) =>
    l.type === 'lyrics'
      ? [
          l.parts
            .map((p) => p.text)
            .join('')
            .trim(),
        ]
      : l.type === 'empty'
        ? ['']
        : [],
  )

export default function StructureEdit() {
  const { id } = useParams()
  const song = useSong(id)
  const loaded = useStore((s) => s.loaded)
  if (!song)
    return (
      <div>
        <Header title="Editar letra y orden" back="/" />
        <p className="p-8 text-center text-slate-500">{loaded ? 'Esa canción no existe o fue borrada.' : 'Cargando…'}</p>
      </div>
    )
  // La key reinicia el editor si alguien más guardó la canción
  return <Editor key={song.updatedAt} song={song} />
}

function Editor({ song }: { song: Song }) {
  const navigate = useNavigate()
  const [blocks, setBlocks] = useState<Block[]>(() => parseStructure(song.content))
  const original = useMemo(() => serializeStructure(parseStructure(song.content)), [song.content])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [editingLyrics, setEditingLyrics] = useState<{ id: string; text: string } | null>(null)
  const [adding, setAdding] = useState<'cue' | 'section' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = serializeStructure(blocks) !== original || renames(blocks).size > 0
  const update = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allCollapsed = blocks.length > 0 && blocks.every((b) => b.kind === 'cue' || collapsed.has(b.id))

  // ---- arrastrar con el dedo (o el mouse) desde la manija ⠿
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const [drag, setDrag] = useState<{ from: number; startY: number; y: number; target: number; mids: number[] } | null>(null)

  function startDrag(e: RPointerEvent, index: number) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const mids = blocks.map((b) => {
      const r = itemRefs.current.get(b.id)?.getBoundingClientRect()
      return r ? r.top + r.height / 2 : 0
    })
    setDrag({ from: index, startY: e.clientY, y: e.clientY, target: index, mids })
  }
  function moveDrag(e: RPointerEvent) {
    if (!drag) return
    const y = e.clientY
    const target = drag.mids.filter((m, i) => i !== drag.from && m < y).length
    // target cuenta los demás bloques por encima; se pasa a índice de inserción en la lista original
    const insert = target >= drag.from ? target + 1 : target
    setDrag({ ...drag, y, target: insert })
  }
  function endDrag() {
    if (!drag) return
    if (drag.target !== drag.from && drag.target !== drag.from + 1) setBlocks((bs) => moveBlock(bs, drag.from, drag.target))
    setDrag(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const content = serializeStructure(blocks)
      // Si una sección cambió de nombre, su indicación de batería la sigue
      const map = renames(blocks)
      const drums =
        song.drums && map.size
          ? { ...song.drums, sections: song.drums.sections.map((s) => ({ ...s, name: map.get(s.name) ?? s.name })) }
          : song.drums
      await saveSong({ ...song, content, drums }, song)
      navigate(`/cancion/${song.id}/voces`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function addBlock(kind: 'cue' | 'section', name: string) {
    const b: Block = kind === 'cue' ? { id: newId(), kind, name, body: [] } : { id: newId(), kind, name, origName: '', body: [] }
    setBlocks((bs) => [...bs, b])
    setAdding(null)
    if (kind === 'section') setEditingLyrics({ id: b.id, text: '' })
  }

  return (
    <div className="pb-32" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <Header
        title="Letra y orden"
        back={`/cancion/${song.id}/voces`}
        actions={
          <button
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(blocks.map((b) => b.id)))}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent active:bg-accent-soft"
          >
            {allCollapsed ? 'Expandir todo' : 'Colapsar todo'}
          </button>
        }
      />
      <p className="px-4 pt-3 text-sm text-slate-500">
        <b className="text-slate-700">{song.title}</b> · Toca una sección para colapsarla. Arrastra con <b>⠿</b> para cambiar el orden. Los
        cambios son para todo el equipo.
      </p>

      <ol className="space-y-3 px-4 pt-3 md:landscape:mx-auto md:landscape:max-w-3xl">
        {blocks.map((b, i) => {
          const isDragged = drag?.from === i
          const showLineBefore = drag && drag.target === i && drag.target !== drag.from && drag.target !== drag.from + 1
          const style = isDragged
            ? { transform: `translateY(${drag.y - drag.startY}px)`, zIndex: 20, position: 'relative' as const }
            : undefined
          const handle = (
            <button
              onPointerDown={(e) => startDrag(e, i)}
              className="grid h-9 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-lg text-slate-400 active:cursor-grabbing active:bg-black/5"
              aria-label="Arrastrar para mover"
            >
              ⠿
            </button>
          )
          const moveBtns = (
            <>
              <button
                onClick={() => setBlocks((bs) => moveBlock(bs, i, i - 1))}
                disabled={i === 0}
                className="px-1.5 text-slate-500 disabled:opacity-25"
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                onClick={() => setBlocks((bs) => moveBlock(bs, i, i + 2))}
                disabled={i === blocks.length - 1}
                className="px-1.5 text-slate-500 disabled:opacity-25"
                aria-label="Bajar"
              >
                ↓
              </button>
            </>
          )
          return (
            <li
              key={b.id}
              ref={(el) => void (el ? itemRefs.current.set(b.id, el) : itemRefs.current.delete(b.id))}
              style={style}
              className={isDragged ? 'opacity-90 shadow-2xl' : ''}
            >
              {showLineBefore && <div className="mb-2 h-1 rounded-full bg-accent" />}
              {b.kind === 'cue' ? (
                <div className="flex items-center gap-1">
                  {handle}
                  {renaming === b.id ? (
                    <NameInput value={b.name} onDone={(name) => (update(b.id, { name: name || b.name }), setRenaming(null))} />
                  ) : (
                    <button onClick={() => setRenaming(b.id)} className="min-w-0" title="Cambiar texto">
                      <CuePill text={b.name} />
                    </button>
                  )}
                  <div className="flex-1" />
                  {moveBtns}
                  <button
                    onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                    className="px-1.5 text-red-600"
                    aria-label="Quitar indicador"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <section className="relative rounded-2xl border-2 border-accent/30 bg-white pt-3 shadow-sm">
                  {/* Nombre de la sección sobre el borde del marco */}
                  <div className="absolute -top-3 left-3 flex items-center">
                    {renaming === b.id ? (
                      <NameInput
                        value={b.name}
                        suggestions={SECTION_NAMES}
                        onDone={(name) => (update(b.id, { name }), setRenaming(null))}
                      />
                    ) : (
                      <button
                        onClick={() => setRenaming(b.id)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase ${b.name ? 'bg-accent text-white' : 'bg-amber-100 text-amber-800'}`}
                        title="Cambiar nombre"
                      >
                        {b.name || 'Sin nombre · ponle uno'} ✎
                      </button>
                    )}
                  </div>
                  <div className="flex items-start gap-1 px-2">
                    {handle}
                    <div className="min-w-0 flex-1 cursor-pointer py-1.5" onClick={() => editingLyrics?.id !== b.id && toggle(b.id)}>
                      {editingLyrics?.id === b.id ? null : collapsed.has(b.id) ? (
                        <p className="truncate text-sm text-slate-400">
                          {lyricLines(b.body).find(Boolean) ?? 'Instrumental'} · {lyricLines(b.body).filter(Boolean).length} líneas
                        </p>
                      ) : lyricLines(b.body).some(Boolean) ? (
                        <div className="text-[17px] leading-snug">
                          {lyricLines(b.body).map((l, k) => (l ? <p key={k}>{l}</p> : <div key={k} className="h-2" />))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">♪ Instrumental (solo acordes)</p>
                      )}
                    </div>
                  </div>
                  {editingLyrics?.id === b.id && (
                    <div className="px-3 pb-2">
                      <p className="mb-1 text-xs text-slate-500">
                        Corrige la letra. Los acordes no se ven aquí, pero se quedan en su lugar.
                      </p>
                      <textarea
                        autoFocus
                        value={editingLyrics.text}
                        onChange={(e) => setEditingLyrics({ id: b.id, text: e.target.value })}
                        rows={Math.max(4, editingLyrics.text.split('\n').length + 1)}
                        className="w-full rounded-xl border border-line bg-ink/50 p-2 text-[17px] leading-snug outline-none focus:border-accent"
                      />
                      <div className="mt-1.5 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditingLyrics(null)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => {
                            update(b.id, { body: applyLyrics(b.body, editingLyrics.text) })
                            setEditingLyrics(null)
                          }}
                        >
                          Listo
                        </Button>
                      </div>
                    </div>
                  )}
                  {!collapsed.has(b.id) && (
                    <div className="mt-1 flex items-center gap-0.5 border-t border-line px-2 py-1 text-sm">
                      <button
                        onClick={() => setEditingLyrics({ id: b.id, text: lyricsOf(b.body) })}
                        className="rounded-lg px-2 py-1 font-semibold text-accent active:bg-accent-soft"
                      >
                        ✎ Letra
                      </button>
                      <button
                        onClick={() => setBlocks((bs) => [...bs.slice(0, i + 1), { ...b, id: newId(), origName: '' }, ...bs.slice(i + 1)])}
                        className="rounded-lg px-2 py-1 text-slate-600 active:bg-black/5"
                      >
                        ⧉ Duplicar
                      </button>
                      <div className="flex-1" />
                      {moveBtns}
                      <button
                        onClick={() =>
                          confirm(`¿Eliminar "${b.name || 'esta sección'}"?`) && setBlocks((bs) => bs.filter((x) => x.id !== b.id))
                        }
                        className="rounded-lg px-2 py-1 text-red-600 active:bg-red-50"
                        aria-label="Eliminar sección"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </section>
              )}
            </li>
          )
        })}
        {drag && drag.target === blocks.length && drag.from !== blocks.length - 1 && <li className="h-1 rounded-full bg-accent" />}
      </ol>

      <div className="space-y-2 px-4 pt-4">
        {adding === 'cue' ? (
          <Chooser
            options={CUE_PRESETS}
            placeholder="Otro indicador…"
            onPick={(t) => addBlock('cue', t)}
            onCancel={() => setAdding(null)}
          />
        ) : adding === 'section' ? (
          <Chooser
            options={SECTION_NAMES}
            placeholder="Otro nombre…"
            onPick={(t) => addBlock('section', t)}
            onCancel={() => setAdding(null)}
          />
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setAdding('section')}>
              + Sección
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => setAdding('cue')}>
              + Indicador
            </Button>
          </div>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="ghost" className="flex-1" disabled={!dirty || busy} onClick={() => setBlocks(parseStructure(song.content))}>
            Deshacer cambios
          </Button>
          <Button className="flex-[2]" disabled={!dirty || busy} onClick={save}>
            {busy ? 'Guardando…' : dirty ? 'Guardar para todos' : 'Sin cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NameInput({ value, suggestions, onDone }: { value: string; suggestions?: string[]; onDone: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onDone(v.trim())
      }}
      className="flex items-center gap-1 rounded-full bg-white p-0.5 shadow ring-2 ring-accent"
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onDone(v.trim())}
        list={suggestions ? 'section-names' : undefined}
        className="w-36 rounded-full px-2 py-0.5 text-sm outline-none"
        placeholder="Nombre"
      />
      {suggestions && (
        <datalist id="section-names">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </form>
  )
}

function Chooser({
  options,
  placeholder,
  onPick,
  onCancel,
}: {
  options: string[]
  placeholder: string
  onPick: (t: string) => void
  onCancel: () => void
}) {
  const [custom, setCustom] = useState('')
  return (
    <div className="rounded-2xl bg-panel p-3">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => onPick(o)} className="rounded-full bg-black/5 px-3 py-1 text-sm active:bg-black/10">
            {o}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) onPick(custom.trim())
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" disabled={!custom.trim()} className="py-1.5">
          Agregar
        </Button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-slate-500">
          Cancelar
        </button>
      </form>
    </div>
  )
}
