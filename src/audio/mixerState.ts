import type { Layer, Session, Track } from '../types'

export function anySolo(tracks: Track[]): boolean {
  return tracks.some((t) => t.solo || t.layers.some((l) => l.solo))
}

/** Classic DAW solo: mute always wins; if anything is soloed, only solos (and unsoloed layers on a soloed track) play. */
export function isLayerAudible(tracks: Track[], track: Track, layer: Layer): boolean {
  if (track.muted || layer.muted) return false
  if (!anySolo(tracks)) return true
  if (layer.solo) return true
  const layerSoloOnTrack = track.layers.some((l) => l.solo)
  if (track.solo && !layerSoloOnTrack) return true
  return false
}

/** Fields that are baked into the audio graph (not live gain/pan/mute). */
export function mixFingerprint(session: Session): string {
  return JSON.stringify({
        bpm: session.meta.bpm,
        bars: session.meta.bars,
    master: session.master,
    tracks: session.tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      layers: t.layers.map((l) => ({
        id: l.id,
        instrumentId: l.instrumentId,
        vocalRole: l.vocalRole,
        eq: l.eq,
        quantize: l.quantize,
        originalMix: l.originalMix,
        accepted: l.accepted,
        transcribe: l.transcribe,
        drumVoices: l.drumVoices,
        rhythm: l.rhythm,
        notes: l.notes,
        drums: l.drums,
      })),
    })),
  })
}
