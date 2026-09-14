import type { DrumHit, MidiNote, RhythmFeel } from '../types'
import { RHYTHM_FEELS, defaultRhythm } from '../types'
import { barDuration } from './metronome'

export function wrapTime(time: number, length: number): number {
  if (length <= 0) return Math.max(0, time)
  const x = time % length
  return x < 0 ? x + length : x
}

/** Seconds of one phrase, snapped to whole bars so tiling stays on the click. */
export function phraseLength(duration: number, bpm: number, beatsPerBar = 4): number {
  const bar = barDuration(bpm, beatsPerBar)
  if (duration < 0.08) return bar
  return Math.max(1, Math.round(duration / bar)) * bar
}

/** Shared loop all layers should occupy so they cannot drift against each other. */
export function sharedPhraseSeconds(durations: number[], bpm: number, sessionBars: number): number {
  const sessionLen = barDuration(bpm) * Math.max(1, sessionBars)
  const longest = durations.reduce((max, d) => Math.max(max, d), 0)
  if (longest < 0.2) return sessionLen
  return Math.max(sessionLen, phraseLength(longest, bpm))
}

/**
 * Phrase used when playing / exporting a layer.
 * Near-session takes snap to the session so two layers do not loop on 3 vs 4 bars.
 */
export function layerPlaybackPhrase(duration: number, bpm: number, sessionBars: number): number {
  const sessionLen = barDuration(bpm) * Math.max(1, sessionBars)
  const layerLen = phraseLength(duration, bpm)
  if (layerLen < 0.08) return sessionLen
  const n = sessionLen / layerLen
  const nearest = Math.round(n)
  if (nearest >= 1 && Math.abs(n - nearest) < 0.08) return layerLen
  if (Math.abs(layerLen - sessionLen) < barDuration(bpm) * 0.6) return sessionLen
  return layerLen
}

export function layerSlotsPerBeat(layer: { rhythm?: RhythmFeel | null }): number {
  return layer.rhythm?.slotsPerBeat ?? 4
}

function median(values: number[]): number {
  if (!values.length) return 0
  const xs = [...values].sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

function eventIoIs(times: number[]): number[] {
  const sorted = [...times].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b)
  const out: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1]
    if (d > 0.045 && d < 2.8) out.push(d)
  }
  return out
}

export function gridFitError(times: number[], grid: number, offset: number, loopLen: number): number {
  if (!times.length || grid <= 0) return 0
  let err = 0
  for (const t of times) {
    const x = wrapTime(t - offset, loopLen)
    const nearest = Math.round(x / grid) * grid
    err += Math.min(
      Math.abs(x - nearest),
      Math.abs(x - nearest - loopLen),
      Math.abs(x - nearest + loopLen),
    )
  }
  return err / times.length
}

/**
 * How late/early the whole take is vs the chosen subdivision grid.
 * Positive = started late (shift content earlier). Searches up to two bars.
 */
