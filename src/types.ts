export type TrackKind = 'melody' | 'drums' | 'vocals'
export type VocalRole = 'lead' | 'verse' | 'chorus' | 'double' | 'harmony'
export type VocalTone = 'studio' | 'warm' | 'airy' | 'radio'
export type VocalReverb = 'dry' | 'room' | 'plate' | 'hall' | 'cathedral'
export type VocalEcho = 'off' | 'slap' | 'eighth' | 'quarter' | 'dub' | 'pingpong'

export const VOCAL_TONES: { id: VocalTone; label: string; hint: string }[] = [
  { id: 'studio', label: 'Studio', hint: 'Crisp, de-essed, tight — the front of a record' },
  { id: 'warm', label: 'Warm', hint: 'Closer and rounder, less air' },
  { id: 'airy', label: 'Airy', hint: 'Open top, lighter body' },
  { id: 'radio', label: 'Radio', hint: 'Mid-forward lo-fi band' },
]

export const VOCAL_REVERBS: { id: VocalReverb; label: string; hint: string }[] = [
  { id: 'dry', label: 'Dry', hint: 'Almost no space' },
  { id: 'room', label: 'Room', hint: 'Tight booth / vocal booth' },
  { id: 'plate', label: 'Plate', hint: 'Classic vocal plate' },
  { id: 'hall', label: 'Hall', hint: 'Longer, wider room' },
  { id: 'cathedral', label: 'Cathedral', hint: 'Big ambient wash' },
]

export const VOCAL_ECHOES: { id: VocalEcho; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'No repeats' },
  { id: 'slap', label: 'Slap', hint: 'Short studio slapback' },
  { id: 'eighth', label: '1/8 echo', hint: 'Eighth-note repeats on this BPM' },
  { id: 'quarter', label: '1/4 echo', hint: 'Quarter-note repeats on this BPM' },
  { id: 'dub', label: 'Dub', hint: 'Dotted-eight, darker feedback' },
  { id: 'pingpong', label: 'Ping-pong', hint: 'Stereo bouncing repeats' },
]

export function defaultVocalTone(): VocalTone {
  return 'studio'
}

export function defaultVocalReverb(): VocalReverb {
  return 'room'
}

export function defaultVocalEcho(): VocalEcho {
  return 'off'
}

export function vocalTreatmentForInstrument(id: string): {
  vocalRole: VocalRole
  vocalTone: VocalTone
  vocalReverb: VocalReverb
  vocalEcho: VocalEcho
} {
  if (id === 'vocal-verse') return { vocalRole: 'verse', vocalTone: 'warm', vocalReverb: 'dry', vocalEcho: 'off' }
  if (id === 'vocal-chorus') return { vocalRole: 'chorus', vocalTone: 'airy', vocalReverb: 'hall', vocalEcho: 'slap' }
  if (id === 'vocal-echo') return { vocalRole: 'lead', vocalTone: 'studio', vocalReverb: 'plate', vocalEcho: 'eighth' }
  if (id === 'vocal-ambient') return { vocalRole: 'harmony', vocalTone: 'airy', vocalReverb: 'cathedral', vocalEcho: 'slap' }
  return { vocalRole: 'lead', vocalTone: 'studio', vocalReverb: 'room', vocalEcho: 'off' }
}
export type MelodyVoicing = 'solo' | 'octaves' | 'thirds' | 'power' | 'triads' | 'sevenths' | 'pad'
export type DrumPiece = 'kick' | 'snare' | 'clap' | 'rim' | 'hatClosed' | 'hatOpen' | 'tom' | 'crash'

export const DRUM_PIECES: DrumPiece[] = [
  'kick',
  'snare',
  'clap',
  'rim',
  'hatClosed',
  'hatOpen',
  'tom',
  'crash',
]

export const DRUM_PIECE_LABELS: Record<DrumPiece, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  rim: 'Rim',
  hatClosed: 'Closed hat',
  hatOpen: 'Open hat',
  tom: 'Tom',
  crash: 'Crash',
}

export interface RhythmFeel {
  /** Grid slots inside one quarter-note beat: 1 = quarters, 2 = 8ths, 3 = triplets, 4 = 16ths */
  slotsPerBeat: 1 | 2 | 3 | 4
  beatsPerBar: 3 | 4
  label: string
}

export const RHYTHM_FEELS: RhythmFeel[] = [
  { slotsPerBeat: 1, beatsPerBar: 4, label: '1/4 · 4/4' },
  { slotsPerBeat: 2, beatsPerBar: 4, label: '1/8 · 4/4' },
  { slotsPerBeat: 4, beatsPerBar: 4, label: '1/16 · 4/4' },
  { slotsPerBeat: 3, beatsPerBar: 4, label: '12/8' },
  { slotsPerBeat: 1, beatsPerBar: 3, label: '1/4 · 3/4' },
  { slotsPerBeat: 2, beatsPerBar: 3, label: '1/8 · 3/4' },
]

export function defaultRhythm(): RhythmFeel {
  return { slotsPerBeat: 4, beatsPerBar: 4, label: '1/16 · 4/4' }
}

/** Light pull toward the grid — keeps intentional off-beats (syncopation, 12/8, added hits). */
export const DEFAULT_SNAP = 0.5

export function defaultVoicing(): MelodyVoicing {
  return 'triads'
}

export function sameRhythm(a: RhythmFeel | null | undefined, b: RhythmFeel | null | undefined): boolean {
  if (!a || !b) return false
  return a.slotsPerBeat === b.slotsPerBeat && a.beatsPerBar === b.beatsPerBar
}

export interface MidiNote {
  midi: number
  time: number
  duration: number
  velocity: number
  cents: number
}

