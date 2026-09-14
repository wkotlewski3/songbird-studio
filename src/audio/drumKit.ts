import type { DrumPiece, Layer } from '../types'
import { DRUM_PIECES } from '../types'
import { playDrumSynth } from './drumSynth'

const BASE = 'https://cdn.jsdelivr.net/gh/tidalcycles/Dirt-Samples@master'

export interface DrumSample {
  id: string
  label: string
  piece: DrumPiece
  path: string
}

/** Individual SuperDirt / TidalCycles hits — not just whole kits. */
export const DRUM_SAMPLES: DrumSample[] = [
  { id: 'tidal-kick', label: 'Tidal kick', piece: 'kick', path: 'bd/BT0A0A7.wav' },
  { id: 'tidal-kick-tight', label: 'Tidal kick tight', piece: 'kick', path: 'bd/BT0A0D0.wav' },
  { id: '808-kick', label: '808 kick', piece: 'kick', path: '808bd/BD0000.WAV' },
  { id: '808-kick-long', label: '808 kick long', piece: 'kick', path: '808bd/BD0075.WAV' },
  { id: 'house-kick', label: 'House kick', piece: 'kick', path: 'house/000_BD.wav' },
  { id: 'electro-kick', label: 'Electro kick', piece: 'kick', path: 'electro1/005_et1kick1.wav' },
  { id: 'electro-kick-2', label: 'Electro kick 2', piece: 'kick', path: 'electro1/006_et1kick2.wav' },
  { id: 'gretsch-kick', label: 'Gretsch kick', piece: 'kick', path: 'gretsch/013_kick.wav' },
  { id: 'jazz-kick', label: 'Jazz kick', piece: 'kick', path: 'jazz/000_BD.wav' },
  { id: 'dr55-kick', label: 'DR-55 kick', piece: 'kick', path: 'dr55/001_DR55 kick.wav' },
  { id: 'seq-kick', label: 'Sequential kick', piece: 'kick', path: 'sequential/003_Tom Kick.wav' },

  { id: 'tidal-snare', label: 'Tidal snare', piece: 'snare', path: 'sn/ST0T0S3.wav' },
  { id: 'tidal-snare-bright', label: 'Tidal snare bright', piece: 'snare', path: 'sn/ST0T3S3.wav' },
  { id: '808-snare', label: '808 snare', piece: 'snare', path: '808sd/SD0000.WAV' },
  { id: 'house-snare', label: 'House snare', piece: 'snare', path: 'house/007_SN.wav' },
  { id: 'electro-snare', label: 'Electro snare', piece: 'snare', path: 'electro1/011_et1snare1.wav' },
  { id: 'electro-snare-2', label: 'Electro snare 2', piece: 'snare', path: 'electro1/012_et1snare2.wav' },
  { id: 'gretsch-snare', label: 'Gretsch snare', piece: 'snare', path: 'gretsch/020_snare.wav' },
  { id: 'gretsch-brush', label: 'Gretsch brush', piece: 'snare', path: 'gretsch/002_brushsnare.wav' },
  { id: 'jazz-snare', label: 'Jazz snare', piece: 'snare', path: 'jazz/007_SN.wav' },
  { id: 'dr55-snare', label: 'DR-55 snare', piece: 'snare', path: 'dr55/003_DR55 snare.wav' },
  { id: 'seq-snare', label: 'Sequential snare', piece: 'snare', path: 'sequential/005_Tom Snare.wav' },

  { id: 'tidal-clap', label: 'Tidal clap', piece: 'clap', path: 'cp/HANDCLP0.wav' },
  { id: 'tidal-clap-alt', label: 'Tidal clap alt', piece: 'clap', path: 'cp/HANDCLPA.wav' },
  { id: 'real-clap-1', label: 'Real clap 1', piece: 'clap', path: 'realclaps/1.wav' },
  { id: 'real-clap-2', label: 'Real clap 2', piece: 'clap', path: 'realclaps/2.wav' },
  { id: 'real-clap-3', label: 'Real clap 3', piece: 'clap', path: 'realclaps/3.wav' },
  { id: 'real-clap-4', label: 'Real clap 4', piece: 'clap', path: 'realclaps/4.wav' },
  { id: 'seq-clap', label: 'Sequential clap', piece: 'clap', path: 'sequential/000_Tom Clap.wav' },

  { id: 'tidal-rim', label: 'Tidal rim', piece: 'rim', path: 'rm/RIM0.wav' },
  { id: 'rytm-rim', label: 'Rytm rim', piece: 'rim', path: 'rs/rytm-rs.wav' },
  { id: 'dr55-rim', label: 'DR-55 rim', piece: 'rim', path: 'dr55/002_DR55 rimshot.wav' },

  { id: 'tidal-hat', label: 'Tidal hat', piece: 'hatClosed', path: 'hc/HHCD0.wav' },
  { id: '808-hat', label: '808 hat', piece: 'hatClosed', path: '808hc/HC00.WAV' },
  { id: 'house-hat', label: 'House hat', piece: 'hatClosed', path: 'house/003_HH.wav' },
  { id: 'electro-hat', label: 'Electro hat', piece: 'hatClosed', path: 'electro1/000_et1closedhh.wav' },
  { id: 'gretsch-hat', label: 'Gretsch hat', piece: 'hatClosed', path: 'gretsch/004_closedhat.wav' },
  { id: 'jazz-hat', label: 'Jazz hat', piece: 'hatClosed', path: 'jazz/003_HH.wav' },
  { id: 'linn-hat', label: 'Linn hat', piece: 'hatClosed', path: 'linnhats/1.wav' },
  { id: 'seq-hat', label: 'Sequential hat', piece: 'hatClosed', path: 'sequential/002_Tom Hat Closed.wav' },
  { id: 'dr55-hat', label: 'DR-55 hat', piece: 'hatClosed', path: 'dr55/000_DR55 hi hat.wav' },

  { id: 'tidal-open', label: 'Tidal open hat', piece: 'hatOpen', path: 'ho/HHOD0.wav' },
  { id: '808-open', label: '808 open hat', piece: 'hatOpen', path: '808oh/OH00.WAV' },
  { id: 'house-open', label: 'House open hat', piece: 'hatOpen', path: 'house/004_OH.wav' },
  { id: 'electro-open', label: 'Electro open hat', piece: 'hatOpen', path: 'electro1/007_et1openhh.wav' },
  { id: 'gretsch-open', label: 'Gretsch open hat', piece: 'hatOpen', path: 'gretsch/017_openhat.wav' },
  { id: 'jazz-open', label: 'Jazz open hat', piece: 'hatOpen', path: 'jazz/004_OH.wav' },
  { id: 'seq-open', label: 'Sequential open hat', piece: 'hatOpen', path: 'sequential/004_Tom Openhat.wav' },

  { id: 'tidal-tom', label: 'Tidal low tom', piece: 'tom', path: 'lt/LT0D0.wav' },
  { id: 'tidal-tom-mid', label: 'Tidal mid tom', piece: 'tom', path: 'mt/MT0D0.wav' },
  { id: '808-tom', label: '808 low tom', piece: 'tom', path: '808lt/LT00.WAV' },
  { id: '808-tom-mid', label: '808 mid tom', piece: 'tom', path: '808mt/MT00.WAV' },
  { id: 'gretsch-tom', label: 'Gretsch tom', piece: 'tom', path: 'gretsch/015_lotom.wav' },
  { id: 'seq-tom', label: 'Sequential tom', piece: 'tom', path: 'sequential/006_Tom Tom1.wav' },

  { id: 'tidal-crash', label: 'Tidal crash', piece: 'crash', path: 'cc/CSHD0.wav' },
  { id: 'tidal-ride', label: 'Tidal ride', piece: 'crash', path: 'cr/RIDED0.wav' },
  { id: '808-crash', label: '808 cymbal', piece: 'crash', path: '808cy/CY0000.WAV' },
  { id: 'electro-crash', label: 'Electro crash', piece: 'crash', path: 'electro1/001_et1crash.wav' },
  { id: 'gretsch-crash', label: 'Gretsch crash', piece: 'crash', path: 'gretsch/007_cymbalgrab.wav' },
  { id: 'seq-crash', label: 'Sequential crash', piece: 'crash', path: 'sequential/001_Tom Crash.wav' },
]

