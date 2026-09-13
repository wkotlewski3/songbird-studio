import { useEffect, useRef, useState } from 'react'
import type { Track } from '../types'
import { decodeFile } from '../audio/context'
import { transcribeDrums } from '../audio/drums'
import { transcribeMelody } from '../audio/melody'
import {
  getTrackBuffer,
  playSession,
  playbackTime,
  preloadInstrument,
  sessionDuration,
  setTrackBuffer,
  stopSession,
} from '../audio/engine'
import { recordUntilStop } from '../audio/record'
import { useStudio } from '../state/session'
import { BirdMark } from './BirdMark'
import { CommandBar } from './CommandBar'
import { ExportModal } from './ExportModal'
import { Inspector } from './Inspector'
import { MasteringDesk } from './MasteringDesk'
import { PianoRoll } from './PianoRoll'
import { TrackList } from './TrackList'
import { Waveform } from './Waveform'

export function Studio({ onHome }: { onHome: () => void }) {
  const { session, setSession, selected, updateTrack, notify } = useStudio()
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPreset, setExportPreset] = useState<'mp3' | 'wav' | 'midi'>('mp3')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const recRef = useRef<{ stop: () => Promise<Blob> } | null>(null)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const t = playbackTime()
      setPlayhead(t)
      if (t >= sessionDuration(session)) {
        stopSession()
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, session])

  const ingest = async (track: Track, file: Blob, label?: string) => {
    updateTrack(track.id, { transcribing: true, progress: 0.05, status: 'Decoding audio…' })
    try {
      const buffer = await decodeFile(file)
      setTrackBuffer(track.id, buffer)
      if (track.kind === 'vocals') {
        updateTrack(track.id, {
          duration: buffer.duration,
          transcribing: false,
          progress: 1,
          status: label ?? 'Vocal take ready — pick a role',
        })
        notify('Vocal loaded. Choose lead, verse, or chorus in the inspector.')
        return
      }
      if (track.kind === 'drums') {
        updateTrack(track.id, { status: 'Reading hits…', progress: 0.2 })
        const drums = transcribeDrums(buffer, (p) => updateTrack(track.id, { progress: 0.2 + p * 0.8 }))
        updateTrack(track.id, {
          drums,
          notes: [],
          duration: buffer.duration,
          transcribing: false,
          progress: 1,
          status: `${drums.length} hits · feel preserved`,
        })
        notify(`Mapped ${drums.length} hits to the kit. Timing is unquantized so the groove stays yours.`)
        return
      }
      updateTrack(track.id, { status: 'Tracing pitch & emotion…', progress: 0.2 })
      const { notes, bpm } = transcribeMelody(buffer, (p) =>
        updateTrack(track.id, { progress: 0.2 + p * 0.8 }),
      )
      updateTrack(track.id, {
        notes,
        drums: [],
        duration: buffer.duration,
        transcribing: false,
        progress: 1,
        status: `${notes.length} notes · ${bpm} BPM feel`,
      })
      setSession((s) => ({
        ...s,
        meta: { ...s.meta, bpm: s.tracks.length <= 1 ? bpm : s.meta.bpm },
      }))
      void preloadInstrument(track.instrumentId)
      notify(`${notes.length} notes captured. Velocities follow how hard you hummed.`)
    } catch (err) {
      updateTrack(track.id, {
        transcribing: false,
        status: err instanceof Error ? err.message : 'Could not read that file',
      })
    }
  }

  const onRecord = async (track: Track) => {
    if (recordingId === track.id && recRef.current) {
      const blob = await recRef.current.stop()
      recRef.current = null
      setRecordingId(null)
      await ingest(track, blob, 'Recorded take')
      return
    }
    try {
      recRef.current = await recordUntilStop()
      setRecordingId(track.id)
      updateTrack(track.id, { status: 'Recording… tap Stop when you are done' })
    } catch {
      notify('Microphone permission is needed to record.')
    }
  }

  const togglePlay = async () => {
    if (playing) {
      stopSession()
      setPlaying(false)
      return
    }
    try {
      notify('Loading sounds…')
      await playSession(session)
      setPlaying(true)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not play')
    }
  }

  const buffer = selected ? getTrackBuffer(selected.id) : undefined

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-panel px-4 py-3">
        <button onClick={onHome} className="flex items-center gap-2">
          <BirdMark className="h-8 w-8" />
          <span className="font-display text-gold">SongBird</span>
        </button>
        <input
          value={session.meta.title}
          onChange={(e) => setSession({ ...session, meta: { ...session.meta, title: e.target.value } })}
          className="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-white outline-none focus:border-line"
        />
        <input
          value={session.meta.artist}
          onChange={(e) => setSession({ ...session, meta: { ...session.meta, artist: e.target.value } })}
          placeholder="Artist"
          className="w-36 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-mist outline-none focus:border-line"
        />
        <label className="flex items-center gap-2 text-xs text-mute">
          BPM
          <input
            type="number"
            value={session.meta.bpm}
            onChange={(e) =>
              setSession({ ...session, meta: { ...session.meta, bpm: Number(e.target.value) || 92 } })
            }
            className="w-16 rounded-lg border border-line bg-ink px-2 py-1 text-mist"
          />
        </label>
        <button
          onClick={() => void togglePlay()}
          className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink"
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <div className="min-w-[280px] flex-1">
          <CommandBar
            onExport={(format) => {
              setExportPreset(format)
              setExportOpen(true)
            }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <TrackList onFile={(t, f) => void ingest(t, f)} onRecord={(t) => void onRecord(t)} recordingId={recordingId} />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          {selected ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-mute">{selected.kind}</p>
                <h2 className="font-display text-3xl text-white">{selected.name}</h2>
                <p className="text-sm text-mute">{selected.status}</p>
              </div>
              {selected.kind === 'vocals' ? (
                <Waveform buffer={buffer} />
              ) : (
                <PianoRoll
                  notes={selected.notes}
                  drums={selected.drums}
                  duration={selected.duration || 4}
                  playhead={playing ? playhead : 0}
                />
              )}
              {selected.kind !== 'vocals' && buffer && <Waveform buffer={buffer} color="#e8b86d" />}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-line text-mute">
              Add a track, then hum, tap, or drop a file.
            </div>
          )}
        </main>
        <Inspector />
      </div>
      <MasteringDesk
        onExport={() => {
          setExportPreset('mp3')
          setExportOpen(true)
        }}
      />
      <ExportModal
        open={exportOpen}
        preset={exportPreset}
        onClose={() => setExportOpen(false)}
      />
      <Toast />
    </div>
  )
}

function Toast() {
  const { toast } = useStudio()
  if (!toast) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-40 max-w-lg -translate-x-1/2 rounded-full border border-gold/40 bg-panel px-5 py-3 text-sm text-mist shadow-2xl">
      {toast}
    </div>
  )
}
