import type { DrumHit, MidiNote, RhythmFeel } from '../types'
import { defaultRhythm } from '../types'
import { fitBuffer } from './context'
import { detectRhythm, scaleEvents, shiftEvents, tempoPhaseOffset, wrapTime } from './grid'
import { clipToLoop, loopCrossfade, nearestLoop, prepareForLoop, resampleToLength, rotateBuffer } from './loopPrep'
import { barDuration } from './metronome'

export interface ClickLockResult {
  buffer: AudioBuffer
  notes: MidiNote[]
  drums: DrumHit[]
  feel: RhythmFeel
  seconds: number
  bars: number
  derived: boolean
}

/** Wrap into the loop only — do not bake a hard grid onto stored MIDI (off-beats live in playback snap). */
function fitToLoop(notes: MidiNote[], drums: DrumHit[], loopLen: number) {
  const wrap = <T extends { time: number }>(items: T[]) =>
    items.map((item) => ({ ...item, time: wrapTime(item.time, loopLen) }))
  return {
    notes: clipToLoop(wrap(notes), loopLen),
    drums: clipToLoop(wrap(drums), loopLen),
  }
}

function phaseSlots(feel: RhythmFeel): number {
  return feel.slotsPerBeat === 3 ? 3 : 1
}

/** Stretch MIDI onto the session click and rotate to the downbeat, keeping extra hits. */
export function lockMidiToClick(
  notes: MidiNote[],
  drums: DrumHit[],
  bpm: number,
  loopLen: number,
  feel?: RhythmFeel,
  followSession = false,
): { notes: MidiNote[]; drums: DrumHit[]; feel: RhythmFeel; offset: number } {
  const times = drums.length ? drums.map((h) => h.time) : notes.map((n) => n.time)
  const detected = detectRhythm(times, bpm, loopLen)
  const chosen = feel ?? detected.feel
  let stretch = detected.stretch
  if (followSession) {
    if (Math.abs(stretch - 1) < 0.08) stretch = 1
    else stretch = Math.min(1.08, Math.max(0.92, stretch))
  }
  const stretchedNotes = scaleEvents(notes, stretch)
  const stretchedDrums = scaleEvents(drums, stretch)
  const pulse = stretchedDrums.length ? stretchedDrums.map((h) => h.time) : stretchedNotes.map((n) => n.time)
  const offset = tempoPhaseOffset(
    pulse,
    bpm,
    loopLen,
    phaseSlots(chosen),
    chosen.beatsPerBar,
    followSession ? { maxBars: 0.5, preferZero: true } : undefined,
  )
  const fitted = fitToLoop(
    shiftEvents(stretchedNotes, offset, loopLen),
    shiftEvents(stretchedDrums, offset, loopLen),
    loopLen,
  )
  return { ...fitted, feel: chosen, offset }
}

/**
 * Default lock: map the take’s pulse onto the session click and rotate to the downbeat.
 * Extra off-beats stay in the MIDI; Snap to click in the inspector pulls them toward the grid.
 */
export function lockTakeToClick(opts: {
  buffer: AudioBuffer
  notes: MidiNote[]
  drums: DrumHit[]
  bpm: number
  loopSeconds?: number | null
  live?: boolean
  feel?: RhythmFeel
  /** Stacking on an existing sketch — keep this take on the shared loop, don't hunt a new downbeat. */
  followSession?: boolean
}): ClickLockResult {
  const { bpm, live, followSession } = opts
  let { buffer, notes, drums } = opts
  const times = drums.length ? drums.map((h) => h.time) : notes.map((n) => n.time)
  const phaseOpts = followSession ? { maxBars: 0.5, preferZero: true } : undefined

  if (times.length < 1) {
    const prepared = prepareForLoop(buffer, bpm, opts.loopSeconds, { live })
    return {
      buffer: prepared.buffer,
      notes,
      drums,
      feel: opts.feel ?? defaultRhythm(),
      seconds: prepared.seconds,
      bars: prepared.bars,
      derived: prepared.derived,
    }
  }

  const detected = detectRhythm(times, bpm, buffer.duration)
  const feel = opts.feel ?? detected.feel
  let stretch = Math.abs(detected.stretch - 1) < 0.02 ? 1 : detected.stretch
  if (followSession) {
    if (Math.abs(stretch - 1) < 0.08) stretch = 1
    else stretch = Math.min(1.08, Math.max(0.92, stretch))
  }

  if (Math.abs(stretch - 1) > 0.018) {
    buffer = resampleToLength(buffer, Math.max(0.05, buffer.duration * stretch))
    notes = scaleEvents(notes, stretch)
    drums = scaleEvents(drums, stretch)
  }

  const derived = !(opts.loopSeconds && opts.loopSeconds > 0.2)
  const nearest = nearestLoop(buffer.duration, bpm)
  const seconds = derived ? nearest.seconds : opts.loopSeconds!
  const bars = derived ? nearest.bars : Math.max(1, Math.round(seconds / barDuration(bpm)))

  if (Math.abs(buffer.duration - seconds) > 0.012) {
    const ratio = seconds / Math.max(0.05, buffer.duration)
    if (!followSession && ratio >= 0.94 && ratio <= 1.06) {
      buffer = resampleToLength(buffer, seconds)
      notes = scaleEvents(notes, ratio)
      drums = scaleEvents(drums, ratio)
    } else {
      buffer = fitBuffer(buffer, seconds)
    }
  }
  buffer = loopCrossfade(buffer, live ? 8 : 14)

  const offset = tempoPhaseOffset(
    drums.length ? drums.map((h) => h.time) : notes.map((n) => n.time),
    bpm,
    seconds,
    phaseSlots(feel),
    feel.beatsPerBar,
    phaseOpts,
  )
  if (Math.abs(offset) > 0.004) {
    buffer = rotateBuffer(buffer, offset)
    notes = shiftEvents(notes, offset, seconds)
    drums = shiftEvents(drums, offset, seconds)
  }

  const fitted = fitToLoop(notes, drums, seconds)
  return {
    buffer,
    notes: fitted.notes,
    drums: fitted.drums,
    feel,
    seconds,
    bars,
    derived,
  }
}
