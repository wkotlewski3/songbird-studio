import type { DrumHit, DrumPiece } from '../types'
import { clamp, mixToMono, rms } from './context'

function bandEnergy(frame: Float32Array, sr: number, lo: number, hi: number): number {
  // Goertzel-ish average via time-domain IIR bandpass energy
  const f = (lo + hi) / 2
  const w = (2 * Math.PI * f) / sr
  const bw = Math.max(50, hi - lo)
  const r = 1 - Math.PI * (bw / sr)
  let y1 = 0
  let y2 = 0
  let e = 0
  const c = 2 * r * Math.cos(w)
  for (let i = 0; i < frame.length; i++) {
    const y = frame[i] + c * y1 - r * r * y2
    e += y * y
    y2 = y1
    y1 = y
  }
  return e / frame.length
}

function classify(frame: Float32Array, sr: number, flux: number): DrumPiece {
  const low = bandEnergy(frame, sr, 40, 140)
  const mid = bandEnergy(frame, sr, 180, 800)
  const high = bandEnergy(frame, sr, 5000, 12000)
  const total = low + mid + high + 1e-8
  const durationHint = rms(frame, 0, Math.min(frame.length, Math.floor(sr * 0.04)))

  if (low / total > 0.5 && low > mid) return 'kick'
  if (high / total > 0.45 && durationHint < 0.05) {
    return high > 0.02 && flux > 0.08 ? 'hatOpen' : 'hatClosed'
  }
  if (mid / total > 0.38) return 'snare'
  if (low / total > 0.3 && mid / total > 0.25) return 'tom'
  if (high / total > 0.35 && flux > 0.12) return 'crash'
  return 'snare'
}

export function transcribeDrums(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void,
): DrumHit[] {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const hop = 256
  const size = 1024
  const flux: number[] = []
  let prev = new Float32Array(size)

  for (let start = 0; start + size < samples.length; start += hop) {
    const frame = samples.subarray(start, start + size)
    let spec = 0
    for (let i = 0; i < size; i++) {
      const d = Math.abs(frame[i]) - Math.abs(prev[i])
      if (d > 0) spec += d
    }
    flux.push(spec / size)
    prev = frame.slice()
    if (onProgress && start % (hop * 32) === 0) onProgress(start / samples.length)
  }
  onProgress?.(1)

  const sorted = [...flux].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 0.001
  const thresh = median * 3.2 + 0.012
  const hits: DrumHit[] = []
  const minGap = Math.floor(0.07 * sr / hop)

  for (let i = 2; i < flux.length - 2; i++) {
    if (flux[i] < thresh) continue
    if (flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue
    if (hits.length && i - Math.round((hits[hits.length - 1].time * sr) / hop) < minGap) {
      continue
    }
    const start = Math.floor(i * hop)
    const frame = samples.subarray(start, start + size)
    const piece = classify(frame, sr, flux[i])
    const energy = rms(samples, start, start + Math.floor(sr * 0.05))
    const velocity = Math.round(clamp((energy * 8 + flux[i] * 6) * 90, 40, 127))
    const duration =
      piece === 'hatClosed' ? 0.06 : piece === 'kick' ? 0.28 : piece === 'crash' ? 1.1 : 0.18
    hits.push({ time: start / sr, duration, velocity, piece })
  }

  return hits
}

export const GM_DRUM: Record<DrumPiece, number> = {
  kick: 36,
  snare: 38,
  hatClosed: 42,
  hatOpen: 46,
  tom: 45,
  crash: 49,
}

export function quantizeDrums(hits: DrumHit[], bpm: number, amount: number): DrumHit[] {
  if (amount <= 0) return hits
  const grid = 60 / bpm / 4
  return hits.map((h) => {
    const snapped = Math.round(h.time / grid) * grid
    return { ...h, time: h.time + (snapped - h.time) * amount }
  })
}
