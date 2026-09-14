import type { DrumHit, DrumPiece, TranscribeSettings } from '../types'
import { clamp, mixToMono, rms } from './context'

export interface DrumAnalysis {
  flux: Float32Array
  hop: number
  size: number
  sampleRate: number
}

function onePoleEnergy(frame: Float32Array, sr: number, cutoff: number, highpass: boolean): number {
  const dt = 1 / sr
  const rc = 1 / (2 * Math.PI * cutoff)
  const a = highpass ? rc / (rc + dt) : dt / (rc + dt)
  let prev = 0
  let y = 0
  let e = 0
  for (let i = 0; i < frame.length; i++) {
    const x = frame[i]
    y = highpass ? a * (y + x - prev) : y + a * (x - y)
    prev = x
    e += y * y
  }
  return e / frame.length
}

function classify(frame: Float32Array, sr: number, flux: number): DrumPiece {
  const bass = onePoleEnergy(frame, sr, 180, false)
  const treble = onePoleEnergy(frame, sr, 1800, true)
  const air = onePoleEnergy(frame, sr, 6500, true)
  const total = rms(frame, 0, frame.length) ** 2 + 1e-8
  const durationHint = rms(frame, 0, Math.min(frame.length, Math.floor(sr * 0.04)))

  if (bass > treble * 1.15 && bass / total > 0.35) return 'kick'
  if (air > treble * 0.7 && durationHint < 0.05 && bass / total < 0.2) {
    return flux > 0.08 ? 'hatOpen' : 'hatClosed'
  }
  if (treble > bass * 1.6 && durationHint < 0.08) return 'clap'
  if (bass > treble * 0.55 && treble > bass * 0.35) return 'snare'
  if (bass / total > 0.28 && durationHint > 0.04) return 'tom'
  if (air / total > 0.2 && flux > 0.12) return 'crash'
  return treble > bass ? 'clap' : 'snare'
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))))
  return sorted[i]
}

function combinedFlux(samples: Float32Array, analysis: DrumAnalysis): Float32Array {
  const { flux, hop, size } = analysis
  const out = new Float32Array(flux.length)
  let prev = 0
  for (let n = 0; n < flux.length; n++) {
    const start = n * hop
    let bright = 0
    for (let i = 0; i < size; i++) {
      const x = samples[start + i] ?? 0
      const hp = x - prev
      prev = x
      bright += Math.abs(hp)
    }
    out[n] = Math.max(flux[n], (bright / size) * 0.85)
  }
  return out
}

export function analyzeDrums(buffer: AudioBuffer, onProgress?: (pct: number) => void): DrumAnalysis {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const hop = 256
  const size = 1024
  const frames = Math.max(0, Math.floor((samples.length - size) / hop))
  const flux = new Float32Array(frames)
  let prev = new Float32Array(size)

  for (let n = 0; n < frames; n++) {
    const start = n * hop
    const frame = samples.subarray(start, start + size)
    let spec = 0
    for (let i = 0; i < size; i++) {
      const d = Math.abs(frame[i]) - Math.abs(prev[i])
      if (d > 0) spec += d
    }
    flux[n] = spec / size
    prev = frame.slice()
    if (onProgress && n % 32 === 0) onProgress(n / frames)
  }
  onProgress?.(1)
  return { flux, hop, size, sampleRate: sr }
}

export function hitsFromAnalysis(
  buffer: AudioBuffer,
  analysis: DrumAnalysis,
  settings: TranscribeSettings,
): DrumHit[] {
  const samples = mixToMono(buffer)
  const { hop, size, sampleRate: sr } = analysis
  const flux = combinedFlux(samples, analysis)
  const sorted = Array.from(flux).sort((a, b) => a - b)
  const floor = percentile(sorted, 0.3)
  const peak = percentile(sorted, 0.92)
  const spread = Math.max(peak - floor, 0.0015)
  const thresh = floor + spread * (0.16 * settings.onset)
  const gapSec = Math.max(0.032, Math.min(settings.minNote, 0.07))
  const minGap = Math.max(2, Math.floor((gapSec * sr) / hop))
  const localWin = 18
  const localK = 1.12 + 0.28 * settings.onset
  const hits: DrumHit[] = []

  for (let i = 2; i < flux.length - 2; i++) {
    if (flux[i] < thresh) continue
    if (flux[i] < flux[i - 1] || flux[i] <= flux[i + 1]) continue
    let local = 0
    let count = 0
    const a = Math.max(0, i - localWin)
    const b = Math.min(flux.length, i + localWin)
    for (let j = a; j < b; j++) {
      if (j === i) continue
      local += flux[j]
      count++
    }
    const mean = local / Math.max(1, count)
    if (flux[i] < mean * localK && flux[i] < thresh * 1.35) continue
    if (hits.length && i - Math.round((hits[hits.length - 1].time * sr) / hop) < minGap) {
      if (flux[i] <= flux[Math.round((hits[hits.length - 1].time * sr) / hop)]) continue
      hits.pop()
    }
    const start = Math.floor(i * hop)
    const frame = samples.subarray(start, start + size)
    const piece = classify(frame, sr, flux[i])
    const energy = rms(samples, start, start + Math.floor(sr * 0.05))
    const velocity = Math.round(clamp((energy * 8 + flux[i] * 6) * 90, 40, 127))
    const duration =
      piece === 'hatClosed'
        ? 0.06
        : piece === 'clap' || piece === 'rim'
          ? 0.12
          : piece === 'kick'
            ? 0.28
            : piece === 'crash'
              ? 1.1
              : 0.18
    hits.push({ time: start / sr, duration, velocity, piece })
  }
  return hits
}

export function transcribeDrums(
  buffer: AudioBuffer,
  settings: TranscribeSettings,
  onProgress?: (pct: number) => void,
): { drums: DrumHit[]; analysis: DrumAnalysis } {
  const analysis = analyzeDrums(buffer, onProgress)
  return { drums: hitsFromAnalysis(buffer, analysis, settings), analysis }
}

export const GM_DRUM: Record<DrumPiece, number> = {
  kick: 36,
  snare: 38,
  clap: 39,
  rim: 37,
  hatClosed: 42,
  hatOpen: 46,
  tom: 45,
  crash: 49,
}

export function quantizeDrums(hits: DrumHit[], bpm: number, amount: number, slotsPerBeat = 4): DrumHit[] {
  if (amount <= 0) return hits
  const grid = 60 / bpm / Math.max(1, slotsPerBeat)
  return hits.map((h) => {
    const snapped = Math.round(h.time / grid) * grid
    return { ...h, time: h.time + (snapped - h.time) * amount }
  })
}
