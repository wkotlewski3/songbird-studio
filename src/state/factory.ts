import type { Layer, Session, Track, TrackKind } from '../types'
import { defaultDrumTranscribe, defaultEq, defaultMaster, defaultMeta, defaultTranscribe } from '../types'
import { DEFAULT_INSTRUMENT, instrumentById } from '../data/instruments'

export function uid(): string {
  return crypto.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const NAMES: Record<TrackKind, string> = {
  melody: 'Melody',
  drums: 'Drums',
  vocals: 'Vocals',
}

export function createLayer(kind: TrackKind, index: number): Layer {
  return {
    id: uid(),
    name: `Layer ${index + 1}`,
    muted: false,
    solo: false,
    gain: 0,
    pan: 0,
    instrumentId: DEFAULT_INSTRUMENT[kind],
    vocalRole: kind === 'vocals' ? 'lead' : 'lead',
    eq: defaultEq(),
    quantize: 0,
    notes: [],
    drums: [],
    drumVoices: {},
    duration: 0,
    transcribing: false,
    progress: 0,
    status: 'Record live or drop a raw take',
    sourceId: null,
    accepted: true,
    reviewing: false,
    originalMix: 0.35,
    transcribe: kind === 'drums' ? defaultDrumTranscribe() : defaultTranscribe(),
  }
}

export function createTrack(kind: TrackKind, index: number): Track {
  const layer = createLayer(kind, 0)
  return {
    id: uid(),
    name: `${NAMES[kind]} ${index + 1}`,
    kind,
    muted: false,
    solo: false,
    gain: 0,
    pan: 0,
    layers: [layer],
    selectedLayerId: layer.id,
  }
}

export function normalizeSession(session: Session): Session {
  return {
    ...session,
    tracks: session.tracks.map((track) => ({
      ...track,
      layers: track.layers.map((layer) => ({
        ...layer,
        drumVoices: layer.drumVoices ?? {},
      })),
    })),
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

export function addLayerToTrack(track: Track): Track {
  const layer = createLayer(track.kind, track.layers.length)
  return { ...track, layers: [...track.layers, layer], selectedLayerId: layer.id }
}

export function cloneLayer(track: Track, source: Layer): Track {
  return layerFromTake(track, source, source.instrumentId)
}

export function layerFromTake(track: Track, source: Layer, instrumentId: string): Track {
  const inst = instrumentById(instrumentId)
  const origin = source.sourceId ?? source.id
  const sameSound = track.layers.filter(
    (l) => (l.sourceId ?? l.id) === origin && l.instrumentId === instrumentId,
  ).length
  const layer: Layer = {
    ...source,
    id: uid(),
    name: sameSound ? `${inst.label} ${sameSound + 1}` : inst.label,
    instrumentId,
    vocalRole:
      inst.id === 'vocal-verse' ? 'verse' : inst.id === 'vocal-chorus' ? 'chorus' : source.vocalRole,
    reviewing: false,
    accepted: source.accepted,
    originalMix: track.kind === 'vocals' ? source.originalMix : 0,
    solo: false,
    muted: false,
    pan: Math.max(-1, Math.min(1, source.pan + (track.layers.length % 2 === 0 ? 0.28 : -0.28))),
    sourceId: origin,
    drumVoices: instrumentId === source.instrumentId ? source.drumVoices : {},
    status: `Same take · ${inst.label}`,
  }
  return { ...track, layers: [...track.layers, layer], selectedLayerId: layer.id }
}
