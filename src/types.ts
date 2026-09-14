export type TrackKind = 'melody' | 'drums' | 'vocals'
export type VocalRole = 'lead' | 'verse' | 'chorus' | 'double' | 'harmony'
export type DrumPiece = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'tom' | 'crash'

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
  eq: EqState
  /** 0 = preserve original timing, 1 = snap to the grid */
  quantize: number
  notes: MidiNote[]
  drums: DrumHit[]
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
