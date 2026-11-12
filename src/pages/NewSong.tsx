import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { guessKey, isChordLine, sectionName, textToChordPro } from '../lib/chordsheet'
import { sourceOf, type SearchResult } from '../lib/importers'
import { Button, ErrorBox, Field, Header, inputClass } from '../components/ui'
import type { SongDraft } from '../types'

export const emptyDraft = (): SongDraft => ({ title: '', artist: '', key: '', tags: [], content: '' })

/**
 * Cifra Club copia "Título\nArtista" al principio del texto. Si las dos
 * primeras líneas parecen eso, se sacan de la letra y se usan como datos.
 */
function splitHeader(text: string): { title: string; artist: string; rest: string } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const idx = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0).slice(0, 2)
  const header = (i?: number) => {
    const l = i === undefined ? '' : lines[i].trim()
    return !!l && l.length < 60 && !/[[\]:]/.test(l) && !/\s{3,}/.test(l) && !isChordLine(l) && !sectionName(l)
  }
  // Tras el encabezado viene una línea vacía, de acordes o de sección; si no, es letra
  const startsSong = (l = '') => !l.trim() || isChordLine(l) || !!sectionName(l) || /^\s*\[/.test(l)
  if (idx.length === 2 && header(idx[0]) && header(idx[1]) && startsSong(lines[idx[1] + 1])) {
    return { title: lines[idx[0]].trim(), artist: lines[idx[1]].trim(), rest: lines.slice(idx[1] + 1).join('\n') }
  }
  return { title: '', artist: '', rest: text }
}

export default function NewSong() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const openEditor = (draft: SongDraft) => navigate('/nueva/editar', { state: { draft } })
  const source = url.trim() ? sourceOf(url.trim()) : null

  async function importLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (source !== 'lacuerda') {
      setShowPaste(true)
      return
    }
    setBusy(true)
    try {
      const s = await api.importFromUrl(url.trim())
      openEditor({ ...emptyDraft(), ...s })
    } catch (err) {
      setError((err as Error).message)
      if ((err as api.ApiError).body?.paste) setShowPaste(true)
    } finally {
      setBusy(false)
    }
  }

  function continueWithPaste() {
    const { title, artist, rest } = splitHeader(text)
    const content = textToChordPro(rest)
    openEditor({ ...emptyDraft(), title, artist, content, key: guessKey(content), sourceUrl: url.trim() || undefined })
  }

  return (
    <div className="pb-10">
      <Header title="Agregar canción" back="/repertorio" />
      <div className="space-y-6 px-4 pt-4">
        <OnlineSearch onImport={openEditor} />

        <form onSubmit={importLink} className="space-y-3 rounded-2xl bg-panel p-4">
          <h2 className="font-semibold">Desde un link</h2>
          <Field label="Link de LaCuerda o Cifra Club">
            <input
              className={inputClass}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://acordes.lacuerda.net/…"
              autoCapitalize="none"
            />
          </Field>
          {source === 'cifraclub' && (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-slate-700">
              Cifra Club no deja que la app lea sus páginas. Abre la canción, toca <b>“Imprimir”</b> o selecciona el texto de los acordes, cópialo y pégalo abajo. El link se guarda como fuente.
            </p>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          {source !== 'cifraclub' && (
            <Button type="submit" disabled={!url.trim() || busy} className="w-full">
              {busy ? 'Leyendo la página…' : 'Importar'}
            </Button>
          )}
        </form>

        {(showPaste || source === 'cifraclub' || !url.trim()) && (
          <div className="space-y-3 rounded-2xl bg-panel p-4">
            <h2 className="font-semibold">Pegar el texto</h2>
            <p className="text-sm text-slate-600">Con los acordes encima de la letra, como aparecen en las páginas. La app los acomoda sola.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={'Coro:\nG            D\nCuán grande es Él…'}
              className={`${inputClass} font-mono text-sm`}
              spellCheck={false}
            />
            <Button onClick={continueWithPaste} disabled={!text.trim()} className="w-full">
              Continuar
            </Button>
          </div>
        )}

        <button onClick={() => openEditor(emptyDraft())} className="w-full py-2 text-sm text-slate-600 underline">
          O escribirla desde cero
        </button>
      </div>
    </div>
  )
}

/** Buscar en internet: LaCuerda se importa con un toque; Cifra Club se abre en el navegador. */
function OnlineSearch({ onImport }: { onImport: (d: SongDraft) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(e: FormEvent) {
    e.preventDefault()
    if (q.trim().length < 2) return
    setBusy(true)
    setError(null)
    try {
      setResults(await api.searchOnline(q.trim()))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function pick(r: SearchResult) {
    setImporting(r.url)
    setError(null)
    try {
      const s = await api.importFromUrl(r.url)
      onImport({ ...emptyDraft(), ...s, artist: s.artist || r.artist })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(null)
    }
  }

  const cifra = `https://www.cifraclub.com/?q=${encodeURIComponent(q.trim())}`
  return (
    <section className="space-y-3 rounded-2xl bg-panel p-4">
      <h2 className="font-semibold">Buscar en internet</h2>
      <form onSubmit={search} className="flex gap-2">
        <input
          className={`${inputClass} min-w-0 flex-1`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Título y artista: hay libertad art aguilera"
        />
        <Button type="submit" disabled={busy || q.trim().length < 2}>
          {busy ? '…' : 'Buscar'}
        </Button>
      </form>
      {error && <ErrorBox>{error}</ErrorBox>}
      {results && (
        <div>
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-500 uppercase">En LaCuerda · toca para importar</p>
          {results.length ? (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {results.map((r) => (
                <li key={r.url}>
                  <button onClick={() => pick(r)} disabled={!!importing} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50 disabled:opacity-60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block truncate text-sm text-slate-500">{r.artist}</span>
                    </span>
                    <span className="text-sm font-semibold text-accent">{importing === r.url ? 'Leyendo…' : 'Importar'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No apareció en LaCuerda.</p>
          )}
        </div>
      )}
      {q.trim().length >= 2 && (
        <a href={cifra} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
          <span>
            <b className="text-accent">Buscar en Cifra Club ↗</b>
            <span className="block text-slate-600">Se abre en tu navegador. Copia los acordes y pégalos abajo en “Pegar el texto”, junto con el link.</span>
          </span>
        </a>
      )}
    </section>
  )
}
