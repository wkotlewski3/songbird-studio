import type { DrumHit, Layer, MidiNote, TrackKind, TranscribeSettings } from '../types'
import { defaultRhythm } from '../types'
import { hitsFromAnalysis } from './drums'
import { getLayerAnalysis, getLayerBuffer } from './engine'
import { alignMidiToTempo, phraseLength } from './grid'
import { notesFromAnalysis } from './melody'

/** Hits / notes from the take as performed — no snap, no phase. */
export function extractLayerMidi(
  layer: Layer,
  kind: TrackKind,
): { notes: MidiNote[]; drums: DrumHit[] } {
  const analysis = getLayerAnalysis(layer.id)
  if (kind === 'melody' && analysis?.kind === 'melody') {
    return { notes: notesFromAnalysis(analysis.melody, layer.transcribe).notes, drums: [] }
  }
  if (kind === 'drums' && analysis?.kind === 'drums') {
    const buffer = getLayerBuffer(layer.id)
    if (!buffer) return { notes: layer.notes, drums: layer.drums }
    return { notes: [], drums: hitsFromAnalysis(buffer, analysis.drums, layer.transcribe) }
  }
  return { notes: layer.notes, drums: layer.drums }
}

export function revoiceLayer(
  layer: Layer,
  kind: TrackKind,
  transcribe: TranscribeSettings,
  bpm = 92,
): Partial<Layer> {
  const feel = layer.rhythm ?? defaultRhythm()
  const loopLen = phraseLength(layer.duration, bpm)
  const extracted = extractLayerMidi({ ...layer, transcribe }, kind)
  if (kind === 'melody') {
    const aligned = alignMidiToTempo(extracted.notes, [], bpm, loopLen, feel)
    return {
      transcribe,
      notes: aligned.notes,
      drums: [],
      rhythm: feel,
      status: `${aligned.notes.length} note${aligned.notes.length === 1 ? '' : 's'} · ${feel.label}`,
    }
  }
  if (kind === 'drums') {
    const aligned = alignMidiToTempo([], extracted.drums, bpm, loopLen, feel)
    return {
      transcribe,
      drums: aligned.drums,
      notes: [],
      rhythm: feel,
      status: `${aligned.drums.length} hit${aligned.drums.length === 1 ? '' : 's'} · ${feel.label}`,
    }
  }
  return { transcribe }
}