export interface DrumHit {
  time: number
  duration: number
  velocity: number
  piece: DrumPiece
}

export interface EqState {
  low: number
  mid: number
  presence: number
  air: number
}

export interface Layer {
  id: string
  name: string
  muted: boolean
  solo: boolean
  gain: number
  pan: number
  instrumentId: string
  vocalRole: VocalRole
  /** Tone of the vocal chain — studio crisp vs warm vs radio */
  vocalTone: VocalTone
  vocalReverb: VocalReverb
  vocalEcho: VocalEcho
  /** How a hummed melody is realized — solo line vs chords in the session key */
  voicing: MelodyVoicing
  eq: EqState
  /** 0 = preserve original timing, 1 = snap to the detected click grid */
  quantize: number
  /** Closest groove for this take — lock and playback snap to this grid */
  rhythm: RhythmFeel
  notes: MidiNote[]
  drums: DrumHit[]
  /** Per-piece Dirt-Samples override; empty uses the kit’s default map */
  drumVoices: Partial<Record<DrumPiece, string>>
  duration: number
  transcribing: boolean
  progress: number
  status: string
  /** Originating take so one upload can feed many instrument layers */
  sourceId: string | null
  /** False until you accept the MIDI reading — Play uses the original take until then */
  accepted: boolean
  reviewing: boolean
  /** 0 = interpretation only, 1 = original audio only */
  originalMix: number
  transcribe: TranscribeSettings
}

export interface TranscribeSettings {
  /** RMS floor; higher drops quiet noise that was being turned into notes */
  gate: number
  /** Keep a pitch only when McLeod/Tartini clarity is at least this sure (0–1) */
  confidence: number
  /** Break into a new note when pitch moves more than this many cents */
  splitCents: number
  /** Ignore blips shorter than this (seconds) */
  minNote: number
  /** 0 keep your pitch drift, 1 snap hard to 12-TET */
  snap: number
  /** Drum onset pickiness; higher = fewer / more certain hits */
  onset: number
}

export interface Track {
  id: string
  name: string
  kind: TrackKind
  muted: boolean
  solo: boolean
  gain: number
  pan: number
  layers: Layer[]
  selectedLayerId: string | null
}

export interface MasterSettings {
  inputGain: number
  low: number
  high: number
  presence: number
  glue: number
  limiter: number
  autoEq: boolean
}

export interface SessionMeta {
  title: string
  artist: string
  album: string
  year: string
  genre: string
  bpm: number
  /** Sketch length in bars — the click and default loop live on this grid */
  bars: number
  key: string
}

export interface Session {
  meta: SessionMeta
  tracks: Track[]
  master: MasterSettings
  selectedId: string | null
  video: VideoSettings
}

export type VideoFilter = 'film' | 'night' | 'vhs' | 'chrome' | 'golden' | 'dream'

export const VIDEO_FILTERS: { id: VideoFilter; label: string; hint: string }[] = [
  { id: 'film', label: 'Film', hint: 'Warm grain, vignette' },
  { id: 'night', label: 'Night', hint: 'Cool, crushed blacks' },
  { id: 'vhs', label: 'VHS', hint: 'Scanlines and drift' },
  { id: 'chrome', label: 'Chrome', hint: 'High-contrast black and white' },
  { id: 'golden', label: 'Golden', hint: 'Heavy gold wash' },
  { id: 'dream', label: 'Dream', hint: 'Soft bloom, slower feel' },
]

export interface StockShot {
  url: string
  thumb: string
  title: string
  author: string
  mime: string
  page: string
  kind: 'image' | 'video'
}

export interface VideoSettings {
  theme: string
  lyrics: string
  filter: VideoFilter
  /** Cut to a new shot every N beats */
  cutBeats: 1 | 2 | 4 | 8
  lyricScale: number
  showWords: boolean
  useSelf: boolean
  stock: StockShot[]
}

export function defaultVideo(): VideoSettings {
  return {
    theme: '',
    lyrics: '',
    filter: 'film',
    cutBeats: 4,
    lyricScale: 1,
    showWords: true,
    useSelf: true,
    stock: [],
  }
}

export const defaultEq = (): EqState => ({
  low: 0,
  mid: 0,
  presence: 0,
  air: 0,
})

export const defaultTranscribe = (): TranscribeSettings => ({
  gate: 0.012,
  confidence: 0.66,
  splitCents: 50,
  minNote: 0.1,
  snap: 0.25,
  onset: 1.2,
})

/** Dense claps and 16ths need a lower floor than hummed notes. */
export const defaultDrumTranscribe = (): TranscribeSettings => ({
  ...defaultTranscribe(),
  minNote: 0.04,
  onset: 0.75,
})

export const defaultMaster = (): MasterSettings => ({
  inputGain: 0,
  low: 0,
  high: 0.5,
  presence: 0.5,
  glue: 0.45,
  limiter: 0.85,
  autoEq: false,
})

export const defaultMeta = (): SessionMeta => ({
  title: 'Untitled sketch',
  artist: '',
  album: 'SongBird Studio',
  year: new Date().getFullYear().toString(),
  genre: 'Alternative',
  bpm: 92,
  bars: 4,
  key: 'C',
})

export function layerHasContent(layer: Layer): boolean {
  return layer.notes.length > 0 || layer.drums.length > 0 || layer.duration > 0
}

export function trackDuration(track: Track): number {
  return track.layers.reduce((max, layer) => Math.max(max, layer.duration), 0)
}

export function takeIdOf(layer: Layer): string {
  return layer.sourceId ?? layer.id
}

export function selectedLayerOf(track: Track | undefined): Layer | undefined {
  if (!track) return undefined
  return track.layers.find((l) => l.id === track.selectedLayerId) ?? track.layers[0]
}
