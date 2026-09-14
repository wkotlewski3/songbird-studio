import { useEffect, useRef, useState } from 'react'
import { sketchLooksKept, type SketchSummary } from '../state/persist'
import { useStudio } from '../state/session'

function when(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 20_000) return 'Just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function SessionsModal({
  open,
  onClose,
  studio,
}: {
  open: boolean
  onClose: () => void
  studio: { loop: { start: number; end: number } | null; loopOn: boolean; clickOn: boolean; countIn: boolean }
}) {
  const {
    projectId,
    listSketches,
    openSketch,
    deleteSketch,
    downloadSketch,
    importSketch,
    duplicateSketch,
    newSketch,
    saveSketch,
    notify,
  } = useStudio()
  const [rows, setRows] = useState<SketchSummary[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    try {
      setRows(await listSketches())
    } catch {
      setRows([])
    }
  }

  useEffect(() => {
    if (open) void refresh()
  }, [open])

  if (!open) return null

  const visible = rows.filter((row) => row.id === projectId || sketchLooksKept(row))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(36rem,88dvh)] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-panel p-5 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sessions-title"
      >
        <h2 id="sessions-title" className="font-display text-2xl text-white">
          Sessions
        </h2>
        <p className="mt-1 text-sm text-mute">
          Sketches stay in this browser as you work. Export is only for MP3, WAV, or MIDI — you do not need it to keep
          a session.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void saveSketch(studio).then(() => {
                notify('Sketch saved in this browser.')
                void refresh()
              })
            }}
            className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink"
          >
            Save this sketch
          </button>
          <button
            type="button"
            onClick={() => void downloadSketch(studio)}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
          >
            Save copy to disk
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
          >
            Open file
          </button>
          <button
            type="button"
            onClick={() => {
              void saveSketch(studio).then(() => newSketch()).then(onClose)
            }}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
          >
            New sketch
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".songbird,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              void importSketch(file).then(onClose)
            }}
          />
        </div>
        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto">
          {visible.length === 0 && (
            <li className="rounded-2xl border border-dashed border-line p-4 text-sm text-mute">
              Nothing stored yet. Record or drop a take — it will appear here automatically.
            </li>
          )}
          {visible.map((row) => (
            <li
              key={row.id}
              className={`rounded-2xl border p-3 ${
                row.id === projectId ? 'border-gold/60 bg-gold/10' : 'border-line'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white">{row.title}</p>
                  <p className="text-xs text-mute">
                    {row.artist ? `${row.artist} · ` : ''}
                    {row.bpm} BPM · {row.tracks} track{row.tracks === 1 ? '' : 's'} · {when(row.savedAt)}
                    {row.id === projectId ? ' · open' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {row.id !== projectId && (
                    <button
                      type="button"
                      onClick={() => void openSketch(row.id).then(onClose)}
                      className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mist hover:border-gold"
                    >
                      Open
                    </button>
                  )}
                  {row.id === projectId && (
                    <button
                      type="button"
                      onClick={() => void duplicateSketch(studio).then(() => void refresh())}
                      className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mist hover:border-gold"
                    >
                      Duplicate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Delete “${row.title}”? This only removes it from this browser.`)) return
                      void deleteSketch(row.id).then(() => void refresh())
                    }}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute hover:border-drums hover:text-drums"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
