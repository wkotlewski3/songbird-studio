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

export interface Track {
  id: string
  name: string
  kind: TrackKind
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
  key: 'C',
})
