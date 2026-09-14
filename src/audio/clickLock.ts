import type { DrumHit, MidiNote, RhythmFeel } from '../types'
import { defaultRhythm } from '../types'
import { fitBuffer } from './context'
import { quantizeDrums } from './drums'
import { detectRhythm, scaleEvents, shiftEvents, tempoPhaseOffset, wrapTime } from './grid'
import { clipToLoop, loopCrossfade, nearestLoop, prepareForLoop, resampleToLength, rotateBuffer } from './loopPrep'
import { quantizeNotes } from './melody'
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

function snapToFeel(notes: MidiNote[], drums: DrumHit[], bpm: number, feel: RhythmFeel, loopLen: number) {
  const wrap = <T extends { time: number }>(items: T[]) =>
    items.map((item) => ({ ...item, time: wrapTime(item.time, loopLen) }))
  return {
    notes: clipToLoop(wrap(quantizeNotes(notes, bpm, 1, feel.slotsPerBeat)), loopLen),
    drums: clipToLoop(wrap(quantizeDrums(drums, bpm, 1, feel.slotsPerBeat)), loopLen),
  }
}

/** Stretch MIDI onto the session click and snap it to the closest (or given) groove. */
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
  const stretchedNotes = scaleEvents(notes, stretch).filter((n) => n.time < loopLen - 0.008)
  const stretchedDrums = scaleEvents(drums, stretch).filter((h) => h.time < loopLen - 0.008)
  const pulse = stretchedDrums.length ? stretchedDrums.map((h) => h.time) : stretchedNotes.map((n) => n.time)
  const offset = tempoPhaseOffset(
    pulse,
    bpm,
    loopLen,
    chosen.slotsPerBeat,
    chosen.beatsPerBar,
    followSession ? { maxBars: 0.5, preferZero: true } : undefined,
  )
  const snapped = snapToFeel(
    shiftEvents(stretchedNotes, offset, loopLen),
    shiftEvents(stretchedDrums, offset, loopLen),
    bpm,
    chosen,
    loopLen,
  )
  return { ...snapped, feel: chosen, offset }
}

/**
 * Default lock: map the take’s pulse onto the session click, rotate to the downbeat,
 * and hard-quantize to the closest matching groove (1/4, 1/8, 1/16, triplets, 3/4).
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
    feel.slotsPerBeat,
    feel.beatsPerBar,
    phaseOpts,
  )
  if (Math.abs(offset) > 0.004) {
    buffer = rotateBuffer(buffer, offset)
    notes = shiftEvents(notes, offset, seconds)
    drums = shiftEvents(drums, offset, seconds)
  }

  const snapped = snapToFeel(notes, drums, bpm, feel, seconds)
  return {
    buffer,
    notes: snapped.notes,
    drums: snapped.drums,
    feel,
    seconds,
    bars,
    derived,
  }
}
