import type { Session, Track, TrackKind } from '../types'
import { defaultEq, defaultMaster, defaultMeta } from '../types'
import { DEFAULT_INSTRUMENT } from '../data/instruments'

function uid(): string {
  return crypto.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const NAMES: Record<TrackKind, string> = {
  melody: 'Melody',
  drums: 'Drums',
  vocals: 'Vocals',
}

export function createTrack(kind: TrackKind, index: number): Track {
  const instrumentId = DEFAULT_INSTRUMENT[kind]
  return {
    id: uid(),
    name: `${NAMES[kind]} ${index + 1}`,
    kind,
    muted: false,
    solo: false,
    gain: 0,
    pan: 0,
    instrumentId,
    vocalRole: kind === 'vocals' ? 'lead' : 'lead',
    eq: defaultEq(),
    quantize: 0,
    notes: [],
    drums: [],
    duration: 0,
    transcribing: false,
    progress: 0,
    status: 'Drop audio or record',
  }
}

export function createSession(): Session {
  return {
    meta: defaultMeta(),
    tracks: [],
    master: defaultMaster(),
    selectedId: null,
  }
}

export function addTrack(session: Session, kind: TrackKind): Session {
  const count = session.tracks.filter((t) => t.kind === kind).length
  const track = createTrack(kind, count)
  return { ...session, tracks: [...session.tracks, track], selectedId: track.id }
}
