import { Midi } from '@tonejs/midi'
import type { Session } from '../types'
import { instrumentById } from '../data/instruments'
import { GM_DRUM, quantizeDrums } from './drums'
import { layerPlaybackPhrase, layerSlotsPerBeat, tileEvents, wrapTime } from './grid'
import { barsDuration } from './metronome'
import { realizedNotes } from './voicing'

export function buildMidi(session: Session): Uint8Array {
  const midi = new Midi()
  midi.header.name = session.meta.title
  midi.header.setTempo(session.meta.bpm)
  const until = Math.max(
    barsDuration(session.meta.bpm, session.meta.bars),
    ...session.tracks.flatMap((t) => t.layers.map((l) => l.duration)),
  )

  for (const track of session.tracks) {
    if (track.kind === 'vocals') continue
    for (const layer of track.layers) {
      const t = midi.addTrack()
      t.name = `${track.name} / ${layer.name}`
      const inst = instrumentById(layer.instrumentId)

      if (track.kind === 'drums') {
        t.channel = 9
        const phrase = layerPlaybackPhrase(layer.duration, session.meta.bpm, session.meta.bars)
        for (const hit of tileEvents(
          quantizeDrums(layer.drums, session.meta.bpm, layer.quantize, layerSlotsPerBeat(layer)).map((h) => ({
            ...h,
            time: wrapTime(h.time, phrase),
          })),
          phrase,
          until,
        )) {
          t.addNote({
            midi: GM_DRUM[hit.piece] ?? 38,
            time: hit.time,
            duration: hit.duration,
            velocity: hit.velocity / 127,
          })
        }
        continue
      }

      t.channel = 0
      t.instrument.number = inst.program
      const phrase = layerPlaybackPhrase(layer.duration, session.meta.bpm, session.meta.bars)
      for (const note of tileEvents(
        realizedNotes(layer, session.meta.bpm, session.meta.key).map((n) => ({
          ...n,
          time: wrapTime(n.time, phrase),
        })),
        phrase,
        until,
      )) {
        t.addNote({
          midi: note.midi,
          time: note.time,
          duration: Math.max(0.05, note.duration),
          velocity: note.velocity / 127,
        })
      }
    }
  }

  return midi.toArray()
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime: string): void {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const blob = new Blob([copy], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels
  const rate = buffer.sampleRate
  const length = buffer.length
  const bytes = length * channels * 2
  const out = new ArrayBuffer(44 + bytes)
  const view = new DataView(out)
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, bytes, true)
  const interleaved = new Int16Array(out, 44)
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]))
      interleaved[i * channels + c] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
  }
  return new Uint8Array(out)
}

function synchsafe(size: number): number {
  return (
    ((size & 0x7f) << 0) |
    ((size & 0x3f80) << 1) |
    ((size & 0x1fc000) << 2) |
    ((size & 0xfe00000) << 3)
  )
}

function id3Frame(id: string, text: string): Uint8Array {
  const chars = new TextEncoder().encode(text)
  const body = new Uint8Array(1 + chars.length)
  body[0] = 0x03
  body.set(chars, 1)
  const frame = new Uint8Array(10 + body.length)
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i)
  const size = body.length
  frame[4] = (size >> 24) & 0xff
  frame[5] = (size >> 16) & 0xff
  frame[6] = (size >> 8) & 0xff
  frame[7] = size & 0xff
  frame.set(body, 10)
  return frame
}

export function wrapId3(
  mp3: Uint8Array,
  tags: { title: string; artist: string; album: string; year: string; genre: string },
): Uint8Array {
  const frames = [
    id3Frame('TIT2', tags.title || 'Untitled sketch'),
    id3Frame('TPE1', tags.artist || 'Unknown artist'),
    id3Frame('TALB', tags.album || 'SongBird Studio'),
    id3Frame('TYER', tags.year || new Date().getFullYear().toString()),
    id3Frame('TCON', tags.genre || 'Alternative'),
    id3Frame('TSSE', 'SongBird Studio'),
  ]
  const payload = frames.reduce((n, f) => n + f.length, 0)
  const header = new Uint8Array(10)
  header.set([0x49, 0x44, 0x33, 3, 0, 0])
  const ss = synchsafe(payload)
  header[6] = (ss >> 24) & 0x7f
  header[7] = (ss >> 16) & 0x7f
  header[8] = (ss >> 8) & 0x7f
  header[9] = ss & 0x7f
  const out = new Uint8Array(10 + payload + mp3.length)
  out.set(header, 0)
  let o = 10
  for (const f of frames) {
    out.set(f, o)
    o += f.length
  }
  out.set(mp3, o)
  return out
}

export async function encodeMp3(buffer: AudioBuffer): Promise<Uint8Array> {
  const lame = await import('lamejs')
  const Mp3Encoder = lame.Mp3Encoder ?? lame.default?.Mp3Encoder
  if (!Mp3Encoder) throw new Error('MP3 encoder unavailable')
  const encoder = new Mp3Encoder(2, buffer.sampleRate, 192)
  const left = floatTo16(buffer.getChannelData(0))
  const right = floatTo16(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0))
  const chunks: Uint8Array[] = []
  const block = 1152
  for (let i = 0; i < left.length; i += block) {
    const encoded = encoder.encodeBuffer(left.subarray(i, i + block), right.subarray(i, i + block))
    if (encoded.length) chunks.push(new Uint8Array(encoded))
  }
  const flush = encoder.flush()
  if (flush.length) chunks.push(new Uint8Array(flush))
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

export function fileBase(session: Session): string {
  const artist = (session.meta.artist || 'Unknown artist').replace(/[^\w\s.-]+/g, '').trim()
  const title = (session.meta.title || 'Untitled sketch').replace(/[^\w\s.-]+/g, '').trim()
  return `${artist} - ${title}`
}
