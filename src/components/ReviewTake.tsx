import { useEffect, useMemo } from 'react'
import type { Layer, Track, TranscribeSettings } from '../types'
import {
  getLayerBuffer,
  previewInterpretation,
  previewOriginal,
  stopSession,
  type LoopRange,
} from '../audio/engine'
import { revoiceLayer } from '../audio/revoice'
import { useStudio } from '../state/session'
import { PianoRoll } from './PianoRoll'
import { Timeline } from './Timeline'
import { Visualizer } from './Visualizer'
import { Waveform } from './Waveform'

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-mute">
      <span className="flex justify-between text-mist">
        {label}
        <span className="text-gold">{value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </span>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span>{hint}</span>
    </label>
  )
}

export function ReviewTake({
  track,
  layer,
  playhead,
  loop,
  loopOn,
  onSeek,
  onScrub,
  onLoop,
  onLoopOn,
  onPlaying,
  onPreview,
}: {
  track: Track
  layer: Layer
  playhead: number
  loop: LoopRange | null
  loopOn: boolean
  onSeek: (t: number) => void
  onScrub: (t: number) => void
  onLoop: (range: LoopRange | null) => void
  onLoopOn: (on: boolean) => void
  onPlaying: (playing: boolean) => void
  onPreview: (mode: 'original' | 'interp') => void
}) {
  const { session, updateLayer, notify } = useStudio()
  const buffer = getLayerBuffer(layer.id)
  const settings = layer.transcribe

  const applySettings = (patch: Partial<TranscribeSettings>) => {
    const transcribe = { ...settings, ...patch }
    updateLayer(track.id, layer.id, revoiceLayer(layer, track.kind, transcribe, session.meta.bpm))
  }

  useEffect(() => {
    return () => stopSession()
  }, [])

  const count = track.kind === 'drums' ? layer.drums.length : layer.notes.length
  const summary = useMemo(() => {
    if (track.kind === 'drums') return `${layer.drums.length} hits proposed`
    return `${layer.notes.length} notes proposed`
  }, [layer.drums.length, layer.notes.length, track.kind])

  const accept = () => {
    stopSession()
    onPlaying(false)
    updateLayer(track.id, layer.id, {
      accepted: true,
      reviewing: false,
      status:
        track.kind === 'drums'
          ? `${layer.drums.length} hits accepted`
          : `${layer.notes.length} notes accepted`,
    })
    notify('Interpretation accepted. Blend original vs MIDI with Keep original.')
  }

  const keepOriginal = () => {
    stopSession()
    onPlaying(false)
    updateLayer(track.id, layer.id, {
      accepted: true,
      reviewing: false,
      originalMix: 1,
      notes: [],
      drums: [],
      status: 'Using the uploaded audio as-is',
    })
    notify('Kept your take. MIDI was discarded for this layer.')
  }

  const span = Math.max(layer.duration || 4, loopOn && loop ? loop.end : 0)

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-gold/40 bg-panel p-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold">Review before accepting</p>
        <h2 className="font-display text-3xl text-white">Does this still sound like you?</h2>
        <p className="mt-1 text-sm text-mute">
          The MIDI is a reading, not the take. Raise confidence and gate until stray notes disappear, A/B the
          original, then accept — or keep the upload and skip the interpretation.
        </p>
        <p className="mt-2 text-sm text-mist">{summary}</p>
      </div>
      <Visualizer master color="#e8b86d" variant="hero" />

      <Timeline
        duration={span}
        bpm={session.meta.bpm}
        playhead={playhead}
        loop={loop}
        loopOn={loopOn}
        onSeek={onSeek}
        onScrub={onScrub}
        onLoop={onLoop}
        onLoopOn={onLoopOn}
      >
        <Waveform buffer={buffer} color="#e8b86d" span={span} />
        <PianoRoll
          layers={[{ id: layer.id, notes: layer.notes, drums: layer.drums, duration: layer.duration }]}
          duration={span}
          playhead={playhead}
          bpm={session.meta.bpm}
        />
      </Timeline>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            const opts = { offset: playhead, loop: loopOn ? loop : null }
            onPreview('original')
            void previewOriginal(layer.id, opts).then(() => onPlaying(true))
          }}
          className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
        >
          Play original
        </button>
        <button
          onClick={() => {
            const opts = { offset: playhead, loop: loopOn ? loop : null }
            onPreview('interp')
            void previewInterpretation(session, track, layer, opts).then(() => onPlaying(true))
          }}
          className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
        >
          Play interpretation
        </button>
        <button
          onClick={() => {
            stopSession()
            onPlaying(false)
          }}
          className="rounded-full border border-line px-4 py-2 text-sm text-mute"
        >
          Stop
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {track.kind !== 'drums' && (
          <Slider
            label="Silence gate"
            hint="Higher ignores room noise that was becoming ghost notes."
            value={settings.gate}
            min={0.002}
            max={0.05}
            step={0.001}
            onChange={(gate) => applySettings({ gate })}
          />
        )}
        {track.kind === 'drums' ? (
          <>
            <Slider
              label="Hit certainty"
              hint="Lower picks up quieter claps and 16ths. Higher keeps only stronger hits."
              value={settings.onset}
              min={0.25}
              max={2.2}
              step={0.05}
              onChange={(onset) => applySettings({ onset })}
            />
            <Slider
              label="Shortest gap"
              hint="How close two hits can be. Drop this for fast claps."
              value={settings.minNote}
              min={0.03}
              max={0.14}
              step={0.005}
              onChange={(minNote) => applySettings({ minNote })}
            />
          </>
        ) : (
          <Slider
            label="Pitch confidence"
            hint="Higher keeps notes only when the tracker is sure."
            value={settings.confidence}
            min={0.4}
            max={0.9}
            step={0.01}
            onChange={(confidence) => applySettings({ confidence })}
          />
        )}
        {track.kind !== 'drums' && (
          <>
            <Slider
              label="Split sensitivity"
              hint="Lower merges wiggles into one note; higher splits phrases."
              value={settings.splitCents}
              min={25}
              max={120}
              step={1}
              onChange={(splitCents) => applySettings({ splitCents })}
            />
            <Slider
              label="Pitch snap"
              hint="0 keeps your inflection; 1 locks to piano keys."
              value={settings.snap}
              min={0}
              max={1}
              step={0.05}
              onChange={(snap) => applySettings({ snap })}
            />
          </>
        )}
        <Slider
          label="Shortest note"
          hint="Drops blips shorter than this (seconds)."
          value={settings.minNote}
          min={0.04}
          max={0.28}
          step={0.01}
          onChange={(minNote) => applySettings({ minNote })}
        />
        <Slider
          label="Keep original"
          hint="How much of the uploaded sound stays in the layer after you accept."
          value={layer.originalMix}
          min={0}
          max={1}
          step={0.05}
          onChange={(originalMix) => updateLayer(track.id, layer.id, { originalMix })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={accept} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink">
          Accept {count} {track.kind === 'drums' ? 'hits' : 'notes'}
        </button>
        <button
          onClick={keepOriginal}
          className="rounded-full border border-line px-5 py-2 text-sm text-mist hover:border-gold"
        >
          Keep original audio only
        </button>
      </div>
    </section>
  )
}
