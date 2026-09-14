import { PitchDetector } from 'pitchy'
import type { MidiNote, TranscribeSettings } from '../types'
import { clamp, freqToMidi, mixToMono, rms } from './context'

export interface MelodyAnalysis {
  times: Float32Array
  freqs: Float32Array
  probs: Float32Array
  energies: Float32Array
}

function velocityFromRms(value: number): number {
  const db = 20 * Math.log10(value + 1e-8)
  const n = (db + 48) / 42
  return Math.round(clamp(n, 0.08, 1) * 127)
}

/**
 * McLeod Pitch Method via `pitchy` (Tartini / "A Smarter Way to Find Pitch").
 * Stores a raw contour; thresholds are applied later in notesFromAnalysis.
 */
export function analyzeMelody(buffer: AudioBuffer, onProgress?: (pct: number) => void): MelodyAnalysis {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const hop = 256
  const size = 2048
  const frames = Math.max(0, Math.floor((samples.length - size) / hop))
  const times = new Float32Array(frames)
  const freqs = new Float32Array(frames)
  const probs = new Float32Array(frames)
  const energies = new Float32Array(frames)
  const detector = PitchDetector.forFloat32Array(size)
  detector.minVolumeAbsolute = 0.0025
  const scratch = new Float32Array(size)

  for (let n = 0; n < frames; n++) {
    const start = n * hop
    const frame = samples.subarray(start, start + size)
    scratch.set(frame)
    const e = rms(scratch, 0, scratch.length)
    times[n] = start / sr
    energies[n] = e
    const [freq, clarity] = detector.findPitch(scratch, sr)
    freqs[n] = freq > 70 && freq < 900 ? freq : 0
    probs[n] = clarity
    if (onProgress && n % 24 === 0) onProgress(n / frames)
  }
  onProgress?.(1)
  return { times, freqs, probs, energies }
}

export function notesFromAnalysis(analysis: MelodyAnalysis, settings: TranscribeSettings): { notes: MidiNote[]; bpm: number } {
  const { times, freqs, probs, energies } = analysis
  const hop = times.length > 1 ? times[1] - times[0] : 0.006
  const notes: MidiNote[] = []
  let i = 0

  const voiced = (idx: number) =>
    energies[idx] >= settings.gate && probs[idx] >= settings.confidence && freqs[idx] > 0

  while (i < freqs.length) {
    if (!voiced(i)) {
      i++
      continue
    }
    const start = times[i]
    let last = i
    let midiAcc = freqToMidi(freqs[i])
    let n = 1
    let eAcc = energies[i]
    i++
    while (i < freqs.length && voiced(i)) {
      const m = freqToMidi(freqs[i])
      const cents = (m - midiAcc / n) * 100
      if (Math.abs(cents) > settings.splitCents) break
      midiAcc += m
      eAcc += energies[i]
      n++
      last = i
      i++
    }
    const duration = times[last] + hop - start
    if (duration < settings.minNote) continue
    const rawMidi = midiAcc / n
    const midi = Math.round(clamp(rawMidi, 36, 96))
    const cents = (1 - settings.snap) * clamp((rawMidi - midi) * 100, -50, 50)
    notes.push({
      midi,
      time: start,
      duration,
      velocity: velocityFromRms(eAcc / n),
      cents,
    })
  }

  return { notes, bpm: estimateBpm(notes.map((n) => n.time)) }
}

export function transcribeMelody(
  buffer: AudioBuffer,
  settings: TranscribeSettings,
  onProgress?: (pct: number) => void,
): { notes: MidiNote[]; bpm: number; analysis: MelodyAnalysis } {
  const analysis = analyzeMelody(buffer, onProgress)
  const result = notesFromAnalysis(analysis, settings)
  return { ...result, analysis }
}

function estimateBpm(onsets: number[]): number {
  if (onsets.length < 4) return 92
  const iois: number[] = []
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1]
    if (d > 0.22 && d < 1.4) iois.push(d)
  }
  if (!iois.length) return 92
  iois.sort((a, b) => a - b)
  const median = iois[Math.floor(iois.length / 2)]
  let bpm = 60 / median
  while (bpm < 70) bpm *= 2
  while (bpm > 160) bpm /= 2
  return Math.round(bpm)
}

export function quantizeNotes(notes: MidiNote[], bpm: number, amount: number, slotsPerBeat = 4): MidiNote[] {
  if (amount <= 0) return notes
  const grid = 60 / bpm / Math.max(1, slotsPerBeat)
  return notes.map((n) => {
    const snapped = Math.round(n.time / grid) * grid
    const durSnap = Math.max(grid, Math.round(n.duration / grid) * grid)
    return {
      ...n,
      time: n.time + (snapped - n.time) * amount,
      duration: n.duration + (durSnap - n.duration) * amount,
    }
  })
}
