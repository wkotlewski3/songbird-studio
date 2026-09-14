import { PitchDetector } from 'pitchy'
import type { DrumHit, MidiNote, TrackKind } from '../types'
import { fitBuffer, getAudioContext, mixToMono, rms } from './context'
import { barDuration } from './metronome'

function makeBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  return getAudioContext().createBuffer(channels, length, sampleRate)
}

export function trimSilence(buffer: AudioBuffer, gate = 0.012): AudioBuffer {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const pad = Math.floor(sr * 0.02)
  let start = 0
  let end = samples.length - 1
  while (start < end && Math.abs(samples[start]) < gate) start++
  while (end > start && Math.abs(samples[end]) < gate) end--
  start = Math.max(0, start - pad)
  end = Math.min(samples.length, end + pad)
  if (end - start < sr * 0.12) return buffer
  const len = end - start
  const ac = buffer.numberOfChannels
  const out = makeBuffer(ac, len, sr)
  for (let c = 0; c < ac; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end))
  }
  return out
}

export function resampleToLength(buffer: AudioBuffer, seconds: number): AudioBuffer {
  const target = Math.max(1, Math.floor(seconds * buffer.sampleRate))
  if (Math.abs(target - buffer.length) < 8) return buffer
  const ratio = buffer.length / target
  const out = makeBuffer(buffer.numberOfChannels, target, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    const last = src.length - 1
    for (let i = 0; i < target; i++) {
      const x = i * ratio
      const i0 = Math.min(last, Math.floor(x))
      const i1 = Math.min(last, i0 + 1)
      const f = x - i0
      dst[i] = src[i0] * (1 - f) + src[i1] * f
    }
  }
  return out
}

export function loopCrossfade(buffer: AudioBuffer, ms = 14): AudioBuffer {
  const n = Math.min(buffer.length >> 1, Math.floor((buffer.sampleRate * ms) / 1000))
  if (n < 8) return buffer
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    const end = data.length
    for (let i = 0; i < n; i++) {
      const a = i / n
      const fadeIn = Math.sin((a * Math.PI) / 2)
      const fadeOut = Math.cos((a * Math.PI) / 2)
      const head = data[i]
      const tail = data[end - n + i]
      data[i] = head * fadeIn + tail * (1 - fadeIn) * 0.4
      data[end - n + i] = tail * fadeOut
    }
  }
  return buffer
}

export function nearestLoop(duration: number, bpm: number): { bars: number; seconds: number } {
  const bar = barDuration(bpm)
  const bars = Math.min(16, Math.max(1, Math.round(duration / bar) || 1))
  return { bars, seconds: bars * bar }
}

export function prepareForLoop(
  buffer: AudioBuffer,
  bpm: number,
  loopSeconds?: number | null,
  opts: { live?: boolean } = {},
): { buffer: AudioBuffer; seconds: number; bars: number; derived: boolean } {
  let next = opts.live ? buffer : trimSilence(buffer)
  const derived = !(loopSeconds && loopSeconds > 0.2)
  const target = derived ? nearestLoop(next.duration, bpm) : { bars: 0, seconds: loopSeconds! }
  const bars = derived ? target.bars : Math.max(1, Math.round(target.seconds / barDuration(bpm)))
  const seconds = derived ? target.seconds : loopSeconds!
  const ratio = seconds / Math.max(0.05, next.duration)
  // Tiny stretch only for slight tempo drift. Late starts get padded, not slowed down.
  if (ratio >= 0.94 && ratio <= 1.06) next = resampleToLength(next, seconds)
  else next = fitBuffer(next, seconds)
  next = loopCrossfade(next, opts.live ? 8 : 14)
  return { buffer: next, seconds, bars, derived }
}

export function rotateBuffer(buffer: AudioBuffer, offsetSec: number): AudioBuffer {
  const len = buffer.length
  let n = Math.round(offsetSec * buffer.sampleRate)
  n = ((n % len) + len) % len
  if (n < 8 || n > len - 8) return buffer
  const out = makeBuffer(buffer.numberOfChannels, len, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    dst.set(src.subarray(n), 0)
    dst.set(src.subarray(0, n), len - n)
  }
  return loopCrossfade(out, 8)
}

export function clipToLoop<T extends { time: number; duration: number }>(items: T[], loopLen: number): T[] {
  return items.map((item) => {
    let time = item.time
    if (loopLen > 0) {
      time = time % loopLen
      if (time < 0) time += loopLen
      if (time >= loopLen - 0.008) time = 0
    }
    return {
      ...item,
      time: Math.max(0, time),
      duration: Math.max(0.02, Math.min(item.duration, Math.max(0.02, loopLen - time))),
    }
  })
}

export function clipHits(items: DrumHit[], loopLen: number): DrumHit[] {
  return clipToLoop(items, loopLen)
}

export function clipNotes(items: MidiNote[], loopLen: number): MidiNote[] {
  return clipToLoop(items, loopLen)
}

/** Guess melody vs drums vs vocals from a raw take. */
export function classifyTake(buffer: AudioBuffer): TrackKind {
  const samples = mixToMono(buffer)
  const sr = buffer.sampleRate
  const size = 2048
  const hop = Math.floor(sr * 0.04)
  const detector = PitchDetector.forFloat32Array(size)
  detector.minVolumeAbsolute = 0.004
  const scratch = new Float32Array(size)
  let voiced = 0
  let frames = 0
  let onsets = 0
  let prev = 0
  let highZ = 0

  for (let start = 0; start + size < samples.length; start += hop) {
    scratch.set(samples.subarray(start, start + size))
    const e = rms(scratch, 0, size)
    if (e < 0.006) continue
    frames++
    const [freq, clarity] = detector.findPitch(scratch, sr)
    if (clarity > 0.72 && freq > 75 && freq < 900) voiced++
    let z = 0
    for (let i = 1; i < size; i += 4) if (scratch[i] * scratch[i - 1] < 0) z++
    const flux = e - prev
    prev = e
    if (flux > 0.02) onsets++
    if (z > 80) highZ++
  }

  const n = Math.max(1, frames)
  const voicedRatio = voiced / n
  const onsetRate = onsets / Math.max(0.4, buffer.duration)
  const noisy = highZ / n > 0.45

  if (onsetRate > 3.2 && voicedRatio < 0.28) return 'drums'
  if (voicedRatio > 0.38 && !noisy) return 'melody'
  if (noisy && voicedRatio > 0.12 && voicedRatio < 0.55) return 'vocals'
  if (onsetRate > 2 && voicedRatio < 0.4) return 'drums'
  return 'melody'
}
