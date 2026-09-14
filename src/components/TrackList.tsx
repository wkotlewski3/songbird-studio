import { instrumentById } from '../data/instruments'
import { useRef, type ChangeEvent } from 'react'
import type { Layer, Track, TrackKind } from '../types'
import { useStudio } from '../state/session'

const KIND_COLOR: Record<TrackKind, string> = {
  melody: 'bg-melody',
  drums: 'bg-drums',
  vocals: 'bg-vocals',
}

export function TrackList({
  onFile,
  onRecord,
  recordingId,
  waiting,
}: {
  onFile: (track: Track, layer: Layer, file: File) => void
  onRecord: (track: Track, layer: Layer) => void
  recordingId: string | null
  waiting?: boolean
}) {
  const { session, selectedLayer, select, selectLayer, addTrack, addLayer, removeTrack, removeLayer } = useStudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const pending = useRef<{ track: Track; layer: Layer } | null>(null)

  const pick = (track: Track, layer: Layer) => {
    pending.current = { track, layer }
    fileRef.current?.click()
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const target = pending.current
    e.target.value = ''
    if (file && target) onFile(target.track, target.layer, file)
  }

  return (
    <aside className="flex w-full flex-col gap-3 border-r border-line bg-panel p-4 lg:w-72">
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onChange} />
      <p className="text-xs uppercase tracking-widest text-mute">Tracks</p>
      <div className="flex gap-2">
        {(['melody', 'drums', 'vocals'] as TrackKind[]).map((k) => (
          <button
            key={k}
            onClick={() => addTrack(k)}
            className="flex-1 rounded-full border border-line py-1.5 text-[11px] uppercase tracking-wide text-mist hover:border-gold"
          >
            + {k}
          </button>
        ))}
      </div>
      <ul className="flex flex-1 flex-col gap-2 overflow-auto">
        {session.tracks.map((t) => (
          <li key={t.id} className="rounded-2xl border border-line bg-ink/40 p-2">
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <button onClick={() => select(t.id)} className="flex items-center gap-2 text-sm text-white">
                <span className={`h-2 w-2 rounded-full ${KIND_COLOR[t.kind]}`} />
                {t.name}
              </button>
              <button className="text-mute hover:text-drums" onClick={() => removeTrack(t.id)}>
                ×
              </button>
            </div>
            <ul className="mt-1 flex flex-col gap-1">
              {t.layers.map((layer) => (
                <li key={layer.id}>
                  <div
                    className={`rounded-xl px-2 py-2 ${
                      selectedLayer?.id === layer.id ? 'bg-panel-2 ring-1 ring-gold' : 'hover:bg-panel'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button onClick={() => selectLayer(t.id, layer.id)} className="min-w-0 flex-1 text-left">
                        <p className="text-xs text-white">{layer.name}</p>
                        <p className="truncate text-[11px] text-gold/80">{instrumentById(layer.instrumentId).label}</p>
                        <p className="truncate text-[11px] text-mute">{layer.status}</p>
                      </button>
                      {t.layers.length > 1 && (
                        <button
                          type="button"
                          className="shrink-0 px-1 text-mute hover:text-drums"
                          title="Remove this layer"
                          onClick={() => removeLayer(t.id, layer.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {layer.transcribing && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-gold" style={{ width: `${Math.round(layer.progress * 100)}%` }} />
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          pick(t, layer)
                        }}
                        className="rounded-full border border-line px-2 py-1 text-[11px] text-mist hover:border-gold"
                      >
                        Upload
                      </span>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRecord(t, layer)
                        }}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          recordingId === layer.id
                            ? 'border-drums text-drums'
                            : 'border-line text-mist hover:border-gold'
                        }`}
                      >
                        {recordingId === layer.id ? (waiting ? 'Count-in' : 'Stop') : 'Record'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={() => addLayer(t.id)}
              className="mt-2 w-full rounded-full border border-dashed border-line py-1 text-[11px] text-mute hover:border-gold hover:text-gold"
            >
              + Layer on {t.name}
            </button>
          </li>
        ))}
        {!session.tracks.length && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-mute">
            Record live or drop a raw file. SongBird hears melody, beat, or vocal and cleans it onto the grid.
          </p>
        )}
      </ul>
    </aside>
  )
}

