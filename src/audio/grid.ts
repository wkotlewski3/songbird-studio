import type { DrumHit, MidiNote } from '../types'
import { barDuration } from './metronome'

export function wrapTime(time: number, length: number): number {
  if (length <= 0) return Math.max(0, time)
  const x = time % length
  return x < 0 ? x + length : x
}

/** Seconds of one phrase, snapped to whole bars so tiling stays on the click. */
export function phraseLength(duration: number, bpm: number): number {
  const bar = barDuration(bpm)
  if (duration < 0.08) return bar
  return Math.max(1, Math.round(duration / bar)) * bar
}

/**
 * How late/early the whole take is vs the 16th-note grid.
 * Positive = started late (shift content earlier).
 */
export function tempoPhaseOffset(times: number[], bpm: number, loopLen: number): number {
  if (times.length < 1 || loopLen < 0.08) return 0
  const beat = 60 / Math.max(1, bpm)
  const grid = beat / 4
  const step = grid / 8
  const maxShift = Math.min(loopLen * 0.5, beat * 2)
  let best = 0
  let bestScore = Infinity
  for (let offset = -maxShift; offset <= maxShift + 1e-9; offset += step) {
    let err = 0
    let first = Infinity
    for (const t of times) {
      const x = wrapTime(t - offset, loopLen)
      if (x < first) first = x
      const nearest = Math.round(x / grid) * grid
      err += Math.min(Math.abs(x - nearest), Math.abs(x - nearest - loopLen), Math.abs(x - nearest + loopLen))
    }
    err = err / times.length + 0.1 * Math.min(first / grid, 4)
    if (err < bestScore) {
      bestScore = err
      best = offset
    }
  }
  return Math.abs(best) < 0.004 ? 0 : best
}

export function shiftEvents<T extends { time: number }>(events: T[], offset: number, loopLen: number): T[] {
  if (Math.abs(offset) < 0.002 || !events.length) return events
  return events
    .map((event) => ({ ...event, time: wrapTime(event.time - offset, loopLen) }))
    .sort((a, b) => a.time - b.time)
}

export function tileEvents<T extends { time: number; duration: number }>(
  events: T[],
  phrase: number,
  until: number,
): T[] {
  if (phrase <= 0.08 || until <= phrase + 0.05 || !events.length) return events
  const copies = Math.max(1, Math.ceil((until - 1e-4) / phrase))
  const out: T[] = []
  for (let k = 0; k < copies; k++) {
    const shift = k * phrase
    for (const event of events) {
      const time = event.time + shift
      if (time >= until - 0.008) continue
      out.push({
        ...event,
        time,
        duration: Math.max(0.02, Math.min(event.duration, until - time)),
      })
    }
  }
  return out
}

export function alignMidiToTempo(
  notes: MidiNote[],
  drums: DrumHit[],
  bpm: number,
  loopLen: number,
): { notes: MidiNote[]; drums: DrumHit[]; offset: number } {
  const times = drums.length ? drums.map((h) => h.time) : notes.map((n) => n.time)
  const offset = tempoPhaseOffset(times, bpm, loopLen)
  return {
    notes: shiftEvents(notes, offset, loopLen),
    drums: shiftEvents(drums, offset, loopLen),
    offset,
  }
}
