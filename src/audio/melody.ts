import type { MidiNote } from '../types'
import { clamp, freqToMidi, mixToMono, rms } from './context'

/**
 * YIN pitch tracker (de Cheveigné & Kawahara).
 * Tuned for humming and single-note instruments, not full mixes.
 */
function yinF0(
  frame: Float32Array,
  sampleRate: number,
  threshold = 0.14,
): { freq: number; probability: number } {
  const tauMin = Math.floor(sampleRate / 900)
  const tauMax = Math.min(Math.floor(sampleRate / 70), Math.floor(frame.length / 2))
  const diff = new Float32Array(tauMax + 1)

  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0
    for (let i = 0; i < frame.length - tauMax; i++) {
      const d = frame[i] - frame[i + tau]
      sum += d * d
    }
    diff[tau] = sum
  }

  const cmnd = new Float32Array(tauMax + 1)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau]
    cmnd[tau] = (diff[tau] * tau) / (running || 1)
  }

  let tauEst = -1
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++
      tauEst = tau
      break
    }
  }

  if (tauEst < 0) {
    let min = 1
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (cmnd[tau] < min) {
        min = cmnd[tau]
        tauEst = tau
      }
    }
    if (min > 0.45) return { freq: 0, probability: 0 }
  }

  const x0 = tauEst < 1 ? tauEst : tauEst - 1
  const x2 = tauEst + 1 < tauMax ? tauEst + 1 : tauEst
  let better = tauEst
  if (x0 !== tauEst && x2 !== tauEst) {
    const s0 = cmnd[x0]
    const s1 = cmnd[tauEst]
    const s2 = cmnd[x2]
    const denom = 2 * s1 - s2 - s0
    if (denom !== 0) better = tauEst + (s2 - s0) / (2 * denom)
  }

  const probability = 1 - cmnd[tauEst]
  return { freq: sampleRate / better, probability }
}

function velocityFromRms(value: number): number {
  const db = 20 * Math.log10(value + 1e-8)
  const n = (db + 48) / 42
  return Math.round(clamp(n, 0.08, 1) * 127)
}

export function transcribeMelody(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void,
): { notes: MidiNote[]; bpm: number } {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const hop = 256
  const size = 2048
  const times: number[] = []
  const freqs: number[] = []
  const probs: number[] = []
  const energies: number[] = []

  for (let start = 0; start + size < samples.length; start += hop) {
    const frame = samples.subarray(start, start + size)
    const e = rms(frame, 0, frame.length)
    energies.push(e)
    if (e < 0.008) {
      times.push(start / sr)
      freqs.push(0)
      probs.push(0)
    } else {
      const { freq, probability } = yinF0(frame, sr)
      times.push(start / sr)
      freqs.push(probability > 0.55 ? freq : 0)
      probs.push(probability)
    }
    if (onProgress && start % (hop * 24) === 0) {
      onProgress(start / samples.length)
    }
  }
  onProgress?.(1)

  const notes: MidiNote[] = []
  let i = 0
  while (i < freqs.length) {
    if (freqs[i] <= 0) {
      i++
      continue
    }
    const start = times[i]
    let last = i
    let midiAcc = freqToMidi(freqs[i])
    let n = 1
    let eAcc = energies[i]
    i++
    while (i < freqs.length && freqs[i] > 0) {
      const m = freqToMidi(freqs[i])
      const cents = (m - midiAcc / n) * 100
      if (Math.abs(cents) > 70) break
      midiAcc += m
      eAcc += energies[i]
      n++
      last = i
      i++
    }
    const end = times[last] + hop / sr
    const duration = end - start
    if (duration < 0.07) continue
    const rawMidi = midiAcc / n
    const midi = Math.round(clamp(rawMidi, 36, 96))
    notes.push({
      midi,
      time: start,
      duration,
      velocity: velocityFromRms(eAcc / n),
      cents: clamp((rawMidi - midi) * 100, -50, 50),
    })
  }

  return { notes, bpm: estimateBpm(notes.map((n) => n.time)) }
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

export function quantizeNotes(notes: MidiNote[], bpm: number, amount: number): MidiNote[] {
  if (amount <= 0) return notes
  const grid = 60 / bpm / 4
  return notes.map((n) => {
    const snapped = Math.round(n.time / grid) * grid
    return { ...n, time: n.time + (snapped - n.time) * amount }
  })
}