export function tempoPhaseOffset(
  times: number[],
  bpm: number,
  loopLen: number,
  slotsPerBeat = 4,
  beatsPerBar = 4,
  opts?: { maxBars?: number; preferZero?: boolean },
): number {
  if (times.length < 1 || loopLen < 0.08) return 0
  const beat = 60 / Math.max(1, bpm)
  const grid = beat / Math.max(1, slotsPerBeat)
  const bar = beat * Math.max(1, beatsPerBar)
  const step = Math.max(grid / 8, 0.003)
  const maxShift = Math.min(loopLen * 0.5, bar * (opts?.maxBars ?? 2))
  let best = 0
  let bestScore = Infinity
  for (let offset = -maxShift; offset <= maxShift + 1e-9; offset += step) {
    let err = 0
    let first = Infinity
    for (const t of times) {
      const x = wrapTime(t - offset, loopLen)
      if (x < first) first = x
      const nearest = Math.round(x / grid) * grid
      err += Math.min(
        Math.abs(x - nearest),
        Math.abs(x - nearest - loopLen),
        Math.abs(x - nearest + loopLen),
      )
    }
    err = err / times.length + 0.08 * Math.min(first / bar, 1)
    if (opts?.preferZero) err += 0.28 * (Math.abs(offset) / bar)
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

export function scaleEvents<T extends { time: number; duration: number }>(events: T[], stretch: number): T[] {
  if (Math.abs(stretch - 1) < 0.002 || !events.length) return events
  return events.map((event) => ({
    ...event,
    time: event.time * stretch,
    duration: event.duration * stretch,
  }))
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
  feel: RhythmFeel = defaultRhythm(),
): { notes: MidiNote[]; drums: DrumHit[]; offset: number } {
  const times = drums.length ? drums.map((h) => h.time) : notes.map((n) => n.time)
  const offset = tempoPhaseOffset(times, bpm, loopLen, feel.slotsPerBeat, feel.beatsPerBar)
  return {
    notes: shiftEvents(notes, offset, loopLen),
    drums: shiftEvents(drums, offset, loopLen),
    offset,
  }
}

type RhythmCandidate = { feel: RhythmFeel; score: number; unitErr: number }

/** Map the take’s median pulse onto the nearest session beat / 8th / triplet / 16th. */
function pulseStretch(medianIoi: number, beat: number): number {
  if (medianIoi <= 0.04) return 1
  const targets = [beat, beat / 2, beat / 3, beat / 4, beat * 2]
  let best = 1
  let bestCost = Infinity
  for (const target of targets) {
    let stretch = target / medianIoi
    while (stretch < 0.72) stretch *= 2
    while (stretch > 1.38) stretch /= 2
    stretch = Math.min(1.38, Math.max(0.72, stretch))
    const cost = Math.abs(Math.log(stretch))
    if (cost < bestCost - 1e-6) {
      bestCost = cost
      best = stretch
    }
  }
  return Math.abs(best - 1) < 0.02 ? 1 : best
}

/**
 * Pick the closest groove to the take and the stretch that maps its pulse onto the session click.
 * Prefers the coarsest grid that still fits so a quarter-note clap does not get treated as 16ths.
 */
export function detectRhythm(
  times: number[],
  bpm: number,
  duration: number,
): { feel: RhythmFeel; stretch: number } {
  const quarters = RHYTHM_FEELS[0]
  if (times.length < 2) return { feel: quarters, stretch: 1 }

  const beat = 60 / Math.max(1, bpm)
  const iois = eventIoIs(times)
  const med = iois.length ? median(iois) : beat
  const loopLen = Math.max(duration, Math.max(...times) + beat * 0.25, beat)
  const sparse = times.length < 4
  const stretch = sparse && Math.abs(Math.log(pulseStretch(med, beat))) > 0.22 ? 1 : pulseStretch(med, beat)
  const scaled = times.map((t) => t * stretch)
  const len = Math.max(loopLen * stretch, beat)
  const cands: RhythmCandidate[] = []

  for (const feel of RHYTHM_FEELS) {
    const grid = beat / feel.slotsPerBeat
    const offset = tempoPhaseOffset(scaled, bpm, len, feel.slotsPerBeat, feel.beatsPerBar)
    const err = gridFitError(scaled, grid, offset, len)
    const unitErr = err / grid
    const coarseBonus = (4 - feel.slotsPerBeat) * 0.04
    const meterPen = feel.beatsPerBar === 3 ? 0.045 : 0
    const tripletPen = feel.slotsPerBeat === 3 ? 0.025 : 0
    cands.push({
      feel,
      unitErr,
      score: unitErr - coarseBonus + meterPen + tripletPen,
    })
  }

  const tight = cands.filter((c) => c.unitErr < 0.18)
  const pool = (tight.length ? tight : cands).slice()
  pool.sort((a, b) => {
    if (tight.length && a.feel.slotsPerBeat !== b.feel.slotsPerBeat) {
      return a.feel.slotsPerBeat - b.feel.slotsPerBeat
    }
    if (tight.length && a.feel.beatsPerBar !== b.feel.beatsPerBar) {
      return b.feel.beatsPerBar - a.feel.beatsPerBar
    }
    return a.score - b.score
  })

  const pick = pool[0]
  if (sparse && pick.feel.slotsPerBeat > 1 && pick.unitErr > 0.12) {
    return { feel: quarters, stretch }
  }
  return { feel: pick.feel, stretch }
}
