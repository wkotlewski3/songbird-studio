import { getAudioContext } from './context'
import { beatDuration, CLICK_FREQ_ACCENT, CLICK_FREQ_BEAT } from './metronome'

function copyBuffer(buffer: AudioBuffer): AudioBuffer {
  const out = getAudioContext().createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) out.getChannelData(c).set(buffer.getChannelData(c))
  return out
}

function rms(data: Float32Array, start: number, n: number): number {
  let s = 0
  const a = Math.max(0, start)
  const b = Math.min(data.length, start + n)
  const len = Math.max(1, b - a)
  for (let i = a; i < b; i++) s += data[i] * data[i]
  return Math.sqrt(s / len)
}

function energy(data: Float32Array, start: number, n: number): number {
  let s = 0
  const a = Math.max(0, start)
  const b = Math.min(data.length, start + n)
  for (let i = a; i < b; i++) s += data[i] * data[i]
  return s
}

function goertzel(data: Float32Array, start: number, n: number, sr: number, freq: number): number {
  const a = Math.max(0, start)
  const b = Math.min(data.length, start + n)
  const len = Math.max(1, b - a)
  const k = Math.round((len * freq) / sr)
  const coeff = 2 * Math.cos((2 * Math.PI * k) / len)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  for (let i = a; i < b; i++) {
    s0 = data[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2
}

/**
 * Metronome ticks are narrowband squares at 1108 / 1660 Hz.
 * Claps are broadband — they must not be ducked just because they land on the grid.
 */
function metronomeLikeness(data: Float32Array, start: number, n: number, sr: number): number {
  const e = energy(data, start, n)
  if (e < 1e-8) return 0
  const a = Math.max(0, start)
  const b = Math.min(data.length, start + n)
  const len = Math.max(1, b - a)
  const tone = goertzel(data, start, n, sr, CLICK_FREQ_BEAT) + goertzel(data, start, n, sr, CLICK_FREQ_ACCENT)
  return tone / (e * len + 1e-8)
}

function duck(data: Float32Array, start: number, n: number, amount: number): void {
  const fade = Math.min(48, n >> 2)
  for (let i = 0; i < n; i++) {
    const idx = start + i
    if (idx < 0 || idx >= data.length) continue
    let w = amount
    if (i < fade) w = amount * (i / fade) + (1 - i / fade)
    else if (i > n - fade) {
      const t = (n - i) / fade
      w = amount * t + (1 - t)
    }
    data[idx] *= w
  }
}

/**
 * Pull speaker-bleed metronome ticks out of a live take so mute still works after you recorded with the click.
 */
export function stripClickBleed(buffer: AudioBuffer, bpm: number, latency = 0): AudioBuffer {
  const out = copyBuffer(buffer)
  const sr = buffer.sampleRate
  const beat = beatDuration(bpm)
  const win = Math.floor(sr * 0.028)
  const search = Math.floor(sr * 0.05)
  const hop = Math.max(8, Math.floor(sr * 0.003))
  const headN = Math.floor(sr * 0.008)
  const tailN = Math.floor(sr * 0.04)

  for (let c = 0; c < out.numberOfChannels; c++) {
    const data = out.getChannelData(c)
    for (let t = 0; t < out.duration + beat; t += beat) {
      const base = Math.floor((t + latency) * sr)
      let bestAt = base
      let best = 0
      for (let s = -Math.floor(sr * 0.016); s < search; s += hop) {
        const score = metronomeLikeness(data, base + s, win, sr)
        if (score > best) {
          best = score
          bestAt = base + s
        }
      }
      if (best < 0.1) continue
      if (rms(data, bestAt, win) < 0.008) continue
      const head = rms(data, bestAt, headN)
      const tail = rms(data, bestAt + headN, tailN)
      if (tail > head * 0.32) continue
      duck(data, bestAt, win, 0.08)
    }
  }
  return out
}

export async function notchClickTones(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  const src = offline.createBufferSource()
  src.buffer = buffer
  const freqs = [CLICK_FREQ_BEAT, CLICK_FREQ_ACCENT, CLICK_FREQ_BEAT * 2, CLICK_FREQ_ACCENT * 2]
  let node: AudioNode = src
  for (const freq of freqs) {
    const notch = offline.createBiquadFilter()
    notch.type = 'notch'
    notch.frequency.value = freq
    notch.Q.value = 18
    node.connect(notch)
    node = notch
  }
  node.connect(offline.destination)
  src.start(0)
  return offline.startRendering()
}

export async function cleanLiveTake(buffer: AudioBuffer, bpm: number, latency = 0): Promise<AudioBuffer> {
  const ducked = stripClickBleed(buffer, bpm, latency)
  return notchClickTones(ducked)
}
