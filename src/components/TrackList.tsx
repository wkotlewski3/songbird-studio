import { useRef, type ChangeEvent } from 'react'
import type { Track, TrackKind } from '../types'
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
}: {
  onFile: (track: Track, file: File) => void
  onRecord: (track: Track) => void
  recordingId: string | null
}) {
  const { session, selected, select, addTrack, removeTrack } = useStudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const pending = useRef<Track | null>(null)

  const pick = (track: Track) => {
    pending.current = track
    fileRef.current?.click()
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const track = pending.current
    e.target.value = ''
    if (file && track) onFile(track, file)
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
          <li key={t.id}>
            <button
              onClick={() => select(t.id)}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${
                selected?.id === t.id ? 'border-gold bg-panel-2' : 'border-line bg-ink/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-white">
                  <span className={`h-2 w-2 rounded-full ${KIND_COLOR[t.kind]}`} />
                  {t.name}
                </span>
                <button
                  className="text-mute hover:text-drums"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTrack(t.id)
                  }}
                >
                  ×
                </button>
              </div>
              <p className="mt-1 truncate text-xs text-mute">{t.status}</p>
              {t.transcribing && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-gold" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    pick(t)
                  }}
                  className="rounded-full border border-line px-2 py-1 text-[11px] text-mist hover:border-gold"
                >
                  Upload
                </span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRecord(t)
                  }}
                  className={`rounded-full border px-2 py-1 text-[11px] ${
                    recordingId === t.id
                      ? 'border-drums text-drums'
                      : 'border-line text-mist hover:border-gold'
                  }`}
                >
                  {recordingId === t.id ? 'Stop' : 'Record'}
                </span>
              </div>
            </button>
          </li>
        ))}
        {!session.tracks.length && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-mute">
            Add a melody, drum, or vocal track to begin.
          </p>
        )}
      </ul>
    </aside>
  )
}
