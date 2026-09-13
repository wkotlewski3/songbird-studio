import { SOUNDFONT_BASE } from '../data/instruments'
import { midiToFreq } from './context'

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export function midiToName(midi: number): string {
  const n = ((midi % 12) + 12) % 12
  const oct = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[n]}${oct}`
}

type FontTable = Record<string, AudioBuffer>
const cache = new Map<string, FontTable>()
const inflight = new Map<string, Promise<FontTable>>()

function parseSoundfontJs(source: string): Record<string, string> {
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Unreadable soundfont')
  return JSON.parse(source.slice(start, end + 1)) as Record<string, string>
}

async function decodeDataUri(ac: AudioContext, uri: string): Promise<AudioBuffer> {
  const comma = uri.indexOf(',')
  const b64 = uri.slice(comma + 1)
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return ac.decodeAudioData(bytes.buffer.slice(0))
}

export async function loadSoundfont(ac: AudioContext, name: string): Promise<FontTable> {
  const hit = cache.get(name)
  if (hit) return hit
  const pending = inflight.get(name)
  if (pending) return pending

  const job = (async () => {
    const url = `${SOUNDFONT_BASE}/${name}-mp3.js`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not load ${name} soundfont`)
    const table = parseSoundfontJs(await res.text())
    const out: FontTable = {}
    const entries = Object.entries(table)
    const stride = Math.max(1, Math.ceil(entries.length / 36))
    await Promise.all(
      entries
        .filter((_, i) => i % stride === 0 || /C\d|E\d|G\d/.test(entries[i][0]))
        .map(async ([note, uri]) => {
          try {
            out[note] = await decodeDataUri(ac, uri)
          } catch {
            /* skip a bad sample */
          }
        }),
    )
    cache.set(name, out)
    inflight.delete(name)
    return out
  })()

  inflight.set(name, job)
  return job
}

function nameToMidi(name: string): number {
  const m = name.match(/^([A-G][b#]?)(-?\d+)$/)
  if (!m) return 60
  const names: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
  }
  return (parseInt(m[2], 10) + 1) * 12 + (names[m[1]] ?? 0)
}

export function nearestSample(table: FontTable, midi: number): { name: string; buffer: AudioBuffer; sourceMidi: number } | null {
  let best: { name: string; buffer: AudioBuffer; sourceMidi: number } | null = null
  let bestDist = 99
  for (const [name, buffer] of Object.entries(table)) {
    const sourceMidi = nameToMidi(name)
    const d = Math.abs(sourceMidi - midi)
    if (d < bestDist) {
      bestDist = d
      best = { name, buffer, sourceMidi }
    }
  }
  return best
}

export function playSample(
  ctx: BaseAudioContext,
  dest: AudioNode,
  table: FontTable,
  midi: number,
  time: number,
  duration: number,
  gain: number,
): void {
  const sample = nearestSample(table, midi)
  if (!sample) return
  const src = ctx.createBufferSource()
  src.buffer = sample.buffer
  src.playbackRate.value = midiToFreq(midi) / midiToFreq(sample.sourceMidi)
  const g = ctx.createGain()
  g.gain.setValueAtTime(Math.max(0.0001, gain), time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.05, duration))
  src.connect(g)
  g.connect(dest)
  src.start(time)
  src.stop(time + duration + 0.05)
}