export type DrumStyleId =
  | 'songbird-kit'
  | 'drum-808'
  | 'drum-house'
  | 'drum-electro'
  | 'drum-gretsch'
  | 'drum-sequential'
  | 'drum-dr55'
  | 'drum-claps'

export const DRUM_STYLE_MAP: Record<DrumStyleId, Record<DrumPiece, string>> = {
  'songbird-kit': {
    kick: 'tidal-kick',
    snare: 'tidal-snare',
    clap: 'tidal-clap',
    rim: 'tidal-rim',
    hatClosed: 'tidal-hat',
    hatOpen: 'tidal-open',
    tom: 'tidal-tom',
    crash: 'tidal-crash',
  },
  'drum-808': {
    kick: '808-kick',
    snare: '808-snare',
    clap: 'tidal-clap',
    rim: 'dr55-rim',
    hatClosed: '808-hat',
    hatOpen: '808-open',
    tom: '808-tom',
    crash: '808-crash',
  },
  'drum-house': {
    kick: 'house-kick',
    snare: 'house-snare',
    clap: 'real-clap-1',
    rim: 'tidal-rim',
    hatClosed: 'house-hat',
    hatOpen: 'house-open',
    tom: '808-tom-mid',
    crash: '808-crash',
  },
  'drum-electro': {
    kick: 'electro-kick',
    snare: 'electro-snare',
    clap: 'seq-clap',
    rim: 'rytm-rim',
    hatClosed: 'electro-hat',
    hatOpen: 'electro-open',
    tom: 'seq-tom',
    crash: 'electro-crash',
  },
  'drum-gretsch': {
    kick: 'gretsch-kick',
    snare: 'gretsch-snare',
    clap: 'real-clap-2',
    rim: 'tidal-rim',
    hatClosed: 'gretsch-hat',
    hatOpen: 'gretsch-open',
    tom: 'gretsch-tom',
    crash: 'gretsch-crash',
  },
  'drum-sequential': {
    kick: 'seq-kick',
    snare: 'seq-snare',
    clap: 'seq-clap',
    rim: 'dr55-rim',
    hatClosed: 'seq-hat',
    hatOpen: 'seq-open',
    tom: 'seq-tom',
    crash: 'seq-crash',
  },
  'drum-dr55': {
    kick: 'dr55-kick',
    snare: 'dr55-snare',
    clap: 'tidal-clap-alt',
    rim: 'dr55-rim',
    hatClosed: 'dr55-hat',
    hatOpen: 'tidal-open',
    tom: 'tidal-tom-mid',
    crash: 'tidal-ride',
  },
  'drum-claps': {
    kick: 'house-kick',
    snare: 'real-clap-3',
    clap: 'real-clap-1',
    rim: 'real-clap-4',
    hatClosed: 'linn-hat',
    hatOpen: 'house-open',
    tom: 'seq-tom',
    crash: 'seq-crash',
  },
}

