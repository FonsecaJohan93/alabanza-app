import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { chordProToText, guessKey, semitonesBetween, sharpKey, textToChordPro, transposeChordPro } from '../lib/chordsheet'
import { upcomingSunday, useService } from '../lib/service'
import { ApiError } from '../lib/api'
import { acceptRemote, removeSong, saveSong, useMe, useSong, useSongs } from '../lib/store'
import { ChordSheet } from '../components/ChordSheet'
import { Button, ErrorBox, Field, Header, inputClass, TEMPO_LABEL } from '../components/ui'
import type { Song, SongDraft, Tempo } from '../types'
import { emptyDraft } from './NewSong'

type Mode = 'arriba' | 'chordpro'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function SongEdit() {
  const { id } = useParams()
  const existing = useSong(id)
  const location = useLocation()
  const incoming = (location.state as { draft?: SongDraft } | null)?.draft

  if (id && !existing) return <Navigate to="/" replace />
  // La key fuerza a empezar de cero si cambia la canción que se edita
  return <Editor key={existing?.updatedAt ?? 'nueva'} existing={existing} initial={existing ?? incoming ?? emptyDraft()} />
}

function Editor({ existing, initial }: { existing?: Song; initial: SongDraft }) {
  const navigate = useNavigate()
  const allSongs = useSongs()
  const [draft, setDraft] = useState<SongDraft>(() => ({ ...initial, key: sharpKey(initial.key) }))
  const { isDirector } = useMe()
  // Si la canción está en la lista del domingo, ahí está el tono en que suena
  const sunday = useService(upcomingSunday())
  const sundayItem = existing ? sunday.service?.items.find((i) => i.songId === existing.id) : undefined
  const keyChanged = !!existing && draft.key !== sharpKey(initial.key)
  const [mode, setMode] = useState<Mode>('arriba')
  const [body, setBody] = useState(() => chordProToText(initial.content))
  const [tagText, setTagText] = useState(initial.tags.join(', '))
  const [tab, setTab] = useState<'editar' | 'vista'>('editar')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof SongDraft>(k: K, v: SongDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const content = mode === 'arriba' ? textToChordPro(body) : body
  const tags = tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

  const knownTags = useMemo(() => {
    const s = new Set<string>()
    allSongs.forEach((x) => x.tags.forEach((t) => s.add(t)))
    return [...s].filter((t) => !tags.includes(t)).sort()
  }, [allSongs, tags])

  const duplicate = useMemo(
    () => (draft.title ? allSongs.find((s) => s.id !== existing?.id && fold(s.title) === fold(draft.title)) : undefined),
    [allSongs, draft.title, existing?.id],
  )

  function switchMode(m: Mode) {
    if (m === mode) return
    setBody(m === 'arriba' ? chordProToText(body) : textToChordPro(body))
    setMode(m)
  }

  /** Reescribe todos los acordes en otro tono (cambia la hoja guardada). */
  function changeKey(newKey: string) {
    const from = draft.key || guessKey(content)
    const semis = from && newKey ? semitonesBetween(from, newKey) : 0
    if (semis) {
      const moved = transposeChordPro(content, semis, newKey)
      setBody(mode === 'arriba' ? chordProToText(moved) : moved)
    }
    set('key', newKey)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const song = await saveSong({ ...draft, tags, content, key: draft.key || guessKey(content) }, existing)
      // Dirección cambió el tono: el domingo también pasa a ese tono (un solo tono definitivo)
      if (isDirector && keyChanged && sundayItem && sunday.service && sharpKey(sundayItem.key ?? '') !== draft.key) {
        await sunday.save(sunday.service.items.map((i) => (i.songId === song.id ? { ...i, key: draft.key || undefined } : i)))
      }
      navigate(`/cancion/${song.id}`, { replace: true })
    } catch (e) {
      const err = e as ApiError
      setError(err.message)
      // Alguien más la cambió: se guarda su versión y se avisa (tu texto sigue aquí)
      if (err.status === 409 && err.body.song) acceptRemote(err.body.song as Song)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing || !confirm(`¿Borrar “${existing.title}” del repertorio?`)) return
    try {
      await removeSong(existing.id)
      navigate('/repertorio', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const keyOptions = [...KEYS, ...KEYS.map((k) => k + 'm')]

  return (
    <div className="pb-28">
      <Header title={existing ? 'Editar canción' : 'Nueva canción'} back={existing ? `/cancion/${existing.id}` : '/nueva'} />
      <div className="space-y-4 px-4 pt-4">
        <div className="space-y-3 rounded-2xl bg-panel p-4">
          <Field label="Título">
            <input className={inputClass} value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          {duplicate && <p className="text-sm text-amber-700">Ya existe “{duplicate.title}” ({duplicate.artist || 'sin artista'}) en el repertorio.</p>}
          <Field label="Artista">
            <input className={inputClass} value={draft.artist} onChange={(e) => set('artist', e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tono">
              <select className={inputClass} value={draft.key} onChange={(e) => changeKey(e.target.value)}>
                <option value="">—</option>
                {draft.key && !keyOptions.includes(draft.key) && <option value={draft.key}>{draft.key}</option>}
                {keyOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ritmo">
              <select className={inputClass} value={draft.tempo ?? ''} onChange={(e) => set('tempo', (e.target.value || undefined) as Tempo | undefined)}>
                <option value="">—</option>
                {Object.entries(TEMPO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="BPM">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.bpm ?? ''}
                onChange={(e) => set('bpm', Number(e.target.value.replace(/\D/g, '')) || undefined)}
              />
            </Field>
          </div>
          <p className="-mt-1 text-xs text-slate-500">Cambiar el tono reescribe todos los acordes de la hoja.</p>
          {sundayItem?.key && sharpKey(sundayItem.key) !== draft.key && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              En la lista del domingo esta canción suena en <b>{sharpKey(sundayItem.key)}</b>.{' '}
              {isDirector
                ? keyChanged
                  ? `Al guardar, el domingo pasará a ${draft.key}.`
                  : 'Si cambias el tono aquí, el domingo también cambia.'
                : 'El tono del domingo lo cambia Dirección.'}
            </p>
          )}
          <Field label="Temas" hint="Separados por coma: gracia, cruz, adoración…">
            <input className={inputClass} value={tagText} onChange={(e) => setTagText(e.target.value)} />
          </Field>
          {knownTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {knownTags.slice(0, 15).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagText([...tags, t].join(', '))}
                  className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs text-slate-600 active:bg-black/10"
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Letra y acordes */}
        <div className="rounded-2xl bg-panel p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 rounded-xl bg-black/5 p-1 text-sm font-medium">
              {(['editar', 'vista'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-1.5 ${tab === t ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                  {t === 'editar' ? 'Editar' : 'Vista previa'}
                </button>
              ))}
            </div>
          </div>
          {tab === 'editar' ? (
            <>
              {existing && (
                <Link to={`/cancion/${existing.id}/estructura`} className="mb-2 flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
                  Ordenar y editar por secciones (arrastrar) <span aria-hidden="true">→</span>
                </Link>
              )}
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>{mode === 'arriba' ? 'Acordes en la línea de arriba' : 'ChordPro: [G] antes de la sílaba'}</span>
                <button onClick={() => switchMode(mode === 'arriba' ? 'chordpro' : 'arriba')} className="text-accent underline">
                  {mode === 'arriba' ? 'Usar ChordPro' : 'Usar acordes arriba'}
                </button>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={Math.min(30, Math.max(12, body.split('\n').length + 2))}
                className={`${inputClass} font-mono text-[13px] leading-snug whitespace-pre`}
                wrap="off"
                spellCheck={false}
                placeholder={mode === 'arriba' ? 'Coro:\nG            D\nCuán grande es Él' : '{c: Coro}\n[G]Cuán grande es [D]Él'}
              />
              <p className="mt-2 text-xs text-slate-500">
                Secciones: escribe “Coro:”, “Verso 2:”, “Puente:” en su propia línea. Usa letra monoespaciada para alinear: cada acorde va justo encima de la sílaba.
              </p>
            </>
          ) : (
            <ChordSheet content={content} />
          )}
        </div>

        <Field label="Notas para el equipo">
          <textarea className={inputClass} rows={2} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Ej.: entrar solo con piano, coro final x3" />
        </Field>
        <Field label="Link de YouTube o Spotify">
          <input className={inputClass} type="url" value={draft.youtube ?? ''} onChange={(e) => set('youtube', e.target.value)} />
        </Field>
        <Field label="Fuente de los acordes">
          <input className={inputClass} type="url" value={draft.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value)} />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}
        {existing && (
          <Button variant="danger" onClick={remove} className="w-full">
            Borrar canción
          </Button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-ink/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl">
          <Button onClick={save} disabled={busy || !draft.title.trim()} className="w-full py-3">
            {busy ? 'Guardando…' : !draft.title.trim() ? 'Falta el título' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
