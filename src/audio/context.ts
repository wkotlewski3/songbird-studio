let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

export async function resumeAudio(): Promise<AudioContext> {
  const ac = getAudioContext()
  if (ac.state === 'suspended') await ac.resume()
  return ac
}

export async function decodeFile(file: File | Blob): Promise<AudioBuffer> {
  const ac = await resumeAudio()
  const bytes = await file.arrayBuffer()
  return ac.decodeAudioData(bytes.slice(0))
}

export function mixToMono(buffer: AudioBuffer): Float32Array {
  const n = buffer.length
  const out = new Float32Array(n)
  const ch = buffer.numberOfChannels
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += data[i] / ch
  }
  return out
}

export function rms(samples: Float32Array, start: number, end: number): number {
  let s = 0
  const a = Math.max(0, start)
  const b = Math.min(samples.length, end)
  const n = Math.max(1, b - a)
  for (let i = a; i < b; i++) s += samples[i] * samples[i]
  return Math.sqrt(s / n)
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}