const SAMPLE_BY_ID = new Map(DRUM_SAMPLES.map((s) => [s.id, s]))
const buffers = new Map<string, AudioBuffer>()
const inflight = new Map<string, Promise<AudioBuffer | null>>()

async function decodeUrl(ac: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await ac.decodeAudioData(await res.arrayBuffer())
  } catch {
    return null
  }
}

export function drumSampleById(id: string): DrumSample | undefined {
  return SAMPLE_BY_ID.get(id)
}

export function samplesForPiece(piece: DrumPiece): DrumSample[] {
  return DRUM_SAMPLES.filter((s) => s.piece === piece)
}

export function isDirtStyle(instrumentId: string): instrumentId is DrumStyleId {
  return instrumentId in DRUM_STYLE_MAP
}

export function resolveDrumSample(instrumentId: string, piece: DrumPiece, voices?: Layer['drumVoices']): string | undefined {
  return voices?.[piece] ?? DRUM_STYLE_MAP[instrumentId as DrumStyleId]?.[piece]
}

async function loadSample(ac: AudioContext, id: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(id)
  if (cached) return cached
  const pending = inflight.get(id)
  if (pending) return pending
  const sample = SAMPLE_BY_ID.get(id)
  if (!sample) return null
  const work = decodeUrl(ac, `${BASE}/${sample.path}`).then((buf) => {
    inflight.delete(id)
    if (buf) buffers.set(id, buf)
    return buf
  })
  inflight.set(id, work)
  return work
}

export async function loadDrumVoices(
  ac: AudioContext,
  instrumentId: string,
  voices?: Layer['drumVoices'],
): Promise<void> {
  const ids = new Set<string>()
  const style = DRUM_STYLE_MAP[instrumentId as DrumStyleId]
  if (style) DRUM_PIECES.forEach((piece) => ids.add(style[piece]))
  if (voices) Object.values(voices).forEach((id) => id && ids.add(id))
  await Promise.all([...ids].map((id) => loadSample(ac, id)))
}

/** @deprecated older call sites — loads the Tidal acoustic map */
export async function loadDirtKit(ac: AudioContext): Promise<void> {
  return loadDrumVoices(ac, 'songbird-kit')
}

function pieceDuration(piece: DrumPiece): number {
  if (piece === 'kick') return 0.45
  if (piece === 'crash') return 1.4
  if (piece === 'hatClosed') return 0.12
  if (piece === 'hatOpen') return 0.35
  if (piece === 'clap' || piece === 'rim') return 0.22
  return 0.28
}

export function playDrumSample(
  ctx: BaseAudioContext,
  dest: AudioNode,
  piece: DrumPiece,
  time: number,
  velocity: number,
  sampleId?: string,
): void {
  const buffer = sampleId ? buffers.get(sampleId) : undefined
  if (!buffer) {
    playDrumSynth(ctx, dest, piece, time, velocity)
    return
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  if (piece === 'crash' && sampleId?.startsWith('tidal-')) src.playbackRate.value = 0.92
  const g = ctx.createGain()
  const v = velocity / 127
  const dur = pieceDuration(piece)
  g.gain.setValueAtTime(Math.max(0.0001, v * 1.05), time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  src.connect(g)
  g.connect(dest)
  src.start(time)
  src.stop(time + dur + 0.02)
}

export const DIRT_KIT_CREDIT = 'Drums: Dirt-Samples (TidalCycles / SuperDirt) — individual hits and style maps.'
